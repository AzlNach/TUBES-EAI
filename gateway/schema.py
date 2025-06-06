import graphene
import requests
import json
import os
from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema, Boolean
from functools import wraps

# Service URLs
SERVICE_URLS = {
    'user': os.getenv('USER_SERVICE_URL', 'http://user-service:3012'),
    'movie': os.getenv('MOVIE_SERVICE_URL', 'http://movie-service:3010'),
    'cinema': os.getenv('CINEMA_SERVICE_URL', 'http://cinema-service:3008'),
    'booking': os.getenv('BOOKING_SERVICE_URL', 'http://booking-service:3007'),
    'payment': os.getenv('PAYMENT_SERVICE_URL', 'http://payment-service:3011'),
    'coupon': os.getenv('COUPON_SERVICE_URL', 'http://coupon-service:3009')
}

def make_service_request(service_url, query_data, service_name="service"):
    """Helper function to make requests to services"""
    try:
        response = requests.post(
            f"{service_url}/graphql",
            json=query_data,
            timeout=30,
            headers={'Content-Type': 'application/json'}
        )
        
        content_type = response.headers.get('content-type', '')
        if 'text/html' in content_type:
            print(f"Service {service_name} returned HTML instead of JSON")
            return None
        
        try:
            return response.json()
        except json.JSONDecodeError:
            print(f"Service {service_name} returned invalid JSON")
            return None
            
    except requests.exceptions.ConnectionError:
        print(f"Cannot connect to {service_name} service at {service_url}")
        return None
    except requests.exceptions.Timeout:
        print(f"Timeout connecting to {service_name} service")
        return None
    except Exception as e:
        print(f"Error connecting to {service_name} service: {str(e)}")
        return None

def verify_token_from_context(info):
    """Extract and verify token from GraphQL context"""
    try:
        context = info.context
        authorization = context.get('Authorization') or context.get('HTTP_AUTHORIZATION')
        
        if not authorization:
            print("Gateway: No authorization header found")
            raise Exception("Token is missing!")
        
        token = authorization.split(' ')[1] if ' ' in authorization else authorization
        print(f"Gateway: Extracted token: {token[:20]}...")  # Debug log (first 20 chars only)
        
        query_data = {
            'query': '''
            query($token: String!) {
                verifyToken(token: $token) {
                    valid
                    userId
                    role
                    error
                }
            }
            ''',
            'variables': {'token': token}
        }
        
        print(f"Gateway: Sending verification request to user service")
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        print(f"Gateway: Received verification response: {result}")
        
        if not result:
            print("Gateway: User service returned None for token verification")
            raise Exception("User service unavailable for token verification!")
        
        if result.get('errors'):
            error_messages = [str(error) for error in result['errors']]
            print(f"Gateway: User service returned verification errors: {error_messages}")
            raise Exception(f"Token verification errors: {'; '.join(error_messages)}")
        
        data = result.get('data')
        if not data:
            print("Gateway: No data in token verification response")
            raise Exception("No data returned from token verification!")
        
        token_data = data.get('verifyToken')
        if not token_data:
            print("Gateway: No verifyToken field in response")
            raise Exception("Invalid token verification response!")
        
        if not token_data.get('valid', False):
            error_msg = token_data.get('error', 'Invalid token')
            print(f"Gateway: Token verification failed: {error_msg}")
            raise Exception(f"Token verification failed: {error_msg}")
        
        user_info = {
            'user_id': token_data.get('userId'),  # ← Changed from user_id to userId
            'role': token_data.get('role', 'USER')
        }
        print(f"Gateway: Token verification successful for user: {user_info}")
        return user_info
        
    except Exception as e:
        print(f"Gateway: Error in verify_token_from_context: {str(e)}")
        raise e

def require_auth(f):
    """Decorator for requiring authentication"""
    @wraps(f)
    def wrapper(self, info, **kwargs):
        current_user = verify_token_from_context(info)
        return f(self, info, current_user=current_user, **kwargs)
    return wrapper

