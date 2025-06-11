from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import random
import string

db = SQLAlchemy()

class Coupon(db.Model):
    __tablename__ = 'coupons'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    discount_percentage = db.Column(db.Float, nullable=False)
    valid_until = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    stock = db.Column(db.Integer, nullable=False, default=1)  # Stok coupon
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()
    
    def __repr__(self):
        return f"<Coupon(id={self.id}, code='{self.code}', name='{self.name}', stock={self.stock})>"

class UserCouponUsage(db.Model):
    """Track coupon usage per user"""
    __tablename__ = 'user_coupon_usage'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False)
    coupon_id = db.Column(db.Integer, db.ForeignKey('coupons.id'), nullable=False)
    used_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    coupon = db.relationship('Coupon', backref='usage_records')
    
    def save(self):
        db.session.add(self)
        db.session.commit()


class UserPaymentCount(db.Model):
    """Track payment count per user for coupon eligibility"""
    __tablename__ = 'user_payment_count'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, unique=True, nullable=False)
    payment_count = db.Column(db.Integer, default=0)
    last_coupon_earned = db.Column(db.Integer, default=0)  # Payment count when last coupon was earned
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def save(self):
        db.session.add(self)
        db.session.commit()
    
    @classmethod
    def get_or_create(cls, user_id):
        """Get existing record or create new one"""
        record = cls.query.filter_by(user_id=user_id).first()
        if not record:
            record = cls(user_id=user_id)
            record.save()
        return record
    
    def is_eligible_for_coupon(self):
        """Check if user is eligible for a new coupon"""
        return (self.payment_count - self.last_coupon_earned) >= 3
    
    def mark_coupon_earned(self):
        """Mark that user has earned a coupon"""
        self.last_coupon_earned = self.payment_count
        self.save()