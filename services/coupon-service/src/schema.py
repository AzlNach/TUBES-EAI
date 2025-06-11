from graphene import ObjectType, String, Float, Int, List, Field, Mutation, Schema, Boolean
from models import Coupon, UserCouponUsage, UserPaymentCount, db
from datetime import datetime, timedelta
import requests
import os
import traceback
import uuid 

class CouponType(ObjectType):
    id = Int()
    code = String()
    name = String()
    discountPercentage = Float()
    validUntil = String()
    isActive = Boolean()
    stock = Int()
    createdAt = String()
    updatedAt = String()

    def resolve_discountPercentage(self, info):
        return self.discount_percentage
    
    def resolve_validUntil(self, info):
        if hasattr(self, 'valid_until') and self.valid_until:
            return self.valid_until.strftime('%Y-%m-%d %H:%M:%S')
        return None
    
    def resolve_isActive(self, info):
        return self.is_active
    
    def resolve_createdAt(self, info):
        if hasattr(self, 'created_at') and self.created_at:
            return self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        return None
    
    def resolve_updatedAt(self, info):
        if hasattr(self, 'updated_at') and self.updated_at:
            return self.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        return None

class UserEligibilityType(ObjectType):
    userId = Int()          # ✓ Changed from user_id to userId (camelCase)
    paymentCount = Int()    # ✓ Changed from payment_count to paymentCount
    isEligible = Boolean()  # ✓ Changed from is_eligible to isEligible  
    paymentsNeeded = Int()  # ✓ Changed from payments_needed to paymentsNeeded

class CreateCouponResponse(ObjectType):
    coupon = Field(CouponType)
    success = Boolean()
    message = String()

class RedeemCouponResponse(ObjectType):
    success = Boolean()
    message = String()
    discountAmount = Float()  # ✓ Changed from discount_amount to discountAmount
    coupon = Field(CouponType)

class Query(ObjectType):
    coupons = List(CouponType)
    availableCoupons = List(CouponType)
    coupon = Field(CouponType, id=Int(required=True))
    userEligibility = Field(UserEligibilityType, userId=Int(required=True))  # ✓ Changed from user_id to userId

    def resolve_coupons(self, info):
        try:
            return Coupon.query.all()
        except Exception as e:
            print(f"Error in resolve_coupons: {str(e)}")
            return []

    def resolve_availableCoupons(self, info):
        try:
            return Coupon.query.filter(
                Coupon.is_active == True,
                Coupon.valid_until >= datetime.utcnow(),
                Coupon.stock > 0
            ).all()
        except Exception as e:
            print(f"Error in resolve_available_coupons: {str(e)}")
            return []

    def resolve_coupon(self, info, id):
        try:
            return Coupon.query.get(id)
        except Exception as e:
            print(f"Error in resolve_coupon: {str(e)}")
            return None
    
    def resolve_userEligibility(self, info, userId):  # ✓ Changed parameter name
        try:
            payment_record = UserPaymentCount.get_or_create(userId)
            is_eligible = payment_record.is_eligible_for_coupon()
            payments_needed = max(0, 3 - (payment_record.payment_count - payment_record.last_coupon_earned))
            
            return UserEligibilityType(
                userId=userId,                    # ✓ Changed field name
                paymentCount=payment_record.payment_count,  # ✓ Changed field name
                isEligible=is_eligible,          # ✓ Changed field name
                paymentsNeeded=payments_needed   # ✓ Changed field name
            )
        except Exception as e:
            print(f"Error in resolve_userEligibility: {str(e)}")
            return None

class CreateCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        name = String(required=True)
        discount_percentage = Float(required=True)
        valid_until = String(required=True)
        stock = Int(required=True)
    
    Output = CreateCouponResponse

    def mutate(self, info, code, name, discount_percentage, valid_until, stock):
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
                stock=stock,
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

