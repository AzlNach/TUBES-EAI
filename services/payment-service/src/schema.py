from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema
from models import Payment, db
from datetime import datetime

class PaymentType(ObjectType):
    id = Int()
    amount = Float()
    payment_method = String()
    status = String()
    user_id = Int()
    booking_id = Int()
    created_at = String()
    updated_at = String()

class CreatePayment(Mutation):
    class Arguments:
        amount = Float(required=True)
        user_id = Int(required=True)
        booking_id = Int(required=True)
        payment_method = String()

    payment = Field(PaymentType)

    def mutate(self, info, amount, user_id, booking_id, payment_method='CREDIT_CARD'):
        payment = Payment(
            amount=amount, 
            user_id=user_id, 
            booking_id=booking_id, 
            payment_method=payment_method,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        payment.save()
        return CreatePayment(payment=payment)

class UpdatePayment(Mutation):
    class Arguments:
        id = Int(required=True)  # Changed from payment_id to id to match model
        amount = Float()
        status = String()
        payment_method = String()

    payment = Field(PaymentType)

    def mutate(self, info, id, amount=None, status=None, payment_method=None):
        payment = Payment.get_by_id(id)  # Changed from payment_id to id
        if payment:
            if amount is not None:
                payment.amount = amount
            if status is not None:
                payment.status = status
            if payment_method is not None:
                payment.payment_method = payment_method
            payment.updated_at = datetime.utcnow()
            payment.save()
        return UpdatePayment(payment=payment)

class DeletePayment(Mutation):
    class Arguments:
        id = Int(required=True)  # Changed from payment_id to id to match model

    success = String()

    def mutate(self, info, id):  # Changed from payment_id to id
        payment = Payment.get_by_id(id)
        if payment:
            payment.delete()
            return DeletePayment(success="Payment deleted successfully.")
        return DeletePayment(success="Payment not found.")

class Query(ObjectType):
    payments = List(PaymentType)
    payment = Field(PaymentType, id=Int(required=True))

    def resolve_payments(self, info):
        return Payment.all()
        
    def resolve_payment(self, info, id):
        return Payment.get_by_id(id)

class Mutation(ObjectType):
    create_payment = CreatePayment.Field()
    update_payment = UpdatePayment.Field()
    delete_payment = DeletePayment.Field()

schema = Schema(query=Query, mutation=Mutation)

mutation_query = '''
mutation($amount: Float!, $user_id: Int!, $booking_id: Int!, $payment_method: String) {
    createPayment(amount: $amount, user_id: $user_id, booking_id: $booking_id, payment_method: $payment_method) {
        payment {
            id
            # ... other fields
        }
    }
}
'''