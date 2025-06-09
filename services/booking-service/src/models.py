from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)  # booking_id
    user_id = db.Column(db.Integer, nullable=False)
    showtime_id = db.Column(db.Integer, nullable=False)  # Changed from movie_id + cinema_id to showtime_id
    status = db.Column(db.Enum('PENDING', 'PAID', 'CANCELLED', name='booking_status_enum'), 
                      nullable=False, default='PENDING')
    total_price = db.Column(db.Numeric(10, 2), nullable=True)
    booking_date = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship with tickets
    tickets = db.relationship('Ticket', backref='booking', lazy=True, cascade='all, delete-orphan')

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Booking(id={self.id}, user_id={self.user_id}, showtime_id={self.showtime_id}, status='{self.status}')>"

class Ticket(db.Model):
    __tablename__ = 'tickets'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)  # ticket_id
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id'), nullable=False)
    seat_number = db.Column(db.String(10), nullable=False)

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Ticket(id={self.id}, booking_id={self.booking_id}, seat_number='{self.seat_number}')>"