class RedeemCoupon(Mutation):
    class Arguments:
        userId = Int(required=True)
        code = String(required=True)
        bookingAmount = Float(required=True)
    
    Output = RedeemCouponResponse

    def mutate(self, info, userId, code, bookingAmount):
        try:
            print(f"DEBUG: RedeemCoupon - userId={userId}, code={code}, amount={bookingAmount}")
            
            # Check user eligibility
            payment_record = UserPaymentCount.get_or_create(userId)
            print(f"DEBUG: Payment record - count={payment_record.payment_count}, last_coupon={payment_record.last_coupon_earned}")
            
            if not payment_record.is_eligible_for_coupon():
                payments_needed = max(0, 3 - (payment_record.payment_count - payment_record.last_coupon_earned))
                print(f"DEBUG: User not eligible - needs {payments_needed} more payments")
                return RedeemCouponResponse(
                    success=False,
                    message=f"You need {payments_needed} more payments to redeem a coupon",
                    discountAmount=0.0,
                    coupon=None
                )

            # Find coupon
            coupon = Coupon.query.filter_by(code=code, is_active=True).first()
            print(f"DEBUG: Found coupon - {coupon}")
            
            if not coupon:
                return RedeemCouponResponse(
                    success=False,
                    message="Coupon not found or inactive",
                    discountAmount=0.0,
                    coupon=None
                )

            # Check if coupon is still valid
            if coupon.valid_until < datetime.utcnow():
                return RedeemCouponResponse(
                    success=False,
                    message="Coupon has expired",
                    discountAmount=0.0,
                    coupon=None
                )

            # Check stock
            if coupon.stock <= 0:
                return RedeemCouponResponse(
                    success=False,
                    message="Coupon is out of stock",
                    discountAmount=0.0,
                    coupon=None
                )

            # Check if user already used this coupon
            existing_usage = UserCouponUsage.query.filter_by(
                user_id=userId,
                coupon_id=coupon.id
            ).first()
            
            if existing_usage:
                return RedeemCouponResponse(
                    success=False,
                    message="You have already used this coupon",
                    discountAmount=0.0,
                    coupon=None
                )

            # ✅ START TRANSACTION
            try:
                # Calculate discount
                discount_amount = (bookingAmount * coupon.discount_percentage) / 100.0
                print(f"DEBUG: Calculated discount = {discount_amount}")

                # Record usage
                usage = UserCouponUsage(
                    user_id=userId,
                    coupon_id=coupon.id
                )
                db.session.add(usage)
                print(f"DEBUG: Added usage record")

                # Decrease stock
                coupon.stock -= 1
                db.session.add(coupon)
                print(f"DEBUG: Updated stock to {coupon.stock}")

                # Mark coupon as earned
                payment_record.mark_coupon_earned()
                print(f"DEBUG: Marked coupon as earned")

                # Commit all changes
                db.session.commit()
                print(f"DEBUG: Transaction committed successfully")

                return RedeemCouponResponse(
                    success=True,
                    message=f"Coupon redeemed successfully. {coupon.discount_percentage}% discount applied",
                    discountAmount=discount_amount,
                    coupon=coupon
                )

            except Exception as e:
                db.session.rollback()
                print(f"ERROR: Transaction failed - {str(e)}")
                raise e

        except Exception as e:
            print(f"ERROR: RedeemCoupon failed - {str(e)}")
            db.session.rollback()
            traceback.print_exc()
            return RedeemCouponResponse(
                success=False,
                message=f"Internal error: {str(e)}",
                discountAmount=0.0,
                coupon=None
            )
            
class UpdatePaymentCount(Mutation):
    class Arguments:
        userId = Int(required=True)  # ✓ Changed from user_id to userId
    
    Output = UserEligibilityType

    def mutate(self, info, userId):  # ✓ Changed parameter name
        try:
            payment_record = UserPaymentCount.get_or_create(userId)
            payment_record.payment_count += 1
            payment_record.save()
            
            is_eligible = payment_record.is_eligible_for_coupon()
            payments_needed = max(0, 3 - (payment_record.payment_count - payment_record.last_coupon_earned))
            
            return UserEligibilityType(
                userId=userId,                    # ✓ Changed field name
                paymentCount=payment_record.payment_count,  # ✓ Changed field name
                isEligible=is_eligible,          # ✓ Changed field name
                paymentsNeeded=payments_needed   # ✓ Changed field name
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return None

class Mutation(ObjectType):
    create_coupon = CreateCoupon.Field()
    redeem_coupon = RedeemCoupon.Field()
    update_payment_count = UpdatePaymentCount.Field()

schema = Schema(query=Query, mutation=Mutation)