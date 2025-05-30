from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, nullable=False)
    movie_id = db.Column(db.Integer, nullable=False)
    cinema_id = db.Column(db.Integer, nullable=False)
    showtime = db.Column(db.String(50), nullable=False)
    seats = db.Column(db.Text, nullable=True)  # Added missing column
    total_price = db.Column(db.Float, nullable=True)  # Added missing column
    status = db.Column(db.String(50), default='PENDING')  # Added missing column
    booking_date = db.Column(db.DateTime, default=datetime.utcnow)

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Booking(id={self.id}, user_id={self.user_id}, movie_id={self.movie_id}, status='{self.status}')>"