def require_admin(f):
    """Decorator for requiring admin role"""
    @wraps(f)
    def wrapper(self, info, **kwargs):
        current_user = verify_token_from_context(info)
        if current_user['role'] != 'ADMIN':
            raise Exception("Admin access required!")
        return f(self, info, current_user=current_user, **kwargs)
    return wrapper

# GraphQL Types
class UserType(ObjectType):
    id = Int()
    username = String()
    email = String()
    role = String()

class MovieType(ObjectType):
    id = Int()
    title = String()
    genre = String()
    duration = Int()
    description = String()
    releaseDate = String()  # ← Changed from release_date to releaseDate
    
    def resolve_releaseDate(self, info):
        # Convert the database field to the expected format
        if hasattr(self, 'release_date') and self.release_date:
            return self.release_date.strftime('%Y-%m-%d')
        return None

class CinemaType(ObjectType):
    id = Int()
    name = String()
    location = String()
    capacity = Int()

class BookingType(ObjectType):
    id = Int()
    user_id = Int()
    movie_id = Int()
    cinema_id = Int()
    showtime = String()
    seats = String()
    total_price = Float()
    status = String()
    booking_date = String()

class PaymentType(ObjectType):
    id = Int()
    user_id = Int()
    booking_id = Int()
    amount = Float()
    payment_method = String()
    status = String()
    payment_proof_image = String()
    created_at = String()
    updated_at = String()
    can_be_deleted = Boolean()

class CouponType(ObjectType):
    id = Int()
    code = String()
    name = String()
    discount_percentage = Float()
    valid_until = String()
    is_active = Boolean()

class AuthResponse(ObjectType):
    success = Boolean()
    token = String()
    message = String()
    user = Field(UserType)

# Add these response types first
class CreateCinemaResponse(ObjectType):
    cinema = Field(CinemaType)
    success = Boolean()
    message = String()

class CreateCouponResponse(ObjectType):
    coupon = Field(CouponType)
    success = Boolean()
    message = String()

class UseCouponResponse(ObjectType):
    success = Boolean()
    message = String()
    discount_amount = Float()

class UpdateBookingResponse(ObjectType):
    booking = Field(BookingType)
    success = Boolean()
    message = String()

class DeleteResponse(ObjectType):
    success = Boolean()
    message = String()

