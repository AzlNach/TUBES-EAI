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
    is_auto_generated = db.Column(db.Boolean, default=False)  # New field
    used_by_user_id = db.Column(db.Integer, nullable=True)  # New field
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @classmethod
    def generate_loyalty_coupon(cls, user_id, payment_count):
        """Generate automatic loyalty coupon based on payment count"""
        # Base discount of 10% + 5% for every 3 payments beyond the first 3
        discount = 10 + (((payment_count - 3) // 3) * 5)
        
        # Generate unique code
        code = f"LOYALTY{user_id}_{payment_count}_{cls._generate_random_string(6)}"
        
        # Valid for 30 days
        valid_until = datetime.utcnow() + timedelta(days=30)
        
        coupon = cls(
            code=code,
            name=f"Loyalty Discount {discount}% - {payment_count} Payments",
            discount_percentage=discount,
            valid_until=valid_until,
            is_active=True,
            is_auto_generated=True
        )
        return coupon
    
    @staticmethod
    def _generate_random_string(length):
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()
    
    def use_coupon(self, user_id):
        """Mark coupon as used by a specific user"""
        if self.used_by_user_id is not None:
            return False, "Coupon has already been used"
        
        if not self.is_active:
            return False, "Coupon is not active"
        
        if datetime.utcnow() > self.valid_until:
            return False, "Coupon has expired"
        
        self.used_by_user_id = user_id
        self.is_active = False
        self.save()
        return True, "Coupon used successfully"

    def __repr__(self):
        return f"<Coupon(id={self.id}, code='{self.code}', name='{self.name}', discount_percentage={self.discount_percentage}, valid_until='{self.valid_until}')>"