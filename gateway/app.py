from flask import Flask, request, jsonify, redirect, render_template_string
import requests
import os
import json
import asyncio
import aiohttp
from functools import wraps

app = Flask(__name__)

# Service URLs
SERVICE_URLS = {
    'user': os.getenv('USER_SERVICE_URL', 'http://user-service:3012'),
    'movie': os.getenv('MOVIE_SERVICE_URL', 'http://movie-service:3010'),
    'cinema': os.getenv('CINEMA_SERVICE_URL', 'http://cinema-service:3008'),
    'booking': os.getenv('BOOKING_SERVICE_URL', 'http://booking-service:3007'),
    'payment': os.getenv('PAYMENT_SERVICE_URL', 'http://payment-service:3011'),
    'coupon': os.getenv('COUPON_SERVICE_URL', 'http://coupon-service:3009')
}

# Decorator for token authentication
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        # Verify token with user service
        try:
            response = requests.post(
                f"{SERVICE_URLS['user']}/graphql",
                json={
                    'query': '''
                    query($token: String!) {
                        verifyToken(token: $token) {
                            valid
                            userId
                        }
                    }
                    ''',
                    'variables': {'token': token.split(' ')[1] if ' ' in token else token}
                }
            )
            
            result = response.json()
            if not result.get('data', {}).get('verifyToken', {}).get('valid', False):
                return jsonify({'message': 'Invalid token!'}), 401
                
            # Add user_id to kwargs for the endpoint to use
            kwargs['user_id'] = result['data']['verifyToken']['userId']
            
        except Exception as e:
            return jsonify({'message': f'Error verifying token: {str(e)}'}), 500
            
        return f(*args, **kwargs)
    
    return decorated

@app.route('/')
def index():
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cinema Microservices Gateway</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            h1 { color: #333; }
            .service-list { margin-top: 20px; }
            .service-item { margin-bottom: 10px; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <h1>Cinema Microservices Gateway</h1>
        <p>Welcome to the Cinema Microservices System. This gateway provides access to the following services:</p>
        
        <div class="service-list">
            <div class="service-item"><a href="/service/user/graphql">User Service</a></div>
            <div class="service-item"><a href="/service/movie/graphql">Movie Service</a></div>
            <div class="service-item"><a href="/service/cinema/graphql">Cinema Service</a></div>
            <div class="service-item"><a href="/service/booking/graphql">Booking Service</a></div>
            <div class="service-item"><a href="/service/payment/graphql">Payment Service</a></div>
            <div class="service-item"><a href="/service/coupon/graphql">Coupon Service</a></div>
        </div>
        
        <h2>API Endpoints</h2>
        <div class="service-list">
            <div class="service-item"><a href="/api/movies">All Movies</a></div>
            <div class="service-item"><a href="/api/cinemas">All Cinemas</a></div>
            <div class="service-item"><a href="/api/profile">User Profile (requires auth)</a></div>
            <div class="service-item"><a href="/api/bookings">User Bookings (requires auth)</a></div>
        </div>
    </body>
    </html>
    ''')

@app.route('/service/<service_name>/graphql', methods=['GET', 'POST'])
def proxy_service(service_name):
    if service_name not in SERVICE_URLS:
        return jsonify({"error": f"Service '{service_name}' not found"}), 404
    
    target_url = f"{SERVICE_URLS[service_name]}/graphql"
    
    if request.method == 'GET':
        resp = requests.get(target_url)
        return resp.text, resp.status_code
    
    elif request.method == 'POST':
        data = request.get_json()
        headers = {'Content-Type': 'application/json'}
        resp = requests.post(target_url, json=data, headers=headers)
        return jsonify(resp.json()), resp.status_code

# API Routes that combine data from multiple services
@app.route('/api/movies', methods=['GET'])
def get_movies():
    try:
        response = requests.post(
            f"{SERVICE_URLS['movie']}/graphql",
            json={'query': '{ movies { id title genre duration description release_date } }'}
        )
        return jsonify(response.json().get('data', {}).get('movies', [])), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cinemas', methods=['GET'])
def get_cinemas():
    try:
        response = requests.post(
            f"{SERVICE_URLS['cinema']}/graphql",
            json={'query': '{ cinemas { id name location capacity } }'}
        )
        return jsonify(response.json().get('data', {}).get('cinemas', [])), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(user_id):
    try:
        response = requests.post(
            f"{SERVICE_URLS['user']}/graphql",
            json={
                'query': '''
                query($id: Int!) {
                    user(id: $id) {
                        id
                        username
                        email
                        role
                    }
                }
                ''',
                'variables': {'id': user_id}
            }
        )
        return jsonify(response.json().get('data', {}).get('user', {})), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bookings', methods=['GET'])
@token_required
def get_user_bookings(user_id):
    try:
        # Get bookings for the user
        booking_response = requests.post(
            f"{SERVICE_URLS['booking']}/graphql",
            json={
                'query': '''
                query {
                    bookings {
                        id
                        user_id
                        movie_id
                        cinema_id
                        showtime
                        seats
                        total_price
                        status
                        booking_date
                    }
                }
                '''
            }
        )
        
        bookings = booking_response.json().get('data', {}).get('bookings', [])
        user_bookings = [b for b in bookings if b.get('user_id') == user_id]
        
        # If we have bookings, enrich them with movie and cinema details
        if user_bookings:
            # Get all movie IDs from bookings
            movie_ids = list(set(b.get('movie_id') for b in user_bookings))
            
            # Get all cinema IDs from bookings
            cinema_ids = list(set(b.get('cinema_id') for b in user_bookings))
            
            # Get movie details
            movies_response = requests.post(
                f"{SERVICE_URLS['movie']}/graphql",
                json={
                    'query': '{ movies { id title genre } }'
                }
            )
            movies = {m['id']: m for m in movies_response.json().get('data', {}).get('movies', [])}
            
            # Get cinema details
            cinemas_response = requests.post(
                f"{SERVICE_URLS['cinema']}/graphql",
                json={
                    'query': '{ cinemas { id name location } }'
                }
            )
            cinemas = {c['id']: c for c in cinemas_response.json().get('data', {}).get('cinemas', [])}
            
            # Enrich bookings with movie and cinema details
            for booking in user_bookings:
                movie_id = booking.get('movie_id')
                cinema_id = booking.get('cinema_id')
                
                if movie_id in movies:
                    booking['movie'] = movies[movie_id]
                
                if cinema_id in cinemas:
                    booking['cinema'] = cinemas[cinema_id]
        
        return jsonify(user_bookings), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)