# Queries
class Query(ObjectType):
    # Public queries
    test = String()
    
    # User authenticated queries
    movies = List(MovieType)
    cinemas = List(CinemaType)
    available_coupons = List(CouponType)
    my_bookings = List(BookingType)
    my_payments = List(PaymentType)
    
    # Admin queries
    all_bookings = List(BookingType)
    all_payments = List(PaymentType)
    users = List(UserType)

    def resolve_test(self, info):
        return "GraphQL Gateway is working!"

    @require_auth
    def resolve_movies(self, info, current_user):
        query_data = {'query': '{ movies { id title genre duration description releaseDate } }'}  # ← Changed from release_date to releaseDate
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        response = handle_service_response(result, 'movie', 'movies')
        if not response['success']:
            raise Exception(response['error'])
        
        # No need to map field names since both use the same naming convention now
        return response['data']

    @require_auth
    def resolve_cinemas(self, info, current_user):
        query_data = {'query': '{ cinemas { id name location capacity } }'}
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        response = handle_service_response(result, 'cinema', 'cinemas')
        if not response['success']:
            raise Exception(response['error'])
        
        return response['data']

    @require_auth
    def resolve_available_coupons(self, info, current_user):
        query_data = {'query': '{ available_coupons { id code name discount_percentage valid_until is_active } }'}  # ← Changed to match service
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'available_coupons')  # ← Changed field name
        if not response['success']:
            raise Exception(response['error'])
        
        return response['data']

    @require_auth
    def resolve_my_bookings(self, info, current_user):
        user_id = current_user['user_id']
        query = f'{{ userBookings(userId: {user_id}) {{ id user_id movie_id cinema_id showtime seats total_price status booking_date }} }}'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        response = handle_service_response(result, 'booking', 'userBookings')
        if not response['success']:
            raise Exception(response['error'])
        
        return response['data']

    @require_auth
    def resolve_my_payments(self, info, current_user):
        user_id = current_user['user_id']
        query = f'{{ userPayments(userId: {user_id}) {{ id user_id booking_id amount payment_method status payment_proof_image created_at updated_at can_be_deleted }} }}'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        response = handle_service_response(result, 'payment', 'userPayments')
        if not response['success']:
            raise Exception(response['error'])
        
        return response['data']

    @require_admin
    def resolve_all_bookings(self, info, current_user):
        query = '{ bookings { id user_id movie_id cinema_id showtime seats total_price status booking_date } }'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        response = handle_service_response(result, 'booking', 'bookings')
        if not response['success']:
            raise Exception(response['error'])
        
        return response['data']

    @require_admin
    def resolve_all_payments(self, info, current_user):
        query = '{ payments { id user_id booking_id amount payment_method status payment_proof_image created_at updated_at } }'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        response = handle_service_response(result, 'payment', 'payments')
        if not response['success']:
            raise Exception(response['error'])
        
        return response['data']

    @require_admin
    def resolve_users(self, info, current_user):
        query = '{ users { id username email role } }'
        query_data = {'query': query}
        
        print(f"Gateway: Requesting users from user service")
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        response = handle_service_response(result, 'user', 'users')
        if not response['success']:
            raise Exception(response['error'])
        
        print(f"Gateway: Successfully retrieved {len(response['data'])} users")
        return response['data']

# Mutations
class RegisterUser(Mutation):
    class Arguments:
        username = String(required=True)
        email = String(required=True)
        password = String(required=True)
        role = String()

    Output = AuthResponse

    def mutate(self, info, username, email, password, role="USER"):
        query_data = {
            'query': '''
            mutation($username: String!, $email: String!, $password: String!, $role: String) {
                createUser(username: $username, email: $email, password: $password, role: $role) {
                    success
                    message
                    user {
                        id
                        username
                        email
                        role
                    }
                }
            }
            ''',
            'variables': {
                'username': username,
                'email': email,
                'password': password,
                'role': role
            }
        }
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        if not result:
            raise Exception("User service unavailable")
        
        create_result = result.get('data', {}).get('createUser', {})
        
        if not create_result.get('success'):
            raise Exception(create_result.get('message', 'Registration failed'))
        
        return AuthResponse(
            success=True,
            message=create_result.get('message'),
            user=create_result.get('user')
        )

class LoginUser(Mutation):
    class Arguments:
        email = String(required=True)
        password = String(required=True)

    Output = AuthResponse

    def mutate(self, info, email, password):
        query_data = {
            'query': '''
            mutation($email: String!, $password: String!) {
                loginUser(email: $email, password: $password) {
                    success
                    token
                    message
                    user {
                        id
                        username
                        email
                        role
                    }
                }
            }
            ''',
            'variables': {
                'email': email,
                'password': password
            }
        }
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        if not result:
            raise Exception("User service unavailable")
        
        login_result = result.get('data', {}).get('loginUser', {})
        
        if not login_result.get('success'):
            raise Exception(login_result.get('message', 'Login failed'))
        
        return AuthResponse(
            success=True,
            token=login_result.get('token'),
            message=login_result.get('message'),
            user=login_result.get('user')
        )

class CreateMovieResponse(ObjectType):
    movie = Field(MovieType)
    success = Boolean()
    message = String()

