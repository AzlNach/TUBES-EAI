from flask_sqlalchemy import SQLAlchemy
from datetime import date

db = SQLAlchemy()

class Movie(db.Model):
    __tablename__ = 'movies'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(255), nullable=False)
    genre = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # Duration in minutes
    description = db.Column(db.Text, nullable=True)
    release_date = db.Column(db.Date, nullable=True)  # Added missing column

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Movie(id={self.id}, title='{self.title}', genre='{self.genre}', duration={self.duration})>"