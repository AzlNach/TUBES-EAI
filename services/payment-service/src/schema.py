from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema, Boolean
from models import Payment, db
from datetime import datetime
import traceback

class PaymentType(ObjectType):
    id = Int()
    userId = Int()
    bookingId = Int()
    amount = Float()
    paymentMethod = String()
    status = String()  # Virtual field
    paymentProofImage = String()
    createdAt = String()
    updatedAt = String()
    canBeDeleted = Boolean()
    
    def resolve_status(self, info):
        """Virtual status field - always 'paid' since payment existence means it's paid"""
        return 'paid'
    
    def resolve_canBeDeleted(self, info):
        return self.can_be_deleted_by_user()

class CreatePaymentResponse(ObjectType):
    payment = Field(PaymentType)
    success = Boolean()
    message = String()

class CreatePayment(Mutation):
    class Arguments:
        userId = Int(required=True)
        bookingId = Int(required=True)
        amount = Float(required=True)
        paymentMethod = String()
        paymentProofImage = String()

    Output = CreatePaymentResponse

    def mutate(self, info, userId, bookingId, amount, paymentMethod='CREDIT_CARD', paymentProofImage=None):
        try:
            # Check if payment already exists for this booking
            existing_payment = Payment.get_by_booking(bookingId)
            if existing_payment:
                return CreatePaymentResponse(
                    payment=None,
                    success=False,
                    message=f"Payment already exists for booking {bookingId}"
                )
            
            # Create payment (no status needed - existence = paid)
            payment = Payment(
                user_id=userId,
                booking_id=bookingId,
                amount=amount,
                payment_method=paymentMethod,
                payment_proof_image=paymentProofImage
            )
            
            if payment.save():
                return CreatePaymentResponse(
                    payment=payment,
                    success=True,
                    message="Payment created successfully"
                )
            else:
                return CreatePaymentResponse(
                    payment=None,
                    success=False,
                    message="Failed to save payment"
                )
                
        except Exception as e:
            db.session.rollback()
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message=f"Error creating payment: {str(e)}"
            )

class UpdatePaymentResponse(ObjectType):
    payment = Field(PaymentType)
    success = Boolean()
    message = String()

class UpdatePayment(Mutation):
    class Arguments:
        id = Int(required=True)
        status = String()
        payment_proof_image = String()

    Output = UpdatePaymentResponse

    def mutate(self, info, id, status=None, payment_proof_image=None):
        try:
            payment = Payment.query.get(id)
            if not payment:
                return UpdatePaymentResponse(
                    payment=None,
                    success=False,
                    message=f"Payment with ID {id} not found"
                )
            
            if status:
                payment.status = status
            if payment_proof_image:
                payment.payment_proof_image = payment_proof_image
                
            payment.save()
            
            return UpdatePaymentResponse(
                payment=payment,
                success=True,
                message="Payment updated successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return UpdatePaymentResponse(
                payment=None,
                success=False,
                message=f"Error updating payment: {str(e)}"
            )

class DeletePaymentResponse(ObjectType):
    success = Boolean()
    message = String()

class DeletePayment(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeletePaymentResponse

    def mutate(self, info, id):
        try:
            payment = Payment.query.get(id)
            if not payment:
                return DeletePaymentResponse(
                    success=False,
                    message=f"Payment with ID {id} not found"
                )
            
            if not payment.can_be_deleted:
                return DeletePaymentResponse(
                    success=False,
                    message="This payment cannot be deleted"
                )
            
            payment.delete()
            return DeletePaymentResponse(
                success=True,
                message="Payment deleted successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return DeletePaymentResponse(
                success=False,
                message=f"Error deleting payment: {str(e)}"
            )

class Query(ObjectType):
    payments = List(PaymentType)
    payment = Field(PaymentType, id=Int(required=True))
    user_payments = List(PaymentType, userId=Int(required=True))  # ← Changed from user_id to userId
    pending_payments = List(PaymentType)
    expired_payments = List(PaymentType)

    def resolve_payments(self, info):
        try:
            return Payment.query.all()
        except Exception as e:
            print(f"Error in resolve_payments: {str(e)}")
            traceback.print_exc()
            return []
        
    def resolve_payment(self, info, id):
        try:
            return Payment.query.get(id)
        except Exception as e:
            print(f"Error in resolve_payment: {str(e)}")
            return None
    
    def resolve_user_payments(self, info, userId):  # ← Changed parameter name
        try:
            return Payment.query.filter(Payment.user_id == userId).all()
        except Exception as e:
            print(f"Error in resolve_user_payments: {str(e)}")
            traceback.print_exc()
            return []
    
    def resolve_pending_payments(self, info):
        try:
            return Payment.query.filter_by(status='pending').all()
        except Exception as e:
            print(f"Error in resolve_pending_payments: {str(e)}")
            traceback.print_exc()
            return []
    
    def resolve_expired_payments(self, info):
        try:
            all_pending = Payment.query.filter_by(status='pending').all()
            expired = [p for p in all_pending if hasattr(p, 'is_expired') and p.is_expired()]
            return expired
        except Exception as e:
            print(f"Error in resolve_expired_payments: {str(e)}")
            traceback.print_exc()
            return []

class Mutation(ObjectType):
    create_payment = CreatePayment.Field()
    update_payment = UpdatePayment.Field()
    delete_payment = DeletePayment.Field()

schema = Schema(query=Query, mutation=Mutation)