class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()
        releaseDate = String()  # ← Changed from release_date to releaseDate

    Output = CreateMovieResponse

    @require_admin
    def mutate(self, info, current_user, title, genre, duration, description=None, releaseDate=None):  # ← Changed parameter name
        query_data = {
            'query': '''
            mutation($title: String!, $genre: String!, $duration: Int!, $description: String, $releaseDate: String) {
                createMovie(title: $title, genre: $genre, duration: $duration, description: $description, releaseDate: $releaseDate) {
                    movie {
                        id
                        title
                        genre
                        duration
                        description
                        releaseDate
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'title': title,
                'genre': genre,
                'duration': duration,
                'description': description,
                'releaseDate': releaseDate  # ← Updated variable name
            }
        }
        
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        response = handle_service_response(result, 'movie')
        if not response['success']:
            return CreateMovieResponse(movie=None, success=False, message=response['error'])
        
        create_result = response['data'].get('createMovie', {})
        
        return CreateMovieResponse(
            movie=create_result.get('movie'),
            success=create_result.get('success', False),
            message=create_result.get('message', 'Movie operation completed')
        )

class CreateBooking(Mutation):
    class Arguments:
        movie_id = Int(required=True)
        cinema_id = Int(required=True)
        showtime = String(required=True)
        seats = String()
        total_price = Float()

    booking = Field(BookingType)

    @require_auth
    def mutate(self, info, current_user, movie_id, cinema_id, showtime, seats=None, total_price=None):
        query_data = {
            'query': '''
            mutation($user_id: Int!, $movie_id: Int!, $cinema_id: Int!, $showtime: String!, $seats: String, $total_price: Float) {
                createBooking(user_id: $user_id, movie_id: $movie_id, cinema_id: $cinema_id, showtime: $showtime, seats: $seats, total_price: $total_price) {
                    booking {
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
                    success
                    message
                }
            }
            ''',
            'variables': {
                'user_id': current_user['user_id'],
                'movie_id': movie_id,
                'cinema_id': cinema_id,
                'showtime': showtime,
                'seats': seats,
                'total_price': total_price
            }
        }
        
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        if not result:
            raise Exception("Booking service unavailable")
        
        booking_result = result.get('data', {}).get('createBooking', {})
        
        if not booking_result.get('success'):
            raise Exception(booking_result.get('message', 'Failed to create booking'))
        
        return CreateBooking(booking=booking_result.get('booking'))

class CreatePayment(Mutation):
    class Arguments:
        amount = Float(required=True)
        booking_id = Int(required=True)
        payment_method = String()
        payment_proof_image = String()

    payment = Field(PaymentType)

    @require_auth
    def mutate(self, info, current_user, amount, booking_id, payment_method='CREDIT_CARD', payment_proof_image=None):
        query_data = {
            'query': '''
            mutation($amount: Float!, $user_id: Int!, $booking_id: Int!, $payment_method: String, $payment_proof_image: String) {
                createPayment(amount: $amount, user_id: $user_id, booking_id: $booking_id, payment_method: $payment_method, payment_proof_image: $payment_proof_image) {
                    payment {
                        id
                        amount
                        user_id
                        booking_id
                        payment_method
                        status
                        payment_proof_image
                        created_at
                        updated_at
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'amount': amount,
                'user_id': current_user['user_id'],
                'booking_id': booking_id,
                'payment_method': payment_method,
                'payment_proof_image': payment_proof_image
            }
        }
        
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        if not result:
            raise Exception("Payment service unavailable")
        
        payment_result = result.get('data', {}).get('createPayment', {})
        
        if not payment_result.get('success'):
            raise Exception(payment_result.get('message', 'Failed to create payment'))
        
        return CreatePayment(payment=payment_result.get('payment'))

class CreateCinema(Mutation):
    class Arguments:
        name = String(required=True)
        location = String(required=True)
        capacity = Int(required=True)

    Output = CreateCinemaResponse

    @require_admin
    def mutate(self, info, current_user, name, location, capacity):
        query_data = {
            'query': '''
            mutation($name: String!, $location: String!, $capacity: Int!) {
                createCinema(name: $name, location: $location, capacity: $capacity) {
                    cinema {
                        id
                        name
                        location
                        capacity
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'name': name,
                'location': location,
                'capacity': capacity
            }
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        if not result:
            return CreateCinemaResponse(cinema=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return CreateCinemaResponse(cinema=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        create_result = result.get('data', {}).get('createCinema', {})
        
        return CreateCinemaResponse(
            cinema=create_result.get('cinema'),
            success=create_result.get('success', False),
            message=create_result.get('message', 'Cinema operation completed')
        )

class UpdateMovie(Mutation):
    class Arguments:
        id = Int(required=True)
        title = String()
        genre = String()
        duration = Int()
        description = String()
        releaseDate = String()  # ← Changed from release_date

    Output = CreateMovieResponse

    @require_admin
    def mutate(self, info, current_user, id, title=None, genre=None, duration=None, description=None, releaseDate=None):
        query_data = {
            'query': '''
            mutation($id: Int!, $title: String, $genre: String, $duration: Int, $description: String, $releaseDate: String) {
                updateMovie(id: $id, title: $title, genre: $genre, duration: $duration, description: $description, releaseDate: $releaseDate) {
                    movie {
                        id
                        title
                        genre
                        duration
                        description
                        releaseDate
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': id,
                'title': title,
                'genre': genre,
                'duration': duration,
                'description': description,
                'releaseDate': releaseDate  # ← Updated variable name
            }
        }
        
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        if not result:
            return CreateMovieResponse(movie=None, success=False, message="Movie service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return CreateMovieResponse(movie=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateMovie', {})
        
        return CreateMovieResponse(
            movie=update_result.get('movie'),
            success=update_result.get('success', False),
            message=update_result.get('message', 'Movie update completed')
        )

class DeleteMovie(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deleteMovie(id: $id) {
                    success
                    message
                }
            }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        if not result:
            return DeleteResponse(success=False, message="Movie service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return DeleteResponse(success=False, message=f"Error: {'; '.join(error_messages)}")
        
        delete_result = result.get('data', {}).get('deleteMovie', {})
        
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'Movie deletion completed')
        )

class UpdateCinema(Mutation):
    class Arguments:
        id = Int(required=True)
        name = String()
        location = String()
        capacity = Int()

    Output = CreateCinemaResponse

    @require_admin
    def mutate(self, info, current_user, id, name=None, location=None, capacity=None):
        query_data = {
            'query': '''
            mutation($id: Int!, $name: String, $location: String, $capacity: Int) {
                updateCinema(id: $id, name: $name, location: $location, capacity: $capacity) {
                    cinema {
                        id
                        name
                        location
                        capacity
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': id,
                'name': name,
                'location': location,
                'capacity': capacity
            }
        }
        
        print(f"Gateway: Sending updateCinema request: {query_data}")  # Debug log
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        print(f"Gateway: Received updateCinema response: {result}")  # Debug log
        
        if not result:
            return CreateCinemaResponse(cinema=None, success=False, message="Cinema service unavailable")
        
        if 'errors' in result and result['errors']:
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict) and 'message' in error:
                    error_messages.append(error['message'])
                else:
                    error_messages.append(str(error))
            
            error_msg = f"Cinema service errors: {'; '.join(error_messages)}"
            return CreateCinemaResponse(cinema=None, success=False, message=error_msg)
        
        data = result.get('data')
        if not data:
            return CreateCinemaResponse(cinema=None, success=False, message="No data returned from cinema service")
        
        cinema_result = data.get('updateCinema')
        if not cinema_result:
            return CreateCinemaResponse(cinema=None, success=False, message="No updateCinema field in response")
        
        return CreateCinemaResponse(
            cinema=cinema_result.get('cinema'),
            success=cinema_result.get('success', True),
            message=cinema_result.get('message', 'Cinema updated successfully')
        )

class DeleteCinema(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deleteCinema(id: $id) {
                    success
                    message
                }
            }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        if not result:
            return DeleteResponse(success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return DeleteResponse(success=False, message=f"Error: {'; '.join(error_messages)}")
        
        delete_result = result.get('data', {}).get('deleteCinema', {})
        
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'Cinema deletion completed')
        )

class UpdateBooking(Mutation):
    class Arguments:
        id = Int(required=True)
        movie_id = Int()
        cinema_id = Int()
        showtime = String()
        seats = String()
        total_price = Float()
        status = String()

    Output = UpdateBookingResponse

    @require_auth
    def mutate(self, info, current_user, id, movie_id=None, cinema_id=None, showtime=None, seats=None, total_price=None, status=None):
        query_data = {
            'query': '''
            mutation($id: Int!, $movie_id: Int, $cinema_id: Int, $showtime: String, $seats: String, $total_price: Float, $status: String) {
                updateBooking(id: $id, movie_id: $movie_id, cinema_id: $cinema_id, showtime: $showtime, seats: $seats, total_price: $total_price, status: $status) {
                    booking {
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
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': id,
                'movie_id': movie_id,
                'cinema_id': cinema_id,
                'showtime': showtime,
                'seats': seats,
                'total_price': total_price,
                'status': status
            }
        }
        
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        if not result:
            return UpdateBookingResponse(booking=None, success=False, message="Booking service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return UpdateBookingResponse(booking=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        booking_result = result.get('data', {}).get('updateBooking', {})
        
        return UpdateBookingResponse(
            booking=booking_result.get('booking'),
            success=booking_result.get('success', False),
            message=booking_result.get('message', 'Booking update completed')
        )

class DeleteBooking(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_auth
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deleteBooking(id: $id) {
                    success
                    message
                }
            }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        if not result:
            return DeleteResponse(success=False, message="Booking service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return DeleteResponse(success=False, message=f"Error: {'; '.join(error_messages)}")
        
        delete_result = result.get('data', {}).get('deleteBooking', {})
        
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'Booking deletion completed')
        )

class CreateCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        name = String(required=True)
        discount_percentage = Float(required=True)
        valid_until = String(required=True)

    Output = CreateCouponResponse

    @require_admin
    def mutate(self, info, current_user, code, name, discount_percentage, valid_until):
        query_data = {
            'query': '''
            mutation($code: String!, $name: String!, $discount_percentage: Float!, $valid_until: String!) {
                createCoupon(code: $code, name: $name, discount_percentage: $discount_percentage, valid_until: $valid_until) {
                    coupon {
                        id
                        code
                        name
                        discount_percentage
                        valid_until
                        is_active
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'code': code,
                'name': name,
                'discount_percentage': discount_percentage,
                'valid_until': valid_until
            }
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        if not result:
            return CreateCouponResponse(coupon=None, success=False, message="Coupon service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return CreateCouponResponse(coupon=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        create_result = result.get('data', {}).get('createCoupon', {})
        
        return CreateCouponResponse(
            coupon=create_result.get('coupon'),
            success=create_result.get('success', False),
            message=create_result.get('message', 'Coupon operation completed')
        )

class UseCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        booking_amount = Float(required=True)

    Output = UseCouponResponse

    @require_auth
    def mutate(self, info, current_user, code, booking_amount):
        query_data = {
            'query': '''
            mutation($code: String!, $booking_amount: Float!) {
                useCoupon(code: $code, booking_amount: $booking_amount) {
                    success
                    message
                    discount_amount
                }
            }
            ''',
            'variables': {
                'code': code,
                'booking_amount': booking_amount
            }
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        if not result:
            return UseCouponResponse(success=False, message="Coupon service unavailable", discount_amount=0.0)
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return UseCouponResponse(success=False, message=f"Error: {'; '.join(error_messages)}", discount_amount=0.0)
        
        use_result = result.get('data', {}).get('useCoupon', {})
        
        return UseCouponResponse(
            success=use_result.get('success', False),
            message=use_result.get('message', 'Coupon use completed'),
            discount_amount=use_result.get('discount_amount', 0.0)
        )

class UpdateUser(Mutation):
    class Arguments:
        id = Int(required=True)
        username = String()
        email = String()
        password = String()

    user = Field(UserType)

    @require_admin
    def mutate(self, info, current_user, id, username=None, email=None, password=None):
        query_data = {
            'query': '''
            mutation($id: Int!, $username: String, $email: String, $password: String) {
                updateUser(id: $id, username: $username, email: $email, password: $password) {
                    user {
                        id
                        username
                        email
                        role
                    }
                }
            }
            ''',
            'variables': {
                'id': id,
                'username': username,
                'email': email,
                'password': password
            }
        }
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        response = handle_service_response(result, 'user')
        if not response['success']:
            raise Exception(response['error'])
        
        user_result = response['data'].get('updateUser')
        if not user_result:
            raise Exception("No updateUser field in user service response")
        
        # Extract the nested user data
        user_data = user_result.get('user')
        if not user_data:
            raise Exception("No user field in updateUser response")
        
        return UpdateUser(user=user_data)

class DeleteUser(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: $id) {
                deleteUser(id: $id) {
                    success
                    message
                }
            }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        response = handle_service_response(result, 'user')
        if not response['success']:
            return DeleteResponse(success=False, message=response['error'])
        
        delete_result = response['data'].get('deleteUser', {})
        
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'User deletion completed')
        )

def safe_get_error_messages(errors):
    """Safely extract error messages from various error formats"""
    if not errors:
        return []
    
    error_messages = []
    for error in errors:
        if isinstance(error, str):
            error_messages.append(error)
        elif isinstance(error, dict):
            error_messages.append(error.get('message', str(error)))
        elif hasattr(error, 'message'):  # GraphQL error object
            error_messages.append(str(error.message))
        else:
            error_messages.append(str(error))
    
    return error_messages

def handle_service_response(result, service_name, data_key=None):
    """Centralized service response handler"""
    if not result:
        return {
            'success': False,
            'error': f"{service_name} service unavailable",
            'data': None
        }
    
    if result.get('errors'):
        # Handle different error formats more safely
        errors = result['errors']
        if isinstance(errors, list):
            error_messages = safe_get_error_messages(errors)
        else:
            error_messages = [str(errors)]
        
        return {
            'success': False,
            'error': f"{service_name} service errors: {'; '.join(error_messages)}",
            'data': None
        }
    
    data = result.get('data')
    if not data:
        return {
            'success': False,
            'error': f"No data returned from {service_name} service",
            'data': None
        }
    
    if data_key:
        service_data = data.get(data_key)
        if service_data is None:
            return {
                'success': False,
                'error': f"No {data_key} field in {service_name} service response",
                'data': None
            }
        return {
            'success': True,
            'error': None,
            'data': service_data
        }
    
    return {
        'success': True,
        'error': None,
        'data': data
    }

# Update the Mutation class to include all mutations
class Mutation(ObjectType):
    # Public mutations
    register = RegisterUser.Field()
    login = LoginUser.Field()
    
    # User mutations
    create_booking = CreateBooking.Field()
    create_payment = CreatePayment.Field()
    update_booking = UpdateBooking.Field()
    delete_booking = DeleteBooking.Field()
    use_coupon = UseCoupon.Field()
    
    # Admin mutations
    create_movie = CreateMovie.Field()
    update_movie = UpdateMovie.Field()
    delete_movie = DeleteMovie.Field()
    create_cinema = CreateCinema.Field()
    update_cinema = UpdateCinema.Field()
    delete_cinema = DeleteCinema.Field()
    create_coupon = CreateCoupon.Field()
    delete_user = DeleteUser.Field()
    update_user = UpdateUser.Field()

# Schema
schema = Schema(query=Query, mutation=Mutation)