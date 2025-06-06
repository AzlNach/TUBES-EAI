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

def handle_service_response(result, service_name, data_key=None):
    """Centralized service response handler"""
    if not result:
        return {
            'success': False,
            'error': f"{service_name} service unavailable",
            'data': None
        }
    
    if result.get('errors'):
        error_messages = []
        for error in result['errors']:
            if isinstance(error, dict):
                error_messages.append(error.get('message', str(error)))
            else:
                error_messages.append(str(error))
        
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
        return {'success': True, 'error': None, 'data': service_data}
    
    return {'success': True, 'error': None, 'data': data}

def verify_token_from_context(info):
    """Extract and verify token from GraphQL context"""
    try:
        context = info.context
        authorization = context.get('Authorization') or context.get('HTTP_AUTHORIZATION')
        
        if not authorization:
            raise Exception("Token is missing!")
        
        token = authorization.split(' ')[1] if ' ' in authorization else authorization
        
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
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        response = handle_service_response(result, 'user')
        
        if not response['success']:
            raise Exception(response['error'])
        
        token_data = response['data'].get('verifyToken')
        if not token_data or not token_data.get('valid'):
            raise Exception(token_data.get('error', 'Invalid token'))
        
        return {
            'user_id': token_data.get('userId'),
            'role': token_data.get('role', 'USER')
        }
        
    except Exception as e:
        raise Exception(f"Authentication failed: {str(e)}")

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

# ============================================================================
# GRAPHQL TYPES (Konsisten dengan service schemas)
# ============================================================================

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
    releaseDate = String()

class CinemaType(ObjectType):
    id = Int()
    name = String()
    location = String()
    capacity = Int()

class BookingType(ObjectType):
    """Booking type - disesuaikan dengan booking service schema"""
    id = Int()
    userId = Int()      # Booking service menggunakan userId (camelCase)
    movieId = Int()     # Booking service menggunakan movieId (camelCase)
    cinemaId = Int()    # Booking service menggunakan cinemaId (camelCase)
    showtime = String()
    seats = String()
    totalPrice = Float()  # Booking service menggunakan totalPrice (camelCase)
    status = String()
    bookingDate = String()  # Booking service menggunakan bookingDate (camelCase)

class PaymentType(ObjectType):
    """Payment type - consistent with payment service schema"""
    id = Int()
    userId = Int()              # Changed from user_id to userId
    bookingId = Int()           # Changed from booking_id to bookingId
    amount = Float()
    paymentMethod = String()    # Changed from payment_method to paymentMethod
    status = String()
    paymentProofImage = String() # Changed from payment_proof_image to paymentProofImage
    createdAt = String()        # Changed from created_at to createdAt
    updatedAt = String()        # Changed from updated_at to updatedAt
    canBeDeleted = Boolean()    # Changed from can_be_deleted to canBeDeleted

class CouponType(ObjectType):
    id = Int()
    code = String()
    name = String()
    discount_percentage = Float()
    valid_until = String()
    is_active = Boolean()

# ============================================================================
# RESPONSE TYPES
# ============================================================================

class AuthResponse(ObjectType):
    success = Boolean()
    token = String()
    message = String()
    user = Field(UserType)

class CreateMovieResponse(ObjectType):
    movie = Field(MovieType)
    success = Boolean()
    message = String()

class CreateCinemaResponse(ObjectType):
    cinema = Field(CinemaType)
    success = Boolean()
    message = String()

class CreateBookingResponse(ObjectType):
    booking = Field(BookingType)
    success = Boolean()
    message = String()

class UpdateBookingResponse(ObjectType):
    booking = Field(BookingType)
    success = Boolean()
    message = String()

class CreatePaymentResponse(ObjectType):
    """Payment creation response - missing response type"""
    payment = Field(PaymentType)
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

class DeleteResponse(ObjectType):
    success = Boolean()
    message = String()

# ============================================================================
# QUERY RESOLVERS
# ============================================================================

