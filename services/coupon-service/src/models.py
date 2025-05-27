from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Coupon(db.Model):
    __tablename__ = 'coupons'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    discount = db.Column(db.Float, nullable=False)
    expiration_date = db.Column(db.DateTime, nullable=False)

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Coupon(id={self.id}, code='{self.code}', discount={self.discount}, expiration_date='{self.expiration_date}')>"