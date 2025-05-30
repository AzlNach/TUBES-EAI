from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Coupon(db.Model):
    __tablename__ = 'coupons'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    discount_percentage = db.Column(db.Float, nullable=False)  # Changed from discount to match SQL
    valid_until = db.Column(db.DateTime, nullable=False)  # Changed from expiration_date to match SQL
    is_active = db.Column(db.Boolean, default=True)  # Missing column

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Coupon(id={self.id}, code='{self.code}', discount_percentage={self.discount_percentage}, valid_until='{self.valid_until}')>"