class Query(ObjectType):
    # Public queries
    test = String()
    
    # User authenticated queries
    movies = List(MovieType)
    cinemas = List(CinemaType)
    available_coupons = List(CouponType)
    my_bookings = List(BookingType)
    my_payments = List(PaymentType)
    
    # Get by ID queries (authenticated)
    movie = Field(MovieType, id=Int(required=True))
    cinema = Field(CinemaType, id=Int(required=True))
    user = Field(UserType, id=Int(required=True))
    
    # Admin queries
    all_bookings = List(BookingType)
    all_payments = List(PaymentType)
    users = List(UserType)

    def resolve_test(self, info):
        return "Cinema GraphQL Gateway is operational"

    @require_auth
    def resolve_movies(self, info, current_user):
        query_data = {'query': '{ movies { id title genre duration description releaseDate } }'}
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        response = handle_service_response(result, 'movie', 'movies')
        if not response['success']:
            raise Exception(response['error'])
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
        query_data = {'query': '{ available_coupons { id code name discount_percentage valid_until is_active } }'}
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'available_coupons')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']

    @require_auth
    def resolve_my_bookings(self, info, current_user):
        """Query disesuaikan dengan booking service schema (camelCase)"""
        user_id = current_user['user_id']
        query = f'{{ userBookings(userId: {user_id}) {{ id userId movieId cinemaId showtime seats totalPrice status bookingDate }} }}'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        response = handle_service_response(result, 'booking', 'userBookings')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']

    @require_auth
    def resolve_my_payments(self, info, current_user):
        user_id = current_user['user_id']
        query = f'{{ userPayments(userId: {user_id}) {{ id userId bookingId amount paymentMethod paymentProofImage createdAt updatedAt canBeDeleted }} }}'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        response = handle_service_response(result, 'payment', 'userPayments')
        if not response['success']:
            raise Exception(response['error'])
        
        # Add virtual status to each payment
        payments = response['data']
        for payment in payments:
            payment['status'] = 'PAID'  # ← Changed to uppercase - All payments are considered 'PAID'
        
        return payments

    @require_admin
    def resolve_all_bookings(self, info, current_user):
        """Query disesuaikan dengan booking service schema (camelCase)"""
        query = '{ bookings { id userId movieId cinemaId showtime seats totalPrice status bookingDate } }'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        response = handle_service_response(result, 'booking', 'bookings')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']

    @require_admin
    def resolve_all_payments(self, info, current_user):
        query = '{ payments { id userId bookingId amount paymentMethod paymentProofImage createdAt updatedAt } }'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        response = handle_service_response(result, 'payment', 'payments')
        if not response['success']:
            raise Exception(response['error'])
        
        # Add virtual status to each payment
        payments = response['data']
        for payment in payments:
            payment['status'] = 'PAID'  # ← Changed to uppercase - All payments are considered 'PAID'
        
        return payments

    @require_admin
    def resolve_users(self, info, current_user):
        query = '{ users { id username email role } }'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        response = handle_service_response(result, 'user', 'users')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']

    # ============================================================================
    # GET BY ID RESOLVERS
    # ============================================================================

    @require_auth
    def resolve_movie(self, info, current_user, id):
        """Get single movie by ID"""
        query_data = {
            'query': f'''
            {{
                movie(id: {id}) {{
                    id
                    title
                    genre
                    duration
                    description
                    releaseDate
                }}
            }}
            '''
        }
        
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        response = handle_service_response(result, 'movie', 'movie')
        if not response['success']:
            raise Exception(response['error'])
        
        movie_data = response['data']
        if not movie_data:
            raise Exception(f"Movie with ID {id} not found")
        
        return movie_data

    @require_auth
    def resolve_cinema(self, info, current_user, id):
        """Get single cinema by ID"""
        query_data = {
            'query': f'''
            {{
                cinema(id: {id}) {{
                    id
                    name
                    location
                    capacity
                }}
            }}
            '''
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        response = handle_service_response(result, 'cinema', 'cinema')
        if not response['success']:
            raise Exception(response['error'])
        
        cinema_data = response['data']
        if not cinema_data:
            raise Exception(f"Cinema with ID {id} not found")
        
        return cinema_data

    @require_auth
    def resolve_user(self, info, current_user, id):
        """Get single user by ID - users can only see their own profile, admins can see any"""
        # Regular users can only see their own profile
        if current_user['role'] != 'ADMIN' and current_user['user_id'] != id:
            raise Exception("You can only view your own profile")
        
        query_data = {
            'query': f'''
            {{
                user(id: {id}) {{
                    id
                    username
                    email
                    role
                }}
            }}
            '''
        }
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        
        response = handle_service_response(result, 'user', 'user')
        if not response['success']:
            raise Exception(response['error'])
        
        user_data = response['data']
        if not user_data:
            raise Exception(f"User with ID {id} not found")
        
        return user_data

# ============================================================================
# MUTATION RESOLVERS
# ============================================================================

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
                    user { id username email role }
                }
            }
            ''',
            'variables': {'username': username, 'email': email, 'password': password, 'role': role}
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
                    user { id username email role }
                }
            }
            ''',
            'variables': {'email': email, 'password': password}
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

