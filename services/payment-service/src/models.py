from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import enum

db = SQLAlchemy()

# Define payment status enum
class PaymentStatus(enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False)
    booking_id = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), default='CREDIT_CARD')
    status = db.Column(db.String(50), nullable=False, default='pending')
    payment_proof_image = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get_by_id(cls, payment_id):
        return cls.query.get(payment_id)

    @classmethod
    def all(cls):
        return cls.query.all()
    
    @classmethod
    def get_by_user(cls, user_id):
        return cls.query.filter_by(user_id=user_id).all()

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()
    
    def can_be_deleted_by_user(self):
        """Check if payment can be deleted (within 2 hours of creation)"""
        if self.status != 'pending':
            return False
        time_diff = datetime.utcnow() - self.created_at
        return time_diff.total_seconds() < 7200  # 2 hours in seconds
    
    def auto_approve_payment(self):
        """Automatically approve payment if proof image is provided"""
        if self.payment_proof_image and self.status == 'pending':
            self.status = 'paid'
            self.updated_at = datetime.utcnow()
            self.save()
            return True
        return False
    
    def is_expired(self):
        """Check if payment is expired (24 hours without proof)"""
        time_diff = datetime.utcnow() - self.created_at
        return time_diff.total_seconds() > 86400  # 24 hours in seconds
    
    def auto_expire_if_needed(self):
        """Automatically expire payment if no proof uploaded within 24 hours"""
        if self.status == 'pending' and self.is_expired() and not self.payment_proof_image:
            self.status = 'failed'
            self.updated_at = datetime.utcnow()
            self.save()
            return True
        return False

    def __repr__(self):
        return f"<Payment(id={self.id}, user_id={self.user_id}, amount={self.amount}, status='{self.status}')>"