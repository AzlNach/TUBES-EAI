from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False)
    booking_id = db.Column(db.Integer, nullable=False)  # Changed from order_id to booking_id
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), default='CREDIT_CARD')  # Missing column
    status = db.Column(db.String(50), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get_by_id(cls, payment_id):
        return cls.query.get(payment_id)

    @classmethod
    def all(cls):
        return cls.query.all()

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()