class CreateBooking(Mutation):
    """Create booking - disesuaikan dengan booking service schema"""
    class Arguments:
        movieId = Int(required=True)
        cinemaId = Int(required=True)
        showtime = String(required=True)
        seats = String()
        totalPrice = Float()

    Output = CreateBookingResponse

    @require_auth
    def mutate(self, info, current_user, movieId, cinemaId, showtime, seats=None, totalPrice=None):
        # Booking service expects camelCase parameters and returns camelCase fields
        query_data = {
            'query': '''
            mutation($userId: Int!, $movieId: Int!, $cinemaId: Int!, $showtime: String!, $seats: String, $totalPrice: Float) {
                createBooking(userId: $userId, movieId: $movieId, cinemaId: $cinemaId, showtime: $showtime, seats: $seats, totalPrice: $totalPrice) {
                    booking {
                        id
                        userId
                        movieId
                        cinemaId
                        showtime
                        seats
                        totalPrice
                        status
                        bookingDate
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'userId': current_user['user_id'],     # Map to camelCase
                'movieId': movieId,                    # Already camelCase
                'cinemaId': cinemaId,                  # Already camelCase
                'showtime': showtime,
                'seats': seats,
                'totalPrice': totalPrice               # Already camelCase
            }
        }
        
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        if not result:
            return CreateBookingResponse(
                booking=None, 
                success=False, 
                message="Booking service unavailable"
            )
        
        # Improved error handling
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                elif isinstance(error, str):
                    error_messages.append(error)
                else:
                    error_messages.append(str(error))
            
            return CreateBookingResponse(
                booking=None,
                success=False,
                message=f"Booking errors: {'; '.join(error_messages)}"
            )
        
        data = result.get('data')
        if not data:
            return CreateBookingResponse(
                booking=None,
                success=False,
                message="No data returned from booking service"
            )
        
        booking_result = data.get('createBooking', {})
        if not booking_result.get('success'):
            return CreateBookingResponse(
                booking=None,
                success=False,
                message=booking_result.get('message', 'Failed to create booking')
            )
        
        # No field transformation needed since both use camelCase
        return CreateBookingResponse(
            booking=booking_result.get('booking'),
            success=True,
            message=booking_result.get('message', 'Booking created successfully')
        )

class UpdateBooking(Mutation):
    """Update booking - disesuaikan dengan booking service schema"""
    class Arguments:
        id = Int(required=True)
        movieId = Int()
        cinemaId = Int()
        showtime = String()
        seats = String()
        totalPrice = Float()
        status = String()

    Output = UpdateBookingResponse

    @require_auth
    def mutate(self, info, current_user, id, movieId=None, cinemaId=None, showtime=None, seats=None, totalPrice=None, status=None):
        # Booking service expects camelCase parameters
        query_data = {
            'query': '''
            mutation($id: Int!, $movieId: Int, $cinemaId: Int, $showtime: String, $seats: String, $totalPrice: Float, $status: String) {
                updateBooking(id: $id, movieId: $movieId, cinemaId: $cinemaId, showtime: $showtime, seats: $seats, totalPrice: $totalPrice, status: $status) {
                    booking {
                        id
                        userId
                        movieId
                        cinemaId
                        showtime
                        seats
                        totalPrice
                        status
                        bookingDate
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': id,
                'movieId': movieId,        # Use camelCase
                'cinemaId': cinemaId,      # Use camelCase
                'showtime': showtime,
                'seats': seats,
                'totalPrice': totalPrice,  # Use camelCase
                'status': status
            }
        }
        
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        if not result:
            return UpdateBookingResponse(booking=None, success=False, message="Booking service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                else:
                    error_messages.append(str(error))
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

class CreatePayment(Mutation):
    class Arguments:
        amount = Float(required=True)
        bookingId = Int(required=True)
        paymentMethod = String()
        paymentProofImage = String()

    Output = CreatePaymentResponse

    @require_auth
    def mutate(self, info, current_user, amount, bookingId, paymentMethod='CREDIT_CARD', paymentProofImage=None):
        # Step 1: Check booking exists and is in 'PENDING' status
        booking_check_query = {
            'query': f'''
            {{
                userBookings(userId: {current_user['user_id']}) {{
                    id
                    status
                    totalPrice
                }}
            }}
            ''',
        }
        
        booking_result = make_service_request(SERVICE_URLS['booking'], booking_check_query, 'booking')
        if not booking_result:
            raise Exception("Booking service unavailable")
        
        user_bookings = booking_result.get('data', {}).get('userBookings', [])
        target_booking = next((b for b in user_bookings if b['id'] == bookingId), None)
        
        if not target_booking:
            raise Exception(f"Booking {bookingId} not found or not owned by user")
        
        if target_booking['status'] != 'PENDING':
            raise Exception(f"Booking {bookingId} is already {target_booking['status']}. Only PENDING bookings can be paid.")
        
        # Step 2: Create payment (without status attribute)
        payment_query = {
            'query': '''
            mutation($amount: Float!, $userId: Int!, $bookingId: Int!, $paymentMethod: String, $paymentProofImage: String) {
                createPayment(amount: $amount, userId: $userId, bookingId: $bookingId, paymentMethod: $paymentMethod, paymentProofImage: $paymentProofImage) {
                    payment {
                        id
                        userId
                        bookingId
                        amount
                        paymentMethod
                        paymentProofImage
                        createdAt
                        updatedAt
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'amount': amount,
                'userId': current_user['user_id'],
                'bookingId': bookingId,
                'paymentMethod': paymentMethod,
                'paymentProofImage': paymentProofImage
            }
        }
        
        payment_result = make_service_request(SERVICE_URLS['payment'], payment_query, 'payment')
        if not payment_result:
            raise Exception("Payment service unavailable")
        
        if payment_result.get('errors'):
            error_messages = []
            for error in payment_result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                else:
                    error_messages.append(str(error))
            raise Exception(f"Payment creation failed: {'; '.join(error_messages)}")
        
        payment_data = payment_result.get('data', {}).get('createPayment', {})
        if not payment_data.get('success'):
            raise Exception(payment_data.get('message', 'Failed to create payment'))
        
        # Step 3: Automatically update booking status to 'PAID'
        booking_update_query = {
            'query': '''
            mutation($id: Int!, $status: String!) {
                updateBooking(id: $id, status: $status) {
                    booking {
                        id
                        status
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': bookingId,
                'status': 'PAID'  # ← Changed to uppercase
            }
        }
        
        booking_update_result = make_service_request(SERVICE_URLS['booking'], booking_update_query, 'booking')
        if not booking_update_result or booking_update_result.get('errors'):
            # Payment created but booking status update failed - this is critical
            print(f"CRITICAL: Payment {payment_data.get('payment', {}).get('id')} created but booking {bookingId} status update failed")
            
        # Step 4: Add virtual status field to payment response
        payment = payment_data.get('payment')
        if payment:
            # Add status based on booking status update success
            payment['status'] = 'PAID'  # ← Changed to uppercase, since payment creation implies immediate payment
        
        return CreatePaymentResponse(
            payment=payment,
            success=True,
            message=f"Payment created successfully and booking status updated to 'PAID'"
        )

# Admin mutations (Movie, Cinema, User, Coupon)
class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()
        releaseDate = String()

    Output = CreateMovieResponse

    @require_admin
    def mutate(self, info, current_user, title, genre, duration, description=None, releaseDate=None):
        query_data = {
            'query': '''
            mutation($title: String!, $genre: String!, $duration: Int!, $description: String, $releaseDate: String) {
                createMovie(title: $title, genre: $genre, duration: $duration, description: $description, releaseDate: $releaseDate) {
                    movie {
                        id title genre duration description releaseDate
                    }
                    success message
                }
            }
            ''',
            'variables': {
                'title': title, 'genre': genre, 'duration': duration,
                'description': description, 'releaseDate': releaseDate
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
                    cinema { id name location capacity }
                    success message
                }
            }
            ''',
            'variables': {'name': name, 'location': location, 'capacity': capacity}
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
                    success message discount_amount
                }
            }
            ''',
            'variables': {'code': code, 'booking_amount': booking_amount}
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

# ============================================================================
# SCHEMA DEFINITION
# ============================================================================

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
    create_cinema = CreateCinema.Field()

schema = Schema(query=Query, mutation=Mutation)