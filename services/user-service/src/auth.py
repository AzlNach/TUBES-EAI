from datetime import datetime, timedelta
import jwt
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from models import User
from functools import wraps
import os

# JWT Secret Key
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-here-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DELTA = timedelta(days=1)

def create_token(user_id):
    """Create JWT token for user"""
    try:
        user = User.get_by_id(user_id)
        if not user:
            return None
            
        payload = {
            'user_id': user_id,
            'role': user.role,
            'exp': datetime.utcnow() + JWT_EXPIRATION_DELTA,
            'iat': datetime.utcnow()
        }
        
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return token
    except Exception as e:
        print(f"Error creating token: {str(e)}")
        return None

def verify_token(token):
    """Verify JWT token and return user info"""
    try:
        if not token:
            return {'valid': False, 'error': 'Token is missing'}
            
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
            
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check if user still exists
        user = User.get_by_id(payload['user_id'])
        if not user:
            return {'valid': False, 'error': 'User not found'}
            
        return {
            'valid': True,
            'user_id': payload['user_id'],
            'role': payload.get('role', 'USER')
        }
    except jwt.ExpiredSignatureError:
        return {'valid': False, 'error': 'Token has expired'}
    except jwt.InvalidTokenError:
        return {'valid': False, 'error': 'Invalid token'}
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        return {'valid': False, 'error': f'Token verification failed: {str(e)}'}

def require_role(required_role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': 'Authorization header missing'}), 401
            
            try:
                token = auth_header.split(' ')[1]
                payload = verify_token(token)
                
                if not payload['valid']:
                    return jsonify({'error': 'Invalid token'}), 401
                
                user_role = payload['role']
                
                # Admin can access everything
                if user_role == 'ADMIN':
                    return f(*args, **kwargs)
                
                # Check if user has required role
                if user_role != required_role:
                    return jsonify({'error': 'Insufficient permissions'}), 403
                
                # Add user info to kwargs
                kwargs['current_user'] = payload
                return f(*args, **kwargs)
                
            except Exception as e:
                return jsonify({'error': f'Token verification failed: {str(e)}'}), 401
        
        return decorated_function
    return decorator

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Authorization header missing'}), 401
        
        try:
            token = auth_header.split(' ')[1]
            payload = verify_token(token)
            
            if not payload['valid']:
                return jsonify({'error': 'Invalid token'}), 401
            
            if payload['role'] != 'ADMIN':
                return jsonify({'error': 'Admin access required'}), 403
            
            kwargs['current_user'] = payload
            return f(*args, **kwargs)
            
        except Exception as e:
            return jsonify({'error': f'Token verification failed: {str(e)}'}), 401
    
    return decorated_function

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