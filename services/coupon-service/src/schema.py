from graphene import ObjectType, String, Float, Int, List, Field, Mutation, Schema, Boolean
from models import Coupon, db
from datetime import datetime
import requests
import os
import traceback

# Add missing imports for HTTP requests and error handling
try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    pass

class CouponType(ObjectType):
    id = Int()
    code = String()
    name = String()
    discount_percentage = Float()
    valid_until = String()
    is_active = Boolean()
    created_at = String()
    updated_at = String()

class CreateCouponResponse(ObjectType):
    coupon = Field(CouponType)
    success = Boolean()
    message = String()

class UseCouponResponse(ObjectType):
    success = Boolean()
    message = String()
    discount_amount = Float()

class TokenVerificationResponse(ObjectType):
    valid = Boolean()
    userId = Int()  # Changed from user_id to userId to match GraphQL conventions
    role = String()
    error = String()

class Query(ObjectType):
    coupons = List(CouponType)
    available_coupons = List(CouponType)  # ← This should match gateway expectation
    coupon = Field(CouponType, id=Int(required=True))
    validate_coupon = Field(Boolean, code=String(required=True))

    def resolve_coupons(self, info):
        try:
            return Coupon.query.all()
        except Exception as e:
            print(f"Error in resolve_coupons: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_available_coupons(self, info):  # ← This should match the field name
        try:
            return Coupon.query.filter(
                Coupon.is_active == True,
                Coupon.valid_until >= datetime.utcnow()
            ).all()
        except Exception as e:
            print(f"Error in resolve_available_coupons: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_coupon(self, info, id):
        try:
            return Coupon.query.get(id)
        except Exception as e:
            print(f"Error in resolve_coupon: {str(e)}")
            return None

    def resolve_validate_coupon(self, info, code):
        try:
            coupon = Coupon.query.filter_by(code=code).first()
            if not coupon:
                return False
            return coupon.is_active and coupon.valid_until >= datetime.utcnow()
        except Exception as e:
            print(f"Error in resolve_validate_coupon: {str(e)}")
            return False

class CreateCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        name = String(required=True)
        discount_percentage = Float(required=True)
        valid_until = String(required=True)

    Output = CreateCouponResponse

    def mutate(self, info, code, name, discount_percentage, valid_until):
        try:
            # Check if coupon code already exists
            existing_coupon = Coupon.query.filter_by(code=code).first()
            if existing_coupon:
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Coupon code already exists"
                )

            # Parse date
            try:
                valid_until_date = datetime.strptime(valid_until, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                try:
                    valid_until_date = datetime.strptime(valid_until, '%Y-%m-%d')
                except ValueError:
                    return CreateCouponResponse(
                        coupon=None,
                        success=False,
                        message="Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM:SS"
                    )

            # Create coupon
            coupon = Coupon(
                code=code,
                name=name,
                discount_percentage=discount_percentage,
                valid_until=valid_until_date,
                is_active=True
            )
            coupon.save()

            return CreateCouponResponse(
                coupon=coupon,
                success=True,
                message="Coupon created successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return CreateCouponResponse(
                coupon=None,
                success=False,
                message=f"Error creating coupon: {str(e)}"
            )

class UseCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        booking_amount = Float(required=True)

    Output = UseCouponResponse

    def mutate(self, info, code, booking_amount):
        try:
            coupon = Coupon.query.filter_by(code=code).first()
            
            if not coupon:
                return UseCouponResponse(
                    success=False,
                    message="Coupon not found",
                    discount_amount=0.0
                )

            if not coupon.is_active:
                return UseCouponResponse(
                    success=False,
                    message="Coupon is not active",
                    discount_amount=0.0
                )

            if coupon.valid_until < datetime.utcnow():
                return UseCouponResponse(
                    success=False,
                    message="Coupon has expired",
                    discount_amount=0.0
                )

            # Calculate discount
            discount_amount = booking_amount * (coupon.discount_percentage / 100)

            return UseCouponResponse(
                success=True,
                message=f"Coupon applied successfully. {coupon.discount_percentage}% discount",
                discount_amount=discount_amount
            )
        except Exception as e:
            traceback.print_exc()
            return UseCouponResponse(
                success=False,
                message=f"Error applying coupon: {str(e)}",
                discount_amount=0.0
            )

class GenerateLoyaltyCoupon(Mutation):
    class Arguments:
        user_id = Int(required=True)
        booking_count = Int(required=True)

    Output = CreateCouponResponse

    def mutate(self, info, user_id, booking_count):
        try:
            # Generate loyalty coupon based on booking count
            if booking_count >= 10:
                discount = 20.0
                coupon_name = "Platinum Loyalty Coupon"
            elif booking_count >= 5:
                discount = 15.0
                coupon_name = "Gold Loyalty Coupon"
            elif booking_count >= 3:
                discount = 10.0
                coupon_name = "Silver Loyalty Coupon"
            else:
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Not enough bookings for loyalty coupon"
                )

            # Generate unique coupon code
            import uuid
            coupon_code = f"LOYALTY_{user_id}_{uuid.uuid4().hex[:8].upper()}"

            # Set expiry to 30 days from now
            from datetime import timedelta
            expiry_date = datetime.utcnow() + timedelta(days=30)

            coupon = Coupon(
                code=coupon_code,
                name=coupon_name,
                discount_percentage=discount,
                valid_until=expiry_date,
                is_active=True
            )
            coupon.save()

            return CreateCouponResponse(
                coupon=coupon,
                success=True,
                message=f"Loyalty coupon generated with {discount}% discount"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return CreateCouponResponse(
                coupon=None,
                success=False,
                message=f"Error generating loyalty coupon: {str(e)}"
            )

class UpdateCoupon(Mutation):
    class Arguments:
        id = Int(required=True)
        name = String()
        discount_percentage = Float()
        valid_until = String()
        is_active = Boolean()

    coupon = Field(CouponType)

    def mutate(self, info, id, name=None, discount_percentage=None, valid_until=None, is_active=None):
        try:
            coupon = Coupon.query.get(id)
            if not coupon:
                raise Exception(f"Coupon with ID {id} not found")

            if name:
                coupon.name = name
            if discount_percentage is not None:
                coupon.discount_percentage = discount_percentage
            if valid_until:
                try:
                    coupon.valid_until = datetime.strptime(valid_until, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    coupon.valid_until = datetime.strptime(valid_until, '%Y-%m-%d')
            if is_active is not None:
                coupon.is_active = is_active

            coupon.save()
            return UpdateCoupon(coupon=coupon)
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            raise Exception(f"Error updating coupon: {str(e)}")

class DeleteCouponResponse(ObjectType):
    success = Boolean()
    message = String()

class DeleteCoupon(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteCouponResponse

    def mutate(self, info, id):
        try:
            coupon = Coupon.query.get(id)
            if not coupon:
                return DeleteCouponResponse(
                    success=False,
                    message=f"Coupon with ID {id} not found"
                )

            coupon.delete()
            return DeleteCouponResponse(
                success=True,
                message=f"Coupon with ID {id} deleted successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteCouponResponse(
                success=False,
                message=f"Error deleting coupon: {str(e)}"
            )

class VerifyToken(Mutation):
    class Arguments:
        token = String(required=True)

    Output = TokenVerificationResponse

    def mutate(self, info, token):
        try:
            print(f"Verifying token: {token[:20]}...")  # Debug log (show only first 20 chars)
            
            result = verify_token(token)
            if result['valid']:
                print(f"Token valid for user_id: {result['user_id']}, role: {result['role']}")  # Debug log
                return TokenVerificationResponse(
                    valid=True,
                    userId=result['user_id'],  # Changed to userId
                    role=result['role']
                )
            else:
                print(f"Token invalid: {result.get('error', 'Unknown error')}")  # Debug log
                return TokenVerificationResponse(
                    valid=False,
                    error=result.get('error', 'Invalid token')
                )
        except Exception as e:
            print(f"Token verification error: {str(e)}")  # Debug log
            traceback.print_exc()
            return TokenVerificationResponse(
                valid=False,
                error=f"Token verification failed: {str(e)}"
            )

    def resolve_verify_token(self, info, token):
        try:
            print(f"Resolving verify_token query")  # Debug log
            result = verify_token(token)
            if result['valid']:
                return TokenVerificationResponse(
                    valid=True,
                    userId=result['user_id'],  # Changed to userId
                    role=result['role']
                )
            else:
                return TokenVerificationResponse(
                    valid=False,
                    error=result.get('error', 'Invalid token')
                )
        except Exception as e:
            print(f"Error in resolve_verify_token: {str(e)}")  # Debug log
            traceback.print_exc()
            return TokenVerificationResponse(
                valid=False,
                error=f"Token verification failed: {str(e)}"
            )

class Mutation(ObjectType):
    create_coupon = CreateCoupon.Field()
    use_coupon = UseCoupon.Field()
    generate_loyalty_coupon = GenerateLoyaltyCoupon.Field()
    update_coupon = UpdateCoupon.Field()
    delete_coupon = DeleteCoupon.Field()
    verify_token = VerifyToken.Field()

schema = Schema(query=Query, mutation=Mutation)