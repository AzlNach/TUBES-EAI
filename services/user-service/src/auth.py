from datetime import datetime, timedelta
import jwt
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from models import User

SECRET_KEY = "your_secret_key"  # Replace with your actual secret key

def create_token(user_id):
    expiration = datetime.utcnow() + timedelta(days=1)
    token = jwt.encode({'user_id': user_id, 'exp': expiration}, SECRET_KEY, algorithm='HS256')
    return token

def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def register_user(username, password):
    hashed_password = generate_password_hash(password, method='sha256')
    # Save the user to the database (implement database logic here)
    return {"message": "User registered successfully"}

def login_user(username, password):
    # Retrieve user from the database (implement database logic here)
    user = None  # Replace with actual user retrieval logic
    if user and check_password_hash(user['password'], password):
        token = create_token(user['id'])
        return {"token": token}
    return {"message": "Invalid credentials"}, 401

def get_user_profile(user_id):
    # Retrieve user profile from the database (implement database logic here)
    user = None  # Replace with actual user retrieval logic
    if user:
        return {"username": user['username'], "email": user['email']}
    return {"message": "User not found"}, 404