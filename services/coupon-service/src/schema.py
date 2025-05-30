from graphene import ObjectType, String, Float, Int, List, Field, Mutation, Schema, Boolean
from models import Coupon, db
from datetime import datetime

class CouponType(ObjectType):
    id = Int()
    code = String()
    discount_percentage = Float()
    valid_until = String()
    is_active = Boolean()

class Query(ObjectType):
    coupons = List(CouponType)
    coupon = Field(CouponType, id=Int(required=True))

    def resolve_coupons(self, info):
        return Coupon.query.all()

    def resolve_coupon(self, info, id):
        return Coupon.query.get(id)

class CreateCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        discount_percentage = Float(required=True)
        valid_until = String(required=True)
        is_active = Boolean()

    coupon = Field(CouponType)

    def mutate(self, info, code, discount_percentage, valid_until, is_active=True):
        try:
            exp_date = datetime.strptime(valid_until, '%Y-%m-%d')
            new_coupon = Coupon(
                code=code, 
                discount_percentage=discount_percentage, 
                valid_until=exp_date,
                is_active=is_active
            )
            new_coupon.save()
            return CreateCoupon(coupon=new_coupon)
        except ValueError:
            raise Exception("Invalid date format. Use YYYY-MM-DD")

class UpdateCoupon(Mutation):
    class Arguments:
        id = Int(required=True)
        code = String()
        discount_percentage = Float()
        valid_until = String()
        is_active = Boolean()

    coupon = Field(CouponType)

    def mutate(self, info, id, code=None, discount_percentage=None, valid_until=None, is_active=None):
        coupon = Coupon.query.get(id)
        if coupon:
            if code:
                coupon.code = code
            if discount_percentage:
                coupon.discount_percentage = discount_percentage
            if valid_until:
                try:
                    coupon.valid_until = datetime.strptime(valid_until, '%Y-%m-%d')
                except ValueError:
                    raise Exception("Invalid date format. Use YYYY-MM-DD")
            if is_active is not None:
                coupon.is_active = is_active
            coupon.save()
            return UpdateCoupon(coupon=coupon)
        return UpdateCoupon(coupon=None)

class DeleteCoupon(Mutation):
    class Arguments:
        id = Int(required=True)

    success = String()

    def mutate(self, info, id):
        coupon = Coupon.query.get(id)
        if coupon:
            coupon.delete()
            return DeleteCoupon(success="Coupon deleted successfully.")
        return DeleteCoupon(success="Coupon not found.")

class Mutation(ObjectType):
    create_coupon = CreateCoupon.Field()
    update_coupon = UpdateCoupon.Field()
    delete_coupon = DeleteCoupon.Field()

schema = Schema(query=Query, mutation=Mutation)

mutation_query = '''
mutation($code: String!, $discount_percentage: Float!, $valid_until: String!, $is_active: Boolean) {
    createCoupon(code: $code, discount_percentage: $discount_percentage, valid_until: $valid_until, is_active: $is_active) {
        coupon {
            id
            # ... other fields
        }
    }
}
'''