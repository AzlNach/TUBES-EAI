from graphene import ObjectType, String, Float, Int, List, Field, Mutation, Schema
from models import Coupon, db
from datetime import datetime

class CouponType(ObjectType):
    id = Int()
    code = String()
    discount = Float()
    expiration_date = String()

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
        discount = Float(required=True)
        expiration_date = String(required=True)

    coupon = Field(CouponType)

    def mutate(self, info, code, discount, expiration_date):
        try:
            exp_date = datetime.strptime(expiration_date, '%Y-%m-%d')
            new_coupon = Coupon(code=code, discount=discount, expiration_date=exp_date)
            new_coupon.save()
            return CreateCoupon(coupon=new_coupon)
        except ValueError:
            raise Exception("Invalid date format. Use YYYY-MM-DD")

class UpdateCoupon(Mutation):
    class Arguments:
        id = Int(required=True)
        code = String()
        discount = Float()
        expiration_date = String()

    coupon = Field(CouponType)

    def mutate(self, info, id, code=None, discount=None, expiration_date=None):
        coupon = Coupon.query.get(id)
        if coupon:
            if code:
                coupon.code = code
            if discount:
                coupon.discount = discount
            if expiration_date:
                try:
                    coupon.expiration_date = datetime.strptime(expiration_date, '%Y-%m-%d')
                except ValueError:
                    raise Exception("Invalid date format. Use YYYY-MM-DD")
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