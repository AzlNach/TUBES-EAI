from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

db = SQLAlchemy()

class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False)
    booking_id = db.Column(db.Integer, nullable=False, unique=True)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), default='CREDIT_CARD')
    status = db.Column(db.Enum('pending', 'success', 'failed', name='payment_status_enum'), 
                      nullable=False, default='pending')  # Only 3 statuses
    payment_proof_image = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get_by_booking(cls, booking_id):
        """Get payment by booking ID"""
        return cls.query.filter_by(booking_id=booking_id).first()
    
    @classmethod
    def get_by_user(cls, user_id):
        return cls.query.filter_by(user_id=user_id).all()
    
    def save(self):
        try:
            db.session.add(self)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error saving payment: {e}")
            return False

    def can_be_deleted_by_user(self):
        """Check if payment can be deleted (only failed payments within 2 hours)"""
        time_diff = datetime.utcnow() - self.created_at
        return self.status == 'failed' and time_diff <= timedelta(hours=2)