from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema
from models import Payment, db

class PaymentType(ObjectType):
    id = Int()
    amount = Float()
    status = String()
    user_id = Int()
    order_id = Int()

class CreatePayment(Mutation):
    class Arguments:
        amount = Float(required=True)
        user_id = Int(required=True)
        order_id = Int(required=True)

    payment = Field(PaymentType)

    def mutate(self, info, amount, user_id, order_id):
        payment = Payment(amount=amount, user_id=user_id, order_id=order_id, status="pending")
        payment.save()
        return CreatePayment(payment=payment)

class UpdatePayment(Mutation):
    class Arguments:
        payment_id = Int(required=True)
        amount = Float()
        status = String()

    payment = Field(PaymentType)

    def mutate(self, info, payment_id, amount=None, status=None):
        payment = Payment.get_by_id(payment_id)
        if payment:
            if amount is not None:
                payment.amount = amount
            if status is not None:
                payment.status = status
            payment.save()
        return UpdatePayment(payment=payment)

class DeletePayment(Mutation):
    class Arguments:
        payment_id = Int(required=True)

    success = String()

    def mutate(self, info, payment_id):
        payment = Payment.get_by_id(payment_id)
        if payment:
            payment.delete()
            return DeletePayment(success="Payment deleted successfully.")
        return DeletePayment(success="Payment not found.")

class Query(ObjectType):
    payments = List(PaymentType)

    def resolve_payments(self, info):
        return Payment.all()

class Mutation(ObjectType):
    create_payment = CreatePayment.Field()
    update_payment = UpdatePayment.Field()
    delete_payment = DeletePayment.Field()

schema = Schema(query=Query, mutation=Mutation)