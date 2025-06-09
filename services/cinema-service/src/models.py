from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Cinema(db.Model):
    __tablename__ = 'cinemas'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    city = db.Column(db.String(100), nullable=False)  # Changed from location to city
    capacity = db.Column(db.Integer, nullable=False, default=100)

    # Relationship
    auditoriums = db.relationship('Auditorium', backref='cinema', lazy=True, cascade='all, delete-orphan')

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Cinema(id={self.id}, name='{self.name}', city='{self.city}', capacity={self.capacity})>"


class Auditorium(db.Model):
    __tablename__ = 'auditoriums'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    cinema_id = db.Column(db.Integer, db.ForeignKey('cinemas.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    seat_layout = db.Column(db.JSON, nullable=True)  # JSON field for seat layout

    # Relationships
    showtimes = db.relationship('Showtime', backref='auditorium', lazy=True, cascade='all, delete-orphan')

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Auditorium(id={self.id}, cinema_id={self.cinema_id}, name='{self.name}')>"


class Showtime(db.Model):
    __tablename__ = 'showtimes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    movie_id = db.Column(db.Integer, nullable=False)  # Reference to movie service
    auditorium_id = db.Column(db.Integer, db.ForeignKey('auditoriums.id'), nullable=False)
    start_time = db.Column(db.String(50), nullable=False)  # Changed from DateTime to String
    price = db.Column(db.Numeric(10, 2), nullable=False)

    # Relationships
    seat_statuses = db.relationship('SeatStatus', backref='showtime', lazy=True, cascade='all, delete-orphan')

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Showtime(id={self.id}, movie_id='{self.movie_id}', auditorium_id={self.auditorium_id}, start_time='{self.start_time}')>"


class SeatStatus(db.Model):
    __tablename__ = 'seat_statuses'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    showtime_id = db.Column(db.Integer, db.ForeignKey('showtimes.id'), nullable=False)
    seat_number = db.Column(db.String(10), nullable=False)
    status = db.Column(db.Enum('AVAILABLE', 'BOOKED', 'RESERVED', name='seat_status_enum'), 
                      nullable=False, default='AVAILABLE')
    booking_id = db.Column(db.Integer, nullable=True)  # Reference to booking service
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<SeatStatus(id={self.id}, showtime_id={self.showtime_id}, seat_number='{self.seat_number}', status='{self.status}')>"