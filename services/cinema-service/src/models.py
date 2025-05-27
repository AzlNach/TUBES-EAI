from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Cinema(db.Model):
    __tablename__ = 'cinemas'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(255), nullable=False)

    def save(self):
        db.session.add(self)
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def __repr__(self):
        return f"<Cinema(id={self.id}, name='{self.name}', location='{self.location}')>"