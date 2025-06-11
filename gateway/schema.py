import graphene
import requests
import json
import os
from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema, Boolean, JSONString, DateTime
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
    posterUrl = String()    # Added poster URL
    rating = Float()        # Added rating

class CinemaType(ObjectType):
    id = Int()
    name = String()
    city = String()  # Changed from location to city
    capacity = Int()
    auditoriums = List(lambda: AuditoriumType)

class AuditoriumType(ObjectType):
    id = Int()
    cinema_id = Int()
    name = String()
    seat_layout = JSONString()
    cinema = Field(CinemaType)
    
class ShowtimeType(ObjectType):
    id = Int()
    movie_id = Int()
    auditorium_id = Int()
    start_time = String()  # Changed from DateTime() to String()
    price = Float()
    auditorium = Field(AuditoriumType)
    movie = Field(MovieType)
    
    # Add camelCase resolvers for JavaScript compatibility
    movieId = Int()
    auditoriumId = Int()
    startTime = String()  # Changed from DateTime() to String()
    
    def resolve_movieId(self, info):
        if isinstance(self, dict):
            return self.get('movieId') or self.get('movie_id')
        return getattr(self, 'movie_id', None)
    
    def resolve_auditoriumId(self, info):
        if isinstance(self, dict):
            return self.get('auditoriumId') or self.get('auditorium_id')
        return getattr(self, 'auditorium_id', None)
    
    def resolve_startTime(self, info):
        """
        Handle startTime field - return cleaned string without quotes
        """
        if isinstance(self, dict):
            start_time_value = self.get('startTime') or self.get('start_time')
        else:
            start_time_value = getattr(self, 'start_time', None)
        
        if start_time_value:
            # Clean the datetime string by removing quotes
            if isinstance(start_time_value, str):
                # Remove surrounding quotes if present
                clean_value = start_time_value.strip("'\"")
                return clean_value
            return str(start_time_value)
        
        return None

    def resolve_start_time(self, info):
        """
        Handle start_time field (snake_case version)
        """
        return self.resolve_startTime(info)

class SeatStatusType(ObjectType):
    id = Int()
    showtime_id = Int()
    seat_number = String()
    status = String()
    booking_id = Int()
    updated_at = DateTime()
    
class TicketType(ObjectType):
    id = Int()
    bookingId = Int()        
    seatNumber = String() 
    
    def resolve_bookingId(self, info):
        # Handle dict data (from service response) and object data (from model)
        if isinstance(self, dict):
            return self.get('bookingId') or self.get('booking_id')
        return self.booking_id if hasattr(self, 'booking_id') else getattr(self, 'bookingId', None)
        
    def resolve_seatNumber(self, info):
        # Handle dict data (from service response) and object data (from model)
        if isinstance(self, dict):
            return self.get('seatNumber') or self.get('seat_number')
        return self.seat_number if hasattr(self, 'seat_number') else getattr(self, 'seatNumber', None)
    
class BookingType(ObjectType):
    """Updated booking type for new structure"""
    id = Int()
    user_id = Int()
    showtime_id = Int()  
    status = String()
    total_price = Float()
    booking_date = String()
    tickets = List(TicketType)
    
    def resolve_userId(self, info):
        return self.user_id if hasattr(self, 'user_id') else getattr(self, 'userId', None)
    
    def resolve_showtimeId(self, info):
        return self.showtime_id if hasattr(self, 'showtime_id') else getattr(self, 'showtimeId', None)
        
    def resolve_totalPrice(self, info):
        return float(self.total_price) if hasattr(self, 'total_price') and self.total_price else getattr(self, 'totalPrice', None)
        
    def resolve_bookingDate(self, info):
        if hasattr(self, 'booking_date') and self.booking_date:
            return self.booking_date.isoformat()
        return getattr(self, 'bookingDate', None)
    
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
    booking = Field(lambda: EnrichedBookingType)  # Add enriched booking data

class EnrichedBookingType(ObjectType):
    """Enriched booking type for payment details"""
    id = Int()
    userId = Int()           # Changed from user_id to userId (camelCase)
    showtimeId = Int()       # Changed from showtime_id to showtimeId (camelCase)
    status = String()
    totalPrice = Float()     # Changed from total_price to totalPrice (camelCase)
    bookingDate = String()   # Changed from booking_date to bookingDate (camelCase)
    user = Field(UserType)   # For admin view
    showtime = Field(lambda: EnrichedShowtimeType)
    tickets = List(TicketType)

class EnrichedShowtimeType(ObjectType):
    """Enriched showtime type for payment details"""
    id = Int()
    movieId = Int()          # Changed from movie_id to movieId (camelCase)
    auditoriumId = Int()     # Changed from auditorium_id to auditoriumId (camelCase)
    startTime = String()     # Changed from DateTime() to String() to avoid compatibility issues
    price = Float()
    auditorium = Field(AuditoriumType)
    movie = Field(MovieType)
    
class CouponType(ObjectType):
    id = Int()
    code = String()
    name = String()
    discountPercentage = Float()
    validUntil = String()
    isActive = Boolean()
    stock = Int()  # Tambahkan field stock
    createdAt = String()
    updatedAt = String()

class UserEligibilityType(ObjectType):
    userId = Int()          # ✓ Changed from user_id to userId
    paymentCount = Int()    # ✓ Changed from payment_count to paymentCount
    isEligible = Boolean()  # ✓ Changed from is_eligible to isEligible
    paymentsNeeded = Int()  # ✓ Changed from payments_needed to paymentsNeeded

class RedeemCouponResponse(ObjectType):
    success = Boolean()
    message = String()
    discountAmount = Float()  # ✓ Changed from discount_amount to discountAmount
    coupon = Field(CouponType)

class UpdatePaymentCountResponse(ObjectType):
    userId = Int()          # ✓ Changed from user_id to userId
    paymentCount = Int()    # ✓ Changed from payment_count to paymentCount
    isEligible = Boolean()  # ✓ Changed from is_eligible to isEligible
    paymentsNeeded = Int() 
    
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

class UpdateMovieResponse(ObjectType):
    movie = Field(MovieType)
    success = Boolean()
    message = String()
    
class CreateCinemaResponse(ObjectType):
    cinema = Field(CinemaType)
    success = Boolean()
    message = String()

class CreateAuditoriumResponse(ObjectType):
    auditorium = Field(AuditoriumType)
    success = Boolean()
    message = String()

class CreateShowtimeResponse(ObjectType):
    showtime = Field(ShowtimeType)
    success = Boolean()
    message = String()

class UpdateSeatStatusResponse(ObjectType):
    seat_status = Field(SeatStatusType)
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

class UpdateCinemaResponse(ObjectType):
    cinema = Field(CinemaType)
    success = Boolean()
    message = String()

# ============================================================================
# QUERY RESOLVERS
# ============================================================================

class Query(ObjectType):
    # Public queries (no authentication required)
    test = String()
    publicMovies = List(MovieType)
    publicCinemas = List(CinemaType)
    
    # User authenticated queries
    movies = List(MovieType)
    cinemas = List(CinemaType)
    auditoriums = List(AuditoriumType, cinema_id=Int())
    showtimes = List(ShowtimeType, movie_id=Int(), auditorium_id=Int())
    seat_statuses = List(SeatStatusType, showtime_id=Int(required=True))
    
    # COUPON QUERIES - DIPERBAIKI NAMA FIELD
    availableCoupons = List(CouponType)  # ✓ Field name sudah benar
    userEligibility = Field(UserEligibilityType)  # ✓ Changed from user_eligibility ke userEligibility
    coupons = List(CouponType)  # ✓ Admin only
    
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
        return "Cinema GraphQL API is working!"

    # PUBLIC RESOLVERS - No authentication required
    def resolve_publicMovies(self, info):  # FIXED: Method name changed
        """Get movies for public display (no auth required)"""
        query_data = {
            'query': '''
            {
                movies {
                    id
                    title
                    genre
                    duration
                    description
                    releaseDate
                    posterUrl
                    rating
                }
            }
            '''
        }
        
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        response = handle_service_response(result, 'movie', 'movies')
        
        if not response['success']:
            print(f"Error fetching public movies: {response['error']}")
            return []
        
        return response['data'] or []


    def resolve_publicCinemas(self, info):  # FIXED: Method name changed
        """Get cinemas for public display (no auth required)"""
        query_data = {
            'query': '''
            {
                cinemas {
                    id
                    name
                    city
                    capacity
                }
            }
            '''
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        response = handle_service_response(result, 'cinema', 'cinemas')
        
        if not response['success']:
            print(f"Error fetching public cinemas: {response['error']}")
            return []
        
        return response['data'] or []

    @require_auth
    def resolve_movies(self, info, current_user):
        query_data = {'query': '{ movies { id title genre duration description releaseDate } }'}
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        
        response = handle_service_response(result, 'movie', 'movies')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']


    def resolve_cinemas(self, info):
        query_data = {'query': '{ cinemas { id name city capacity auditoriums { id name seatLayout } } }'}
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        response = handle_service_response(result, 'cinema', 'cinemas')
        if not response['success']:
            raise Exception(response['error'])
        
        # Transform camelCase response to snake_case for gateway types
        cinemas = response['data']
        if cinemas:
            for cinema in cinemas:
                # Transform auditoriums nested data
                if 'auditoriums' in cinema and cinema['auditoriums']:
                    for auditorium in cinema['auditoriums']:
                        # Transform camelCase to snake_case to match gateway AuditoriumType
                        if 'seatLayout' in auditorium:
                            auditorium['seat_layout'] = auditorium.pop('seatLayout')
        return cinemas
    
    @require_auth
    def resolve_availableCoupons(self, info, current_user):
        """Get available coupons - user can see available coupons"""
        query_data = {'query': '{ availableCoupons { id code name discountPercentage validUntil isActive stock } }'}
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'availableCoupons')
        if not response['success']:
            raise Exception(response['error'])
        return response['data'] or []
    

    @require_admin
    def resolve_coupons(self, info, current_user):
        """Get all coupons - admin only"""
        query_data = {'query': '{ coupons { id code name discountPercentage validUntil isActive stock createdAt updatedAt } }'}
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'coupons')
        if not response['success']:
            raise Exception(response['error'])
        return response['data'] or []

    @require_auth
    def resolve_userEligibility(self, info, current_user):
        """Check if current user is eligible for coupons"""
        query_data = {
            'query': '{ userEligibility(userId: %d) { userId paymentCount isEligible paymentsNeeded } }' % current_user['user_id']
        }
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'userEligibility')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']

    @require_auth
    def resolve_my_bookings(self, info, current_user):
        """Get user's bookings with updated booking structure"""
        user_id = current_user['user_id']
        query = f'''
        {{ 
            userBookings(userId: {user_id}) {{ 
                id 
                userId 
                showtimeId 
                status 
                totalPrice 
                bookingDate 
            }} 
        }}
        '''
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        response = handle_service_response(result, 'booking', 'userBookings')
        if not response['success']:
            raise Exception(response['error'])
        
        # Enrich bookings with ticket details (same pattern as payment queries)
        bookings = response['data'] or []
        
        for booking in bookings:
            booking_id = booking.get('id')
            print(f"Processing booking {booking_id} for user {user_id}")  # Debug log
            
            if booking_id:
                # Get tickets for this booking (same pattern as payment queries)
                tickets_query = {
                    'query': f'''
                    {{
                        tickets(bookingId: {booking_id}) {{
                            id
                            bookingId
                            seatNumber
                        }}
                    }}
                    '''
                }
                
                tickets_result = make_service_request(SERVICE_URLS['booking'], tickets_query, 'booking')
                print(f"Tickets service response for booking {booking_id}: {tickets_result}")  # Debug log
                
                if tickets_result and not tickets_result.get('errors'):
                    tickets_data = tickets_result.get('data', {}).get('tickets', [])
                    print(f"Raw tickets data for booking {booking_id}: {tickets_data}")  # Debug log
                    
                    # Use same ticket transformation as payment queries
                    from types import SimpleNamespace
                    
                    transformed_tickets = []
                    for ticket in tickets_data:
                        print(f"Processing ticket: {ticket}")  # Debug log
                        
                        # Handle both possible field name formats from the booking service
                        ticket_id = ticket.get('id')
                        booking_id_field = ticket.get('bookingId') or ticket.get('booking_id')
                        seat_number_field = ticket.get('seatNumber') or ticket.get('seat_number')
                        
                        print(f"Ticket fields - id: {ticket_id}, bookingId: {booking_id_field}, seatNumber: {seat_number_field}")  # Debug log
                        
                        # Create an object-like structure instead of dict (same as payment queries)
                        ticket_obj = SimpleNamespace()
                        ticket_obj.id = ticket_id
                        ticket_obj.bookingId = booking_id_field
                        ticket_obj.seatNumber = seat_number_field
                        
                        # Also set snake_case variants for field resolvers
                        ticket_obj.booking_id = booking_id_field
                        ticket_obj.seat_number = seat_number_field
                        
                        transformed_tickets.append(ticket_obj)
                        print(f"Created ticket object: id={ticket_obj.id}, bookingId={ticket_obj.bookingId}, seatNumber={ticket_obj.seatNumber}")  # Debug log
                    
                    # Set tickets directly on booking object
                    booking['tickets'] = transformed_tickets
                    print(f"Final transformed tickets count for booking {booking_id}: {len(transformed_tickets)}")  # Debug log
                else:
                    print(f"Tickets service failed for booking {booking_id}: {tickets_result}")
                    booking['tickets'] = []
            else:
                print(f"No booking ID found for booking: {booking}")
                booking['tickets'] = []
        
        # Transform camelCase response to snake_case for gateway BookingType
        if bookings:
            transformed_bookings = []
            for booking in bookings:
                transformed_booking = {
                    'id': booking.get('id'),
                    'user_id': booking.get('userId'),  # Transform camelCase to snake_case
                    'showtime_id': booking.get('showtimeId'),  # Transform camelCase to snake_case
                    'status': booking.get('status'),
                    'total_price': booking.get('totalPrice'),  # Transform camelCase to snake_case
                    'booking_date': booking.get('bookingDate'),  # Transform camelCase to snake_case
                    'tickets': booking.get('tickets')  # Keep the enriched tickets
                }
                transformed_bookings.append(transformed_booking)
            return transformed_bookings
        
        return bookings

    @require_auth
    def resolve_my_payments(self, info, current_user):
        user_id = current_user['user_id']
        # Updated query to request all fields including paymentProofImage
        query = f'{{ userPayments(userId: {user_id}) {{ id userId bookingId amount paymentMethod paymentProofImage status createdAt updatedAt canBeDeleted }} }}'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        response = handle_service_response(result, 'payment', 'userPayments')
        if not response['success']:
            raise Exception(response['error'])
        
        # Enrich payments with booking, showtime, seat, and movie details
        payments = response['data'] or []
        
        for payment in payments:
            # Handle missing fields with defaults but keep actual values if they exist
            if payment.get('paymentMethod') is None:
                payment['paymentMethod'] = 'CREDIT_CARD'
            if payment.get('createdAt') is None:
                payment['createdAt'] = '2024-01-01T00:00:00Z'
            if payment.get('updatedAt') is None:
                payment['updatedAt'] = '2024-01-01T00:00:00Z'
            if payment.get('canBeDeleted') is None:
                payment['canBeDeleted'] = True
            
            # Get booking details - ensure we have bookingId
            booking_id = payment.get('bookingId')
            print(f"Processing payment {payment.get('id')} with bookingId: {booking_id}")  # Debug log
            
            if booking_id:
                # Use the same pattern as resolve_showtimes for fetching related data
                booking_query = {
                    'query': f'''
                    {{
                        booking(id: {booking_id}) {{
                            id
                            userId
                            showtimeId
                            status
                            totalPrice
                            bookingDate
                        }}
                    }}
                    '''
                }
                
                print(f"Querying booking service with: {booking_query}")  # Debug log
                booking_result = make_service_request(SERVICE_URLS['booking'], booking_query, 'booking')
                print(f"Booking service response: {booking_result}")  # Debug log
                
                # Handle booking response like resolve_showtimes handles movie response
                if booking_result and not booking_result.get('errors'):
                    booking_data = booking_result.get('data', {}).get('booking')
                    print(f"Booking data extracted: {booking_data}")  # Debug log
                    
                    if booking_data:
                        # Transform to camelCase for EnrichedBookingType (like resolve_showtimes does)
                        payment['booking'] = {
                            'id': booking_data.get('id'),
                            'userId': booking_data.get('userId'),
                            'showtimeId': booking_data.get('showtimeId'),
                            'status': booking_data.get('status'),
                            'totalPrice': booking_data.get('totalPrice'),
                            'bookingDate': booking_data.get('bookingDate')
                        }
                        
                        # Update payment status to match booking status
                        payment['status'] = booking_data.get('status', payment.get('status', 'UNKNOWN'))
                        
                        # Get showtime details
                        showtime_id = booking_data.get('showtimeId')
                        print(f"Fetching showtime with ID: {showtime_id}")  # Debug log
                        
                        if showtime_id:
                            showtime_query = {
                                'query': f'''
                                {{
                                    showtime(id: {showtime_id}) {{
                                        id
                                        movieId
                                        auditoriumId
                                        startTime
                                        price
                                        auditorium {{
                                            id
                                            name
                                            cinema {{
                                                id
                                                name
                                                city
                                            }}
                                        }}
                                    }}
                                }}
                                '''
                            }
                            
                            showtime_result = make_service_request(SERVICE_URLS['cinema'], showtime_query, 'cinema')
                            print(f"Showtime service response: {showtime_result}")  # Debug log
                            
                            if showtime_result and not showtime_result.get('errors'):
                                showtime_data = showtime_result.get('data', {}).get('showtime')
                                print(f"Showtime data extracted: {showtime_data}")  # Debug log
                                
                                if showtime_data:
                                    # Fix startTime handling - convert to string if it's a datetime object
                                    start_time = showtime_data.get('startTime')
                                    if start_time:
                                        # Convert datetime to string if needed
                                        if isinstance(start_time, str):
                                            # Remove extra quotes if present
                                            start_time = start_time.strip("'\"")
                                        else:
                                            # Convert datetime object to string
                                            try:
                                                start_time = start_time.isoformat() if hasattr(start_time, 'isoformat') else str(start_time)
                                            except:
                                                start_time = str(start_time)
                                    
                                    # Keep camelCase for EnrichedShowtimeType (like resolve_showtimes pattern)
                                    payment['booking']['showtime'] = {
                                        'id': showtime_data.get('id'),
                                        'movieId': showtime_data.get('movieId'),
                                        'auditoriumId': showtime_data.get('auditoriumId'),
                                        'startTime': start_time,  # Use the properly formatted startTime
                                        'price': showtime_data.get('price'),
                                        'auditorium': showtime_data.get('auditorium')
                                    }
                                    
                                    # Get movie details (following the exact same pattern as resolve_showtimes)
                                    movie_id_value = showtime_data.get('movieId')
                                    print(f"Fetching movie with ID: {movie_id_value}")  # Debug log
                                    
                                    if movie_id_value:
                                        movie_query = {
                                            'query': f'''
                                            {{
                                                movie(id: {movie_id_value}) {{
                                                    id
                                                    title
                                                    genre
                                                    duration
                                                    description
                                                    releaseDate
                                                    posterUrl
                                                    rating
                                                }}
                                            }}
                                            '''
                                        }
                                        
                                        movie_result = make_service_request(SERVICE_URLS['movie'], movie_query, 'movie')
                                        print(f"Movie service response: {movie_result}")  # Debug log
                                        
                                        if movie_result and not movie_result.get('errors'):
                                            movie_data = movie_result.get('data', {}).get('movie')
                                            if movie_data:
                                                # Add movie details to showtime (exact same as resolve_showtimes)
                                                payment['booking']['showtime']['movie'] = {
                                                    'id': movie_data.get('id'),
                                                    'title': movie_data.get('title'),
                                                    'genre': movie_data.get('genre'),
                                                    'duration': movie_data.get('duration'),
                                                    'description': movie_data.get('description'),
                                                    'releaseDate': movie_data.get('releaseDate'),
                                                    'posterUrl': movie_data.get('posterUrl'),
                                                    'rating': movie_data.get('rating')
                                                }
                                            else:
                                                print(f"No movie data found for movie ID {movie_id_value}")
                                        else:
                                            print(f"Movie service failed for movie ID {movie_id_value}: {movie_result}")
                                            # Add placeholder movie if service fails
                                            payment['booking']['showtime']['movie'] = {
                                                'id': movie_id_value,
                                                'title': 'Unknown Movie',
                                                'genre': 'Unknown',
                                                'duration': 0,
                                                'description': 'Movie details unavailable',
                                                'releaseDate': '2024-01-01',
                                                'posterUrl': None,
                                                'rating': 0.0
                                            }
                                    else:
                                        print(f"No movieId found in showtime data: {showtime_data}")
                                    
                                    # Get seat details (tickets for this booking) - CRITICAL FIX HERE!
                                    print(f"Fetching tickets for booking ID: {booking_id}")  # Debug log
                                    
                                    tickets_query = {
                                        'query': f'''
                                        {{
                                            tickets(bookingId: {booking_id}) {{
                                                id
                                                bookingId
                                                seatNumber
                                            }}
                                        }}
                                        '''
                                    }
                                    
                                    tickets_result = make_service_request(SERVICE_URLS['booking'], tickets_query, 'booking')
                                    print(f"Tickets service response: {tickets_result}")  # Debug log
                                    
                                    if tickets_result and not tickets_result.get('errors'):
                                        tickets_data = tickets_result.get('data', {}).get('tickets', [])
                                        print(f"Raw tickets data from service: {tickets_data}")  # Debug log
                                        
                                        # CRITICAL FIX: Create proper ticket objects instead of dict transformation
                                        from types import SimpleNamespace
                                        
                                        transformed_tickets = []
                                        for ticket in tickets_data:
                                            print(f"Processing ticket: {ticket}")  # Debug log
                                            
                                            # Handle both possible field name formats from the booking service
                                            ticket_id = ticket.get('id')
                                            booking_id_field = ticket.get('bookingId') or ticket.get('booking_id')
                                            seat_number_field = ticket.get('seatNumber') or ticket.get('seat_number')
                                            
                                            print(f"Ticket fields - id: {ticket_id}, bookingId: {booking_id_field}, seatNumber: {seat_number_field}")  # Debug log
                                            
                                            # Create an object-like structure instead of dict
                                            ticket_obj = SimpleNamespace()
                                            ticket_obj.id = ticket_id
                                            ticket_obj.bookingId = booking_id_field
                                            ticket_obj.seatNumber = seat_number_field
                                            
                                            # Also set snake_case variants for field resolvers
                                            ticket_obj.booking_id = booking_id_field
                                            ticket_obj.seat_number = seat_number_field
                                            
                                            transformed_tickets.append(ticket_obj)
                                            print(f"Created ticket object: id={ticket_obj.id}, bookingId={ticket_obj.bookingId}, seatNumber={ticket_obj.seatNumber}")  # Debug log
                                        
                                        payment['booking']['tickets'] = transformed_tickets
                                        print(f"Final transformed tickets count: {len(transformed_tickets)}")  # Debug log
                                    else:
                                        print(f"Tickets service failed for booking {booking_id}: {tickets_result}")
                                        payment['booking']['tickets'] = []
                                else:
                                    print(f"No showtime data found for showtime ID {showtime_id}")
                                    payment['booking']['showtime'] = None
                                    payment['booking']['tickets'] = []
                            else:
                                print(f"Showtime service failed for showtime ID {showtime_id}: {showtime_result}")
                                payment['booking']['showtime'] = None
                                payment['booking']['tickets'] = []
                        else:
                            print(f"No showtimeId found in booking data: {booking_data}")
                            payment['booking']['showtime'] = None
                            payment['booking']['tickets'] = []
                    else:
                        print(f"No booking data found for booking ID {booking_id}")
                        payment['booking'] = None
                else:
                    print(f"Booking service failed or returned errors for booking ID {booking_id}: {booking_result}")
                    payment['booking'] = None
            else:
                print(f"No bookingId found in payment: {payment}")
                payment['booking'] = None
        
        print(f"Final payments data: {payments}")  # Debug log
        return payments

    @require_admin
    def resolve_all_bookings(self, info, current_user):
        """Get all bookings - admin only with updated booking structure"""
        query = '''
        { 
            bookings { 
                id 
                userId 
                showtimeId 
                status 
                totalPrice 
                bookingDate 
            } 
        }
        '''
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        
        response = handle_service_response(result, 'booking', 'bookings')
        if not response['success']:
            raise Exception(response['error'])
        
        # Enrich bookings with ticket details (same pattern as payment queries)
        bookings = response['data'] or []
        
        for booking in bookings:
            booking_id = booking.get('id')
            print(f"[ADMIN] Processing booking {booking_id}")  # Debug log
            
            if booking_id:
                # Get tickets for this booking (same pattern as payment queries)
                tickets_query = {
                    'query': f'''
                    {{
                        tickets(bookingId: {booking_id}) {{
                            id
                            bookingId
                            seatNumber
                        }}
                    }}
                    '''
                }
                
                tickets_result = make_service_request(SERVICE_URLS['booking'], tickets_query, 'booking')
                print(f"[ADMIN] Tickets service response for booking {booking_id}: {tickets_result}")  # Debug log
                
                if tickets_result and not tickets_result.get('errors'):
                    tickets_data = tickets_result.get('data', {}).get('tickets', [])
                    print(f"[ADMIN] Raw tickets data for booking {booking_id}: {tickets_data}")  # Debug log
                    
                    # Use same ticket transformation as payment queries
                    from types import SimpleNamespace
                    
                    transformed_tickets = []
                    for ticket in tickets_data:
                        print(f"[ADMIN] Processing ticket: {ticket}")  # Debug log
                        
                        # Handle both possible field name formats from the booking service
                        ticket_id = ticket.get('id')
                        booking_id_field = ticket.get('bookingId') or ticket.get('booking_id')
                        seat_number_field = ticket.get('seatNumber') or ticket.get('seat_number')
                        
                        print(f"[ADMIN] Ticket fields - id: {ticket_id}, bookingId: {booking_id_field}, seatNumber: {seat_number_field}")  # Debug log
                        
                        # Create an object-like structure instead of dict (same as payment queries)
                        ticket_obj = SimpleNamespace()
                        ticket_obj.id = ticket_id
                        ticket_obj.bookingId = booking_id_field
                        ticket_obj.seatNumber = seat_number_field
                        
                        # Also set snake_case variants for field resolvers
                        ticket_obj.booking_id = booking_id_field
                        ticket_obj.seat_number = seat_number_field
                        
                        transformed_tickets.append(ticket_obj)
                        print(f"[ADMIN] Created ticket object: id={ticket_obj.id}, bookingId={ticket_obj.bookingId}, seatNumber={ticket_obj.seatNumber}")  # Debug log
                    
                    # Set tickets directly on booking object
                    booking['tickets'] = transformed_tickets
                    print(f"[ADMIN] Final transformed tickets count for booking {booking_id}: {len(transformed_tickets)}")  # Debug log
                else:
                    print(f"[ADMIN] Tickets service failed for booking {booking_id}: {tickets_result}")
                    booking['tickets'] = []
            else:
                print(f"[ADMIN] No booking ID found for booking: {booking}")
                booking['tickets'] = []
        
        # Transform camelCase response to snake_case for gateway BookingType
        if bookings:
            transformed_bookings = []
            for booking in bookings:
                transformed_booking = {
                    'id': booking.get('id'),
                    'user_id': booking.get('userId'),  # Transform camelCase to snake_case
                    'showtime_id': booking.get('showtimeId'),  # Transform camelCase to snake_case
                    'status': booking.get('status'),
                    'total_price': booking.get('totalPrice'),  # Transform camelCase to snake_case
                    'booking_date': booking.get('bookingDate'),  # Transform camelCase to snake_case
                    'tickets': booking.get('tickets')  # Keep the enriched tickets
                }
                transformed_bookings.append(transformed_booking)
            return transformed_bookings
        
        return bookings
    
    @require_admin
    def resolve_all_payments(self, info, current_user):
        query = '{ payments { id userId bookingId amount paymentMethod paymentProofImage status createdAt updatedAt canBeDeleted } }'
        query_data = {'query': query}
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        
        response = handle_service_response(result, 'payment', 'payments')
        if not response['success']:
            raise Exception(response['error'])
        
        # Enrich payments with booking, showtime, seat, and movie details
        payments = response['data'] or []
        
        for payment in payments:
            # Handle missing fields with defaults but keep actual values if they exist
            if payment.get('paymentMethod') is None:
                payment['paymentMethod'] = 'CREDIT_CARD'
            if payment.get('createdAt') is None:
                payment['createdAt'] = '2024-01-01T00:00:00Z'
            if payment.get('updatedAt') is None:
                payment['updatedAt'] = '2024-01-01T00:00:00Z'
            if payment.get('canBeDeleted') is None:
                payment['canBeDeleted'] = True
            if payment.get('status') is None:
                payment['status'] = 'PAID'  # Default for admin view
            
            # Get booking details - ensure we have bookingId
            booking_id = payment.get('bookingId')
            print(f"[ADMIN] Processing payment {payment.get('id')} with bookingId: {booking_id}")  # Debug log
            
            if booking_id:
                booking_query = {
                    'query': f'''
                    {{
                        booking(id: {booking_id}) {{
                            id
                            userId
                            showtimeId
                            status
                            totalPrice
                            bookingDate
                        }}
                    }}
                    '''
                }
                
                print(f"[ADMIN] Querying booking service with: {booking_query}")  # Debug log
                booking_result = make_service_request(SERVICE_URLS['booking'], booking_query, 'booking')
                print(f"[ADMIN] Booking service response: {booking_result}")  # Debug log
                
                if booking_result and not booking_result.get('errors'):
                    booking_data = booking_result.get('data', {}).get('booking')
                    print(f"[ADMIN] Booking data extracted: {booking_data}")  # Debug log
                    
                    if booking_data:
                        # Transform to camelCase for EnrichedBookingType (same as user method)
                        payment['booking'] = {
                            'id': booking_data.get('id'),
                            'userId': booking_data.get('userId'),
                            'showtimeId': booking_data.get('showtimeId'),
                            'status': booking_data.get('status'),
                            'totalPrice': booking_data.get('totalPrice'),
                            'bookingDate': booking_data.get('bookingDate')
                        }
                        
                        # Update payment status to match booking status
                        payment['status'] = booking_data.get('status', payment.get('status', 'PAID'))
                        
                        # Get user details for admin view
                        user_id = booking_data.get('userId')
                        if user_id:
                            user_query = {
                                'query': f'''
                                {{
                                    user(id: {user_id}) {{
                                        id
                                        username
                                        email
                                        role
                                    }}
                                }}
                                '''
                            }
                            
                            user_result = make_service_request(SERVICE_URLS['user'], user_query, 'user')
                            if user_result and not user_result.get('errors'):
                                user_data = user_result.get('data', {}).get('user')
                                if user_data:
                                    payment['booking']['user'] = user_data
                        
                        # Get showtime details (same pattern as user method)
                        showtime_id = booking_data.get('showtimeId')
                        print(f"[ADMIN] Fetching showtime with ID: {showtime_id}")  # Debug log
                        
                        if showtime_id:
                            showtime_query = {
                                'query': f'''
                                {{
                                    showtime(id: {showtime_id}) {{
                                        id
                                        movieId
                                        auditoriumId
                                        startTime
                                        price
                                        auditorium {{
                                            id
                                            name
                                            cinema {{
                                                id
                                                name
                                                city
                                            }}
                                        }}
                                    }}
                                }}
                                '''
                            }
                            
                            showtime_result = make_service_request(SERVICE_URLS['cinema'], showtime_query, 'cinema')
                            print(f"[ADMIN] Showtime service response: {showtime_result}")  # Debug log
                            
                            if showtime_result and not showtime_result.get('errors'):
                                showtime_data = showtime_result.get('data', {}).get('showtime')
                                print(f"[ADMIN] Showtime data extracted: {showtime_data}")  # Debug log
                                
                                if showtime_data:
                                    # Fix startTime handling (same as user method)
                                    start_time = showtime_data.get('startTime')
                                    if start_time:
                                        if isinstance(start_time, str):
                                            start_time = start_time.strip("'\"")
                                        else:
                                            try:
                                                start_time = start_time.isoformat() if hasattr(start_time, 'isoformat') else str(start_time)
                                            except:
                                                start_time = str(start_time)
                                    
                                    # Keep camelCase for EnrichedShowtimeType (same as user method)
                                    payment['booking']['showtime'] = {
                                        'id': showtime_data.get('id'),
                                        'movieId': showtime_data.get('movieId'),
                                        'auditoriumId': showtime_data.get('auditoriumId'),
                                        'startTime': start_time,
                                        'price': showtime_data.get('price'),
                                        'auditorium': showtime_data.get('auditorium')
                                    }
                                    
                                    # Get movie details (same pattern as user method)
                                    movie_id_value = showtime_data.get('movieId')
                                    print(f"[ADMIN] Fetching movie with ID: {movie_id_value}")  # Debug log
                                    
                                    if movie_id_value:
                                        movie_query = {
                                            'query': f'''
                                            {{
                                                movie(id: {movie_id_value}) {{
                                                    id
                                                    title
                                                    genre
                                                    duration
                                                    description
                                                    releaseDate
                                                    posterUrl
                                                    rating
                                                }}
                                            }}
                                            '''
                                        }
                                        
                                        movie_result = make_service_request(SERVICE_URLS['movie'], movie_query, 'movie')
                                        print(f"[ADMIN] Movie service response: {movie_result}")  # Debug log
                                        
                                        if movie_result and not movie_result.get('errors'):
                                            movie_data = movie_result.get('data', {}).get('movie')
                                            if movie_data:
                                                payment['booking']['showtime']['movie'] = {
                                                    'id': movie_data.get('id'),
                                                    'title': movie_data.get('title'),
                                                    'genre': movie_data.get('genre'),
                                                    'duration': movie_data.get('duration'),
                                                    'description': movie_data.get('description'),
                                                    'releaseDate': movie_data.get('releaseDate'),
                                                    'posterUrl': movie_data.get('posterUrl'),
                                                    'rating': movie_data.get('rating')
                                                }
                                            else:
                                                print(f"[ADMIN] No movie data found for movie ID {movie_id_value}")
                                        else:
                                            print(f"[ADMIN] Movie service failed for movie ID {movie_id_value}: {movie_result}")
                                            # Add placeholder movie if service fails
                                            payment['booking']['showtime']['movie'] = {
                                                'id': movie_id_value,
                                                'title': 'Unknown Movie',
                                                'genre': 'Unknown',
                                                'duration': 0,
                                                'description': 'Movie details unavailable',
                                                'releaseDate': '2024-01-01',
                                                'posterUrl': None,
                                                'rating': 0.0
                                            }
                                    else:
                                        print(f"[ADMIN] No movieId found in showtime data: {showtime_data}")
                                    
                                    # Get seat details (tickets for this booking) - SAME FIX AS USER METHOD
                                    print(f"[ADMIN] Fetching tickets for booking ID: {booking_id}")  # Debug log
                                    
                                    tickets_query = {
                                        'query': f'''
                                        {{
                                            tickets(bookingId: {booking_id}) {{
                                                id
                                                bookingId
                                                seatNumber
                                            }}
                                        }}
                                        '''
                                    }
                                    
                                    tickets_result = make_service_request(SERVICE_URLS['booking'], tickets_query, 'booking')
                                    print(f"[ADMIN] Tickets service response: {tickets_result}")  # Debug log
                                    
                                    if tickets_result and not tickets_result.get('errors'):
                                        tickets_data = tickets_result.get('data', {}).get('tickets', [])
                                        print(f"[ADMIN] Raw tickets data from service: {tickets_data}")  # Debug log
                                        
                                        # CRITICAL FIX: Use same ticket handling as user method
                                        from types import SimpleNamespace
                                        
                                        transformed_tickets = []
                                        for ticket in tickets_data:
                                            print(f"[ADMIN] Processing ticket: {ticket}")  # Debug log
                                            
                                            # Handle both possible field name formats from the booking service
                                            ticket_id = ticket.get('id')
                                            booking_id_field = ticket.get('bookingId') or ticket.get('booking_id')
                                            seat_number_field = ticket.get('seatNumber') or ticket.get('seat_number')
                                            
                                            print(f"[ADMIN] Ticket fields - id: {ticket_id}, bookingId: {booking_id_field}, seatNumber: {seat_number_field}")  # Debug log
                                            
                                            # Create an object-like structure instead of dict (SAME AS USER METHOD)
                                            ticket_obj = SimpleNamespace()
                                            ticket_obj.id = ticket_id
                                            ticket_obj.bookingId = booking_id_field
                                            ticket_obj.seatNumber = seat_number_field
                                            
                                            # Also set snake_case variants for field resolvers
                                            ticket_obj.booking_id = booking_id_field
                                            ticket_obj.seat_number = seat_number_field
                                            
                                            transformed_tickets.append(ticket_obj)
                                            print(f"[ADMIN] Created ticket object: id={ticket_obj.id}, bookingId={ticket_obj.bookingId}, seatNumber={ticket_obj.seatNumber}")  # Debug log
                                        
                                        payment['booking']['tickets'] = transformed_tickets
                                        print(f"[ADMIN] Final transformed tickets count: {len(transformed_tickets)}")  # Debug log
                                    else:
                                        print(f"[ADMIN] Tickets service failed for booking {booking_id}: {tickets_result}")
                                        payment['booking']['tickets'] = []
                                else:
                                    print(f"[ADMIN] No showtime data found for showtime ID {showtime_id}")
                                    payment['booking']['showtime'] = None
                                    payment['booking']['tickets'] = []
                            else:
                                print(f"[ADMIN] Showtime service failed for showtime ID {showtime_id}: {showtime_result}")
                                payment['booking']['showtime'] = None
                                payment['booking']['tickets'] = []
                        else:
                            print(f"[ADMIN] No showtimeId found in booking data: {booking_data}")
                            payment['booking']['showtime'] = None
                            payment['booking']['tickets'] = []
                    else:
                        print(f"[ADMIN] No booking data found for booking ID {booking_id}")
                        payment['booking'] = None
                else:
                    print(f"[ADMIN] Booking service failed or returned errors for booking ID {booking_id}: {booking_result}")
                    payment['booking'] = None
            else:
                print(f"[ADMIN] No bookingId found in payment: {payment}")
                payment['booking'] = None
        
        print(f"[ADMIN] Final payments data: {payments}")  # Debug log
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


    def resolve_cinema(self, info, id):
        """Get single cinema by ID with auditoriums"""
        query_data = {
            'query': f'''
            {{
                cinema(id: {id}) {{
                    id
                    name
                    city
                    capacity
                    auditoriums {{
                        id
                        name
                        seatLayout
                    }}
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
        
        # Transform camelCase response to snake_case for gateway types
        if cinema_data and 'auditoriums' in cinema_data and cinema_data['auditoriums']:
            for auditorium in cinema_data['auditoriums']:
                # Transform camelCase to snake_case to match gateway AuditoriumType
                if 'seatLayout' in auditorium:
                    auditorium['seat_layout'] = auditorium.pop('seatLayout')
        
        return cinema_data
    

    def resolve_auditoriums(self, info,cinema_id=None):
        if cinema_id:
            query_data = {
                'query': f'''
                {{
                    auditoriumsByCinema(cinemaId: {cinema_id}) {{
                        id
                        cinemaId
                        name
                        seatLayout
                        cinema {{
                            id
                            name
                            city
                        }}
                    }}
                }}
                '''
            }
            data_key = 'auditoriumsByCinema'
        else:
            query_data = {
                'query': '''
                {
                    auditoriums {
                        id
                        cinemaId
                        name
                        seatLayout
                        cinema {
                            id
                            name
                            city
                        }
                    }
                }
                '''
            }
            data_key = 'auditoriums'
            
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        response = handle_service_response(result, 'cinema', data_key)
        if not response['success']:
            raise Exception(response['error'])
        
        # Transform camelCase response to snake_case for gateway AuditoriumType
        auditoriums = response['data']
        if auditoriums:
            for auditorium in auditoriums:
                # Transform camelCase to snake_case to match gateway AuditoriumType
                if 'cinemaId' in auditorium:
                    auditorium['cinema_id'] = auditorium.pop('cinemaId')
                if 'seatLayout' in auditorium:
                    auditorium['seat_layout'] = auditorium.pop('seatLayout')
        
        return auditoriums
    

    def resolve_showtimes(self, info, movie_id=None, auditorium_id=None):
        print(f"resolve_showtimes called with movie_id={movie_id}, auditorium_id={auditorium_id}")
        
        # Get all showtimes from cinema service
        query_data = {
            'query': '''
            {
                showtimes {
                    id
                    movieId
                    auditoriumId
                    startTime
                    price
                    auditorium {
                        id
                        name
                        cinema {
                            id
                            name
                            city
                        }
                    }
                }
            }
            '''
        }
        
        print(f"Making request to cinema service with query: {query_data}")
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        print(f"Cinema service response: {result}")
        
        response = handle_service_response(result, 'cinema', 'showtimes')
        if not response['success']:
            print(f"Error fetching showtimes: {response['error']}")
            return []
        
        # Get raw showtimes data
        raw_showtimes = response['data'] or []
        print(f"Raw showtimes from cinema service: {len(raw_showtimes)} items")
        
        if not raw_showtimes:
            print("No showtimes returned from cinema service")
            return []
        
        # Process each showtime with datetime cleaning
        processed_showtimes = []
        
        for showtime in raw_showtimes:
            try:
                print(f"Processing showtime: {showtime}")
                
                # Create processed showtime with cleaned datetime
                processed_showtime = dict(showtime)  # Copy original
                
                # Clean startTime field if present
                if 'startTime' in processed_showtime:
                    start_time = processed_showtime['startTime']
                    if isinstance(start_time, str):
                        # Clean the datetime string by removing quotes
                        clean_start_time = start_time.strip("'\"")
                        processed_showtime['startTime'] = clean_start_time
                        print(f"Cleaned datetime for showtime {showtime.get('id')}: {start_time} -> {clean_start_time}")
                    else:
                        # Convert to string if not already
                        processed_showtime['startTime'] = str(start_time)
                
                # Apply filtering if needed
                include_showtime = True
                
                if movie_id:
                    showtime_movie_id = processed_showtime.get('movieId')
                    if showtime_movie_id != int(movie_id):
                        include_showtime = False
                        print(f"Filtered out showtime {processed_showtime.get('id')} - movie mismatch")
                
                if auditorium_id and include_showtime:
                    showtime_auditorium_id = processed_showtime.get('auditoriumId')
                    if showtime_auditorium_id != int(auditorium_id):
                        include_showtime = False
                        print(f"Filtered out showtime {processed_showtime.get('id')} - auditorium mismatch")
                
                if include_showtime:
                    # Enrich with movie details
                    movie_id_value = processed_showtime.get('movieId')
                    if movie_id_value:
                        print(f"Fetching movie details for movieId: {movie_id_value}")
                        movie_query = {
                            'query': f'''
                            {{
                                movie(id: {movie_id_value}) {{
                                    id
                                    title
                                    genre
                                    duration
                                    description
                                    releaseDate
                                    posterUrl
                                    rating
                                }}
                            }}
                            '''
                        }
                        
                        try:
                            movie_result = make_service_request(SERVICE_URLS['movie'], movie_query, 'movie')
                            if movie_result and not movie_result.get('errors'):
                                movie_data = movie_result.get('data', {}).get('movie')
                                if movie_data:
                                    processed_showtime['movie'] = movie_data
                                    print(f"Added movie data: {movie_data.get('title')}")
                                else:
                                    print(f"No movie data found for ID {movie_id_value}")
                                    # Add placeholder
                                    processed_showtime['movie'] = {
                                        'id': movie_id_value,
                                        'title': 'Unknown Movie',
                                        'genre': None,
                                        'duration': None,
                                        'posterUrl': None,
                                        'rating': None,
                                        'description': None
                                    }
                            else:
                                print(f"Movie service error: {movie_result}")
                        except Exception as movie_error:
                            print(f"Error fetching movie data: {movie_error}")
                    
                    # Transform to snake_case for gateway compatibility
                    gateway_showtime = {
                        'id': processed_showtime.get('id'),
                        'movie_id': processed_showtime.get('movieId'),
                        'auditorium_id': processed_showtime.get('auditoriumId'),
                        'start_time': processed_showtime.get('startTime'),  # Now cleaned string
                        'price': processed_showtime.get('price'),
                        'auditorium': processed_showtime.get('auditorium'),
                        'movie': processed_showtime.get('movie')
                    }
                    
                    processed_showtimes.append(gateway_showtime)
                    print(f"Added showtime {gateway_showtime.get('id')} to results")
            
            except Exception as process_error:
                print(f"Error processing showtime {showtime}: {process_error}")
                # Continue with next showtime instead of failing completely
                continue
        
        print(f"Final processed showtimes: {len(processed_showtimes)} items")
        if processed_showtimes:
            print(f"Sample processed showtime: {processed_showtimes[0]}")
        
        return processed_showtimes
    

    def resolve_seat_statuses(self, info,showtime_id):
        query_data = {
            'query': f'''
            {{
                seatStatuses(showtimeId: {showtime_id}) {{
                    id
                    showtime_id
                    seat_number
                    status
                    booking_id
                    updated_at
                }}
            }}
            '''
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        response = handle_service_response(result, 'cinema', 'seatStatuses')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']
    
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
# Tambahkan response type untuk update user (setelah class DeleteResponse)
class UpdateUserResponse(ObjectType):
    user = Field(UserType)
    success = Boolean()
    message = String()

# Tambahkan mutation UpdateUser setelah class UseCoupon
class UpdateUser(Mutation):
    class Arguments:
        id = Int(required=True)
        username = String()
        email = String()
        password = String()

    Output = UpdateUserResponse

    @require_auth
    def mutate(self, info, current_user, id, username=None, email=None, password=None):
        # Regular users can only update their own profile
        if current_user['role'] != 'ADMIN' and current_user['user_id'] != id:
            raise Exception("You can only update your own profile")
        
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
        if not result:
            return UpdateUserResponse(user=None, success=False, message="User service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                else:
                    error_messages.append(str(error))
            return UpdateUserResponse(user=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateUser', {})
        if update_result and update_result.get('user'):
            return UpdateUserResponse(
                user=update_result.get('user'),
                success=True,
                message="User updated successfully"
            )
        else:
            return UpdateUserResponse(
                user=None,
                success=False,
                message="Failed to update user"
            )

# Tambahkan juga DeleteUser mutation untuk completeness
class DeleteUser(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin  # Only admin can delete users
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deleteUser(id: $id) {
                    success
                    message
                }
            }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['user'], query_data, 'user')
        if not result:
            return DeleteResponse(success=False, message="User service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return DeleteResponse(success=False, message=f"Error: {'; '.join(error_messages)}")
        
        delete_result = result.get('data', {}).get('deleteUser', {})
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'User deletion completed')
        )
        
class CreateBooking(Mutation):
    """Create booking with new structure"""
    class Arguments:
        showtime_id = Int(required=True)  # Changed to showtime_id
        seat_numbers = List(String, required=True)  # List of seat numbers
        total_price = Float()

    Output = CreateBookingResponse

    @require_auth
    def mutate(self, info, current_user, showtime_id, seat_numbers, total_price=None):
        # Step 1: Validate showtime exists in cinema service
        showtime_check_query = {
            'query': f'''
            {{
                showtime(id: {showtime_id}) {{
                    id
                    movieId
                    auditoriumId
                    startTime
                    price
                    auditorium {{
                        id
                        name
                        seatLayout
                        cinema {{
                            id
                            name
                            city
                        }}
                    }}
                }}
            }}
            '''
        }
        
        showtime_result = make_service_request(SERVICE_URLS['cinema'], showtime_check_query, 'cinema')
        if not showtime_result:
            return CreateBookingResponse(
                booking=None, 
                success=False, 
                message="Cinema service unavailable"
            )
        
        if showtime_result.get('errors'):
            return CreateBookingResponse(
                booking=None, 
                success=False, 
                message=f"Showtime with ID {showtime_id} not found"
            )
        
        showtime_data = showtime_result.get('data', {}).get('showtime')
        if not showtime_data:
            return CreateBookingResponse(
                booking=None, 
                success=False, 
                message=f"Showtime with ID {showtime_id} does not exist"
            )
        
        # Step 2: Validate seat numbers exist in auditorium layout
        auditorium_data = showtime_data.get('auditorium', {})
        seat_layout = auditorium_data.get('seatLayout', {})
        
        # Extract available seat numbers from auditorium layout
        available_seats = []
        if seat_layout:
            # Handle both JSON string and dict formats
            if isinstance(seat_layout, str):
                try:
                    import json
                    seat_layout = json.loads(seat_layout)
                except json.JSONDecodeError:
                    seat_layout = {}
            
            if isinstance(seat_layout, dict):
                seats_data = seat_layout.get('seats', [])
                if isinstance(seats_data, list):
                    for seat in seats_data:
                        if isinstance(seat, dict) and seat.get('number'):
                            available_seats.append(seat.get('number'))
                        elif isinstance(seat, str):
                            available_seats.append(seat)
        
        # If no seats found in layout, get from seat statuses
        if not available_seats:
            seat_status_query = {
                'query': f'''
                {{
                    seatStatuses(showtimeId: {showtime_id}) {{
                        seatNumber
                        status
                    }}
                }}
                '''
            }
            
            seat_status_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
            if seat_status_result and not seat_status_result.get('errors'):
                seat_statuses = seat_status_result.get('data', {}).get('seatStatuses', [])
                available_seats = [status.get('seatNumber') for status in seat_statuses if status.get('seatNumber')]
        
        # Validate all requested seat numbers exist in auditorium
        invalid_seats = [seat for seat in seat_numbers if seat not in available_seats]
        if invalid_seats:
            return CreateBookingResponse(
                booking=None,
                success=False,
                message=f"Invalid seat numbers: {', '.join(invalid_seats)}. Available seats: {', '.join(available_seats)}"
            )
        
        # Step 3: Check if seats are available (not already booked or reserved)
        seat_status_query = {
            'query': f'''
            {{
                seatStatuses(showtimeId: {showtime_id}) {{
                    seatNumber
                    status
                    bookingId
                }}
            }}
            '''
        }
        
        seat_status_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
        if seat_status_result and not seat_status_result.get('errors'):
            seat_statuses = seat_status_result.get('data', {}).get('seatStatuses', [])
            
            # Check if any requested seats are already booked or reserved
            unavailable_seats = []
            for seat_status in seat_statuses:
                seat_number = seat_status.get('seatNumber')
                status = seat_status.get('status')
                
                if seat_number in seat_numbers and status in ['BOOKED', 'RESERVED']:
                    unavailable_seats.append(f"{seat_number} ({status})")
            
            if unavailable_seats:
                return CreateBookingResponse(
                    booking=None,
                    success=False,
                    message=f"Seats not available: {', '.join(unavailable_seats)}"
                )
        
        # Step 4: Calculate total price if not provided
        if total_price is None:
            showtime_price = float(showtime_data.get('price', 0))
            total_price = showtime_price * len(seat_numbers)
        
        # Step 5: Create booking
        query_data = {
            'query': '''
            mutation($userId: Int!, $showtimeId: Int!, $seatNumbers: [String!]!, $totalPrice: Float) {
                createBooking(userId: $userId, showtimeId: $showtimeId, seatNumbers: $seatNumbers, totalPrice: $totalPrice) {
                    booking {
                        id
                        userId
                        showtimeId
                        status
                        totalPrice
                        bookingDate
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'userId': current_user['user_id'],
                'showtimeId': showtime_id,
                'seatNumbers': seat_numbers,
                'totalPrice': total_price
            }
        }
        
        result = make_service_request(SERVICE_URLS['booking'], query_data, 'booking')
        if not result:
            return CreateBookingResponse(
                booking=None, 
                success=False, 
                message="Booking service unavailable"
            )

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
        booking_data = booking_result.get('booking')
        
        # Transform camelCase response to snake_case for gateway BookingType
        if booking_data:
            transformed_booking = {
                'id': booking_data.get('id'),
                'user_id': booking_data.get('userId'),  # Transform camelCase to snake_case
                'showtime_id': booking_data.get('showtimeId'),  # Transform camelCase to snake_case
                'status': booking_data.get('status'),
                'total_price': booking_data.get('totalPrice'),  # Transform camelCase to snake_case
                'booking_date': booking_data.get('bookingDate'),  # Transform camelCase to snake_case
                'tickets': booking_data.get('tickets')
            }
            
            return CreateBookingResponse(
                booking=transformed_booking,
                success=booking_result.get('success', False),
                message=booking_result.get('message', 'Booking created successfully')
            )
        
        return CreateBookingResponse(
            booking=None,
            success=booking_result.get('success', False),
            message=booking_result.get('message', 'Booking operation completed')
        )

class UpdateBooking(Mutation):
    """Update booking - updated to match new booking structure"""
    class Arguments:
        id = Int(required=True)
        showtime_id = Int()  # Changed from movieId/cinemaId to showtime_id
        seat_numbers = List(String)  # Changed from seats string to seat_numbers list
        total_price = Float()  # Changed from totalPrice to total_price
        status = String()

    Output = UpdateBookingResponse

    @require_auth
    def mutate(self, info, current_user, id, showtime_id=None, seat_numbers=None, total_price=None, status=None):
        # Step 1: Get current booking details first
        current_booking_query = {
            'query': f'''
            {{
                booking(id: {id}) {{
                    id
                    userId
                    showtimeId
                    status
                    totalPrice
                }}
            }}
            '''
        }
        
        current_booking_result = make_service_request(SERVICE_URLS['booking'], current_booking_query, 'booking')
        if not current_booking_result:
            return UpdateBookingResponse(
                booking=None, 
                success=False, 
                message="Booking service unavailable"
            )
        
        if current_booking_result.get('errors'):
            return UpdateBookingResponse(
                booking=None, 
                success=False, 
                message=f"Booking with ID {id} not found"
            )
        
        current_booking_data = current_booking_result.get('data', {}).get('booking')
        if not current_booking_data:
            return UpdateBookingResponse(
                booking=None, 
                success=False, 
                message=f"Booking with ID {id} not found"
            )
        
        # Check ownership (users can only update their own bookings)
        if current_user['role'] != 'ADMIN' and current_booking_data['userId'] != current_user['user_id']:
            return UpdateBookingResponse(
                booking=None, 
                success=False, 
                message="You can only update your own bookings"
            )

        # Step 2: Get current seats for this booking (to release them later if seat_numbers is updated)
        current_showtime_id = showtime_id or current_booking_data['showtimeId']
        old_seats_to_release = []
        
        if seat_numbers:  # Only get old seats if we're updating seat numbers
            current_seat_query = {
                'query': f'''
                {{
                    seatStatuses(showtimeId: {current_booking_data['showtimeId']}) {{
                        seatNumber
                        status
                        bookingId
                    }}
                }}
                '''
            }
            
            current_seat_result = make_service_request(SERVICE_URLS['cinema'], current_seat_query, 'cinema')
            if current_seat_result and not current_seat_result.get('errors'):
                current_seat_statuses = current_seat_result.get('data', {}).get('seatStatuses', [])
                
                # Find seats currently assigned to this booking
                for seat_status in current_seat_statuses:
                    if seat_status.get('bookingId') == id and seat_status.get('status') in ['RESERVED', 'BOOKED']:
                        old_seats_to_release.append(seat_status.get('seatNumber'))

        # Step 3: Validate showtime exists if showtime_id is being updated
        if showtime_id:
            showtime_check_query = {
                'query': f'''
                {{
                    showtime(id: {showtime_id}) {{
                        id
                        movieId
                        auditoriumId
                        startTime
                        price
                        auditorium {{
                            id
                            name
                            seatLayout
                            cinema {{
                                id
                                name
                                city
                            }}
                        }}
                    }}
                }}
                '''
            }
            
            showtime_result = make_service_request(SERVICE_URLS['cinema'], showtime_check_query, 'cinema')
            if not showtime_result:
                return UpdateBookingResponse(
                    booking=None, 
                    success=False, 
                    message="Cinema service unavailable"
                )
            
            if showtime_result.get('errors'):
                return UpdateBookingResponse(
                    booking=None, 
                    success=False, 
                    message=f"Showtime with ID {showtime_id} not found"
                )
            
            showtime_data = showtime_result.get('data', {}).get('showtime')
            if not showtime_data:
                return UpdateBookingResponse(
                    booking=None, 
                    success=False, 
                    message=f"Showtime with ID {showtime_id} does not exist"
                )

        # Step 4: Validate seat numbers if being updated
        if seat_numbers and showtime_id:
            # Get auditorium layout for validation
            auditorium_data = showtime_data.get('auditorium', {})
            seat_layout = auditorium_data.get('seatLayout', {})
            
            # Extract available seat numbers from auditorium layout
            available_seats = []
            if seat_layout:
                # Handle both JSON string and dict formats
                if isinstance(seat_layout, str):
                    try:
                        import json
                        seat_layout = json.loads(seat_layout)
                    except json.JSONDecodeError:
                        seat_layout = {}
                
                if isinstance(seat_layout, dict):
                    seats_data = seat_layout.get('seats', [])
                    if isinstance(seats_data, list):
                        for seat in seats_data:
                            if isinstance(seat, dict) and seat.get('number'):
                                available_seats.append(seat.get('number'))
                            elif isinstance(seat, str):
                                available_seats.append(seat)
            
            # If no seats found in layout, get from seat statuses
            if not available_seats:
                seat_status_query = {
                    'query': f'''
                    {{
                        seatStatuses(showtimeId: {showtime_id}) {{
                            seatNumber
                            status
                        }}
                    }}
                    '''
                }
                
                seat_status_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
                if seat_status_result and not seat_status_result.get('errors'):
                    seat_statuses = seat_status_result.get('data', {}).get('seatStatuses', [])
                    available_seats = [status.get('seatNumber') for status in seat_statuses if status.get('seatNumber')]
            
            # Validate all requested seat numbers exist in auditorium
            invalid_seats = [seat for seat in seat_numbers if seat not in available_seats]
            if invalid_seats:
                return UpdateBookingResponse(
                    booking=None,
                    success=False,
                    message=f"Invalid seat numbers: {', '.join(invalid_seats)}. Available seats: {', '.join(available_seats)}"
                )

            # Check if new seats are available (excluding current booking's seats)
            seat_status_query = {
                'query': f'''
                {{
                    seatStatuses(showtimeId: {current_showtime_id}) {{
                        seatNumber
                        status
                        bookingId
                    }}
                }}
                '''
            }
            
            seat_status_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
            if seat_status_result and not seat_status_result.get('errors'):
                seat_statuses = seat_status_result.get('data', {}).get('seatStatuses', [])
                
                # Check if any requested seats are already booked/reserved by other bookings
                unavailable_seats = []
                for seat_status in seat_statuses:
                    seat_number = seat_status.get('seatNumber')
                    status_value = seat_status.get('status')
                    booking_id = seat_status.get('bookingId')
                    
                    # Seat is unavailable if it's booked/reserved by another booking
                    if (seat_number in seat_numbers and 
                        status_value in ['BOOKED', 'RESERVED'] and 
                        booking_id != id):
                        unavailable_seats.append(f"{seat_number} ({status_value})")
                
                if unavailable_seats:
                    return UpdateBookingResponse(
                        booking=None,
                        success=False,
                        message=f"Seats not available: {', '.join(unavailable_seats)}"
                    )

        # Step 5: Calculate total price if not provided but showtime_id is being updated
        if showtime_id and seat_numbers and total_price is None:
            showtime_price = float(showtime_data.get('price', 0))
            total_price = showtime_price * len(seat_numbers)

        # Step 6: Release old seats before updating (if seat_numbers is being changed)
        if seat_numbers and old_seats_to_release:
            for old_seat in old_seats_to_release:
                release_seat_query = {
                    'query': '''
                    mutation($showtimeId: Int!, $seatNumber: String!, $status: String!) {
                        updateSeatStatus(showtimeId: $showtimeId, seatNumber: $seatNumber, status: $status) {
                            success
                            message
                        }
                    }
                    ''',
                    'variables': {
                        'showtimeId': current_booking_data['showtimeId'],
                        'seatNumber': old_seat,
                        'status': 'AVAILABLE'
                    }
                }
                
                # Release the old seat (don't fail if this fails)
                make_service_request(SERVICE_URLS['cinema'], release_seat_query, 'cinema')

        # Step 7: Update booking using new structure
        query_data = {
            'query': '''
            mutation($id: Int!, $showtimeId: Int, $seatNumbers: [String!], $totalPrice: Float, $status: String) {
                updateBooking(id: $id, showtimeId: $showtimeId, seatNumbers: $seatNumbers, totalPrice: $totalPrice, status: $status) {
                    booking {
                        id
                        userId
                        showtimeId
                        status
                        totalPrice
                        bookingDate
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': id,
                'showtimeId': showtime_id,  # Use camelCase for booking service
                'seatNumbers': seat_numbers,  # Use camelCase for booking service
                'totalPrice': total_price,  # Use camelCase for booking service
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
        booking_data = booking_result.get('booking')
        
        # Transform camelCase response to snake_case for gateway BookingType
        if booking_data:
            transformed_booking = {
                'id': booking_data.get('id'),
                'user_id': booking_data.get('userId'),  # Transform camelCase to snake_case
                'showtime_id': booking_data.get('showtimeId'),  # Transform camelCase to snake_case
                'status': booking_data.get('status'),
                'total_price': booking_data.get('totalPrice'),  # Transform camelCase to snake_case
                'booking_date': booking_data.get('bookingDate'),  # Transform camelCase to snake_case
                'tickets': booking_data.get('tickets')
            }
            
            return UpdateBookingResponse(
                booking=transformed_booking,
                success=booking_result.get('success', False),
                message=booking_result.get('message', 'Booking updated successfully')
            )
        
        return UpdateBookingResponse(
            booking=None,
            success=booking_result.get('success', False),
            message=booking_result.get('message', 'Booking update completed')
        )

class DeleteBooking(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_auth
    def mutate(self, info, current_user, id):
        # Step 1: First check if booking exists and get booking details for validation
        booking_check_query = {
            'query': f'''
            {{
                booking(id: {id}) {{
                    id
                    userId
                    showtimeId
                    status
                    totalPrice
                }}
            }}
            '''
        }
        
        booking_result = make_service_request(SERVICE_URLS['booking'], booking_check_query, 'booking')
        if not booking_result:
            return DeleteResponse(success=False, message="Booking service unavailable")
        
        if booking_result.get('errors'):
            return DeleteResponse(success=False, message=f"Booking with ID {id} not found")
        
        booking_data = booking_result.get('data', {}).get('booking')
        if not booking_data:
            return DeleteResponse(success=False, message=f"Booking with ID {id} not found")
        
        # Step 2: Check ownership (users can only cancel their own bookings, admins can cancel any)
        if current_user['role'] != 'ADMIN' and booking_data['userId'] != current_user['user_id']:
            return DeleteResponse(success=False, message="You can only cancel your own bookings")
        
        # Step 3: Check if booking can be cancelled (only PENDING or PAID bookings can be cancelled)
        if booking_data['status'] == 'CANCELLED':
            return DeleteResponse(success=False, message="Booking is already cancelled")
        
        # Step 4: Get seat numbers that need to be released back to AVAILABLE
        seat_status_query = {
            'query': f'''
            {{
                seatStatuses(showtimeId: {booking_data['showtimeId']}) {{
                    seatNumber
                    status
                    bookingId
                }}
            }}
            '''
        }
        
        seat_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
        seats_to_release = []
        
        if seat_result and not seat_result.get('errors'):
            seat_statuses = seat_result.get('data', {}).get('seatStatuses', [])
            
            # Find seats that belong to this booking
            for seat_status in seat_statuses:
                if seat_status.get('bookingId') == id and seat_status.get('status') in ['RESERVED', 'BOOKED']:
                    seats_to_release.append(seat_status.get('seatNumber'))
        
        # Step 5: Delete the booking (this will also delete associated tickets)
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
        
        # Step 6: If booking deletion was successful, release the seats back to AVAILABLE
        if delete_result.get('success', False):
            failed_seat_releases = []
            
            for seat_number in seats_to_release:
                seat_update_query = {
                    'query': '''
                    mutation($showtimeId: Int!, $seatNumber: String!, $status: String!) {
                        updateSeatStatus(showtimeId: $showtimeId, seatNumber: $seatNumber, status: $status) {
                            success
                            message
                        }
                    }
                    ''',
                    'variables': {
                        'showtimeId': booking_data['showtimeId'],
                        'seatNumber': seat_number,
                        'status': 'AVAILABLE'
                    }
                }
                
                seat_update_result = make_service_request(SERVICE_URLS['cinema'], seat_update_query, 'cinema')
                
                # Log failed seat releases but don't fail the whole operation
                if not seat_update_result or seat_update_result.get('errors'):
                    failed_seat_releases.append(seat_number)
            
            # Prepare success message
            success_message = delete_result.get('message', 'Booking cancelled successfully')
            if seats_to_release:
                success_message += f" and {len(seats_to_release)} seats released"
                if failed_seat_releases:
                    success_message += f" (failed to release seats: {', '.join(failed_seat_releases)})"
            
            return DeleteResponse(
                success=True,
                message=success_message
            )
        else:
            return DeleteResponse(
                success=False,
                message=delete_result.get('message', 'Failed to cancel booking')
            )

class CreatePayment(Mutation):
    class Arguments:
        bookingId = Int(required=True)
        paymentMethod = String()
        paymentProofImage = String()
        couponCode = String()  # ✓ Optional coupon code
    
    Output = CreatePaymentResponse

    @require_auth
    def mutate(self, info, current_user, bookingId, paymentMethod='CREDIT_CARD', paymentProofImage=None, couponCode=None):
        print(f"=== PAYMENT DEBUG START ===")
        print(f"User: {current_user['user_id']}, Booking: {bookingId}, Coupon: {couponCode}")
        print(f"SERVICE_URLS: {SERVICE_URLS}")
        # Step 1: Validate booking exists and get booking details
        booking_check_query = {
            'query': f'''
            {{
                booking(id: {bookingId}) {{
                    id
                    status
                    showtimeId
                    totalPrice
                    userId
                }}
            }}
            '''
        }
        
        booking_result = make_service_request(SERVICE_URLS['booking'], booking_check_query, 'booking')
        if not booking_result:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Booking service unavailable"
            )

        booking_data = booking_result.get('data', {}).get('booking')
        if not booking_data:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message=f"Booking with ID {bookingId} not found"
            )

        if booking_data['userId'] != current_user['user_id']:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="You can only pay for your own bookings"
            )

        if booking_data['status'] != 'PENDING':
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message=f"Booking is already {booking_data['status']}"
            )

        # Step 2: Get showtime details to calculate amount automatically
        showtime_query = {
            'query': f'''
            {{
                showtime(id: {booking_data['showtimeId']}) {{
                    id
                    movieId
                    auditoriumId
                    startTime
                    price
                }}
            }}
            '''
        }
        
        showtime_result = make_service_request(SERVICE_URLS['cinema'], showtime_query, 'cinema')
        if not showtime_result or showtime_result.get('errors'):
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Failed to get showtime details for amount calculation"
            )
        
        showtime_data = showtime_result.get('data', {}).get('showtime')
        if not showtime_data:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Showtime not found for amount calculation"
            )

        # Step 3: Get reserved seats count to calculate total amount
        seat_status_query = {
            'query': f'''
            {{
                seatStatuses(showtimeId: {booking_data['showtimeId']}) {{
                    seatNumber
                    status
                    bookingId
                }}
            }}
            '''
        }
        
        seat_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
        if not seat_result or seat_result.get('errors'):
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Failed to get seat information for amount calculation"
            )

        reserved_seats = []
        seat_statuses = seat_result.get('data', {}).get('seatStatuses', [])
        
        # Find seats that are reserved for this booking
        for seat_status in seat_statuses:
            if (seat_status.get('status') == 'RESERVED' and 
                seat_status.get('bookingId') == bookingId):
                reserved_seats.append(seat_status['seatNumber'])

        if not reserved_seats:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="No reserved seats found for this booking"
            )

    # Step 4: Calculate original amount
        showtime_price = float(showtime_data.get('price', 0))
        seat_count = len(reserved_seats)
        calculated_amount = showtime_price * seat_count
        
        print(f"CALCULATION: {seat_count} seats × ${showtime_price} = ${calculated_amount}")
        
        # ✅ Apply coupon discount
        discount_amount = 0.0
        final_amount = calculated_amount
        coupon_success = False
        
        if couponCode:
            print(f"=== COUPON REDEMPTION START ===")
            try:
                if 'coupon' not in SERVICE_URLS:
                    print("❌ COUPON SERVICE NOT CONFIGURED!")
                    return CreatePaymentResponse(
                        payment=None,
                        success=False,
                        message="Coupon service not available"
                    )
                
                coupon_query = {
                    'query': '''
                    mutation($userId: Int!, $code: String!, $bookingAmount: Float!) {
                        redeemCoupon(userId: $userId, code: $code, bookingAmount: $bookingAmount) {
                            success 
                            message 
                            discountAmount 
                            coupon { 
                                id 
                                code 
                                name 
                                discountPercentage 
                            }
                        }
                    }
                    ''',
                    'variables': {
                        'userId': current_user['user_id'],
                        'code': couponCode,
                        'bookingAmount': calculated_amount
                    }
                }
                
                print(f"Coupon query: {coupon_query}")
                coupon_result = make_service_request(SERVICE_URLS['coupon'], coupon_query, 'coupon')
                print(f"Coupon result: {coupon_result}")
                
                if coupon_result and not coupon_result.get('errors'):
                    redeem_result = coupon_result.get('data', {}).get('redeemCoupon', {})
                    print(f"Redeem result: {redeem_result}")
                    
                    if redeem_result.get('success'):
                        discount_amount = float(redeem_result.get('discountAmount', 0.0))
                        final_amount = calculated_amount - discount_amount
                        coupon_success = True
                        print(f"✅ COUPON SUCCESS: discount=${discount_amount}, final=${final_amount}")
                    else:
                        print(f"❌ COUPON FAILED: {redeem_result.get('message')}")
                        return CreatePaymentResponse(
                            payment=None,
                            success=False,
                            message=f"Coupon error: {redeem_result.get('message')}"
                        )
                else:
                    print(f"❌ COUPON SERVICE ERROR: {coupon_result}")
                    return CreatePaymentResponse(
                        payment=None,
                        success=False,
                        message="Coupon service error"
                    )
                    
            except Exception as e:
                print(f"❌ COUPON EXCEPTION: {str(e)}")
                return CreatePaymentResponse(
                    payment=None,
                    success=False,
                    message=f"Coupon processing failed: {str(e)}"
                )
        
        print(f"FINAL AMOUNTS: original=${calculated_amount}, discount=${discount_amount}, final=${final_amount}")
        
        # ✅ Create payment with final amount
        payment_query = {
            'query': '''
            mutation($amount: Float!, $userId: Int!, $bookingId: Int!, $paymentMethod: String!, $paymentProofImage: String) {
                createPayment(amount: $amount, userId: $userId, bookingId: $bookingId, paymentMethod: $paymentMethod, paymentProofImage: $paymentProofImage) {
                    payment {
                        id userId bookingId amount paymentMethod status paymentProofImage createdAt updatedAt
                    }
                    success message
                }
            }
            ''',
            'variables': {
                'amount': final_amount,  # ✅ CRITICAL: Use discounted amount
                'userId': current_user['user_id'],
                'bookingId': bookingId,
                'paymentMethod': paymentMethod,
                'paymentProofImage': paymentProofImage
            }
        }
        
        print(f"Payment query: {payment_query}")
        payment_result = make_service_request(SERVICE_URLS['payment'], payment_query, 'payment')
        print(f"Payment result: {payment_result}")
        
        if not payment_result or payment_result.get('errors'):
            print("❌ PAYMENT FAILED")
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Payment processing failed"
            )
        
        payment_data = payment_result.get('data', {}).get('createPayment', {})
        if not payment_data.get('success'):
            print("❌ PAYMENT NOT SUCCESSFUL")
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message=payment_data.get('message', 'Payment failed')
            )

        payment_service_data = payment_data.get('payment')
        payment_id = payment_service_data.get('id') if payment_service_data else None

        if not payment_id:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Payment created but ID not returned"
            )

        # Step 6: AUTOMATICALLY update payment status to 'success' (system-driven)
        print(f"Automatically updating payment {payment_id} status to 'success'")  # Debug log
        
        status_update_query = {
            'query': '''
            mutation($id: Int!, $status: String!) {
                updatePaymentStatus(id: $id, status: $status) {
                    payment {
                        id
                        status
                    }
                    success
                    message
                }
            }
            ''',
            'variables': {
                'id': payment_id,
                'status': 'success'
            }
        }
        
        status_update_result = make_service_request(SERVICE_URLS['payment'], status_update_query, 'payment')
        print(f"Payment status update result: {status_update_result}")  # Debug log

        # Step 7: AUTOMATICALLY update booking status to 'PAID' (system-driven)
        print(f"Automatically updating booking {bookingId} status to 'PAID'")  # Debug log
        
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
                'status': 'PAID'
            }
        }
        
        booking_update_result = make_service_request(SERVICE_URLS['booking'], booking_update_query, 'booking')
        print(f"Booking status update result: {booking_update_result}")  # Debug log
        
        # Step 8: Create tickets for reserved seats automatically
        if reserved_seats:
            ticket_query = {
                'query': '''
                mutation($bookingId: Int!, $seatNumbers: [String!]!) {
                    createTickets(bookingId: $bookingId, seatNumbers: $seatNumbers) {
                        tickets {
                            id
                            bookingId
                            seatNumber
                        }
                        success
                        message
                    }
                }
                ''',
                'variables': {
                    'bookingId': bookingId,
                    'seatNumbers': reserved_seats
                }
            }
            
            ticket_result = make_service_request(SERVICE_URLS['booking'], ticket_query, 'booking')
            print(f"Ticket creation result: {ticket_result}")  # Debug log
            
            # Update seat statuses from RESERVED to BOOKED after creating tickets
            for seat_number in reserved_seats:
                seat_update_query = {
                    'query': '''
                    mutation($showtimeId: Int!, $seatNumber: String!, $status: String!, $bookingId: Int) {
                        updateSeatStatus(showtimeId: $showtimeId, seatNumber: $seatNumber, status: $status, bookingId: $bookingId) {
                            success
                            message
                        }
                    }
                    ''',
                    'variables': {
                        'showtimeId': booking_data['showtimeId'],
                        'seatNumber': seat_number,
                        'status': 'BOOKED',
                        'bookingId': bookingId
                    }
                }
                
                make_service_request(SERVICE_URLS['cinema'], seat_update_query, 'cinema')

        # Step 9: Transform payment data properly with final status
        if payment_service_data:
            # Update CreatePayment mutation untuk auto-increment payment count
            try:
                count_update_query = {
                    'query': '''
                    mutation($userId: Int!) {
                        updatePaymentCount(userId: $userId) {
                            userId paymentCount isEligible paymentsNeeded
                        }
                    }
                    ''',
                    'variables': {'userId': current_user['user_id']}  # ✓ Changed field name
                }
                
                count_result = make_service_request(SERVICE_URLS['coupon'], count_update_query, 'coupon')
                
                coupon_message = ""
                if count_result and not isinstance(count_result, str) and not count_result.get('errors'):
                    count_data = count_result.get('data', {}).get('updatePaymentCount', {})
                    if count_data:
                        print(f"Updated payment count for user {current_user['user_id']}: {count_data}")
                        
                        if count_data.get('isEligible'):  # ✓ Changed field name
                            coupon_message = f" You are now eligible for coupon redemption! (Payment #{count_data.get('paymentCount')})"
                        else:
                            payments_needed = count_data.get('paymentsNeeded', 3)  # ✓ Changed field name
                            coupon_message = f" Payment count: {count_data.get('paymentCount')}. Need {payments_needed} more payments for coupon eligibility."
            except Exception as e:
                print(f"Error updating payment count: {str(e)}")
                coupon_message = ""

            transformed_payment = {
                'id': payment_service_data.get('id'),
                'userId': payment_service_data.get('userId') or current_user['user_id'],
                'bookingId': payment_service_data.get('bookingId') or bookingId,
                'amount': final_amount,  # ✓ Use final amount with discount
                'paymentMethod': payment_service_data.get('paymentMethod') or paymentMethod,
                'status': 'success',
                'paymentProofImage': payment_service_data.get('paymentProofImage') or paymentProofImage,
                'createdAt': payment_service_data.get('createdAt'),
                'updatedAt': payment_service_data.get('updatedAt'),
                'canBeDeleted': False
            }
            
             # ✓ PERBAIKI: Enhanced success message with discount info
            success_message = f"Payment successful! "
            if coupon_success:
                success_message += f"Original: ${calculated_amount:.2f}, Discount: ${discount_amount:.2f}, Final: ${final_amount:.2f}. "
            else:
                success_message += f"Amount: ${final_amount:.2f}. "
            
            print(f"=== PAYMENT DEBUG END ===")
            
            return CreatePaymentResponse(
                payment={
                    'id': payment_data['payment']['id'],
                    'amount': final_amount,  # ✅ Show discounted amount
                    'status': 'success'
                },
                success=True,
                message=success_message
            )
        else:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Payment processing completed but data not available"
            )

class DeletePayment(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_auth
    def mutate(self, info, current_user, id):
        # First check if payment exists and belongs to user (or if user is admin)
        user_id = current_user['user_id']
        
        # Check if user owns this payment or is admin
        if current_user['role'] != 'ADMIN':
            payment_check_query = {
                'query': f'''
                {{
                    userPayments(userId: {user_id}) {{
                        id
                        canBeDeleted
                    }}
                }}
                '''
            }
            
            payment_result = make_service_request(SERVICE_URLS['payment'], payment_check_query, 'payment')
            if not payment_result:
                return DeleteResponse(success=False, message="Payment service unavailable")
            
            user_payments = payment_result.get('data', {}).get('userPayments', [])
            target_payment = next((p for p in user_payments if p['id'] == id), None)
            
            if not target_payment:
                return DeleteResponse(success=False, message=f"Payment {id} not found or not owned by user")
            
            if not target_payment.get('canBeDeleted', False):
                return DeleteResponse(success=False, message="Payment cannot be deleted (must be within 2 hours of creation)")
        
        # Delete payment
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deletePayment(id: $id) {
                    success
                    message
                }
            }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['payment'], query_data, 'payment')
        if not result:
            return DeleteResponse(success=False, message="Payment service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return DeleteResponse(success=False, message=f"Error: {'; '.join(error_messages)}")
        
        delete_result = result.get('data', {}).get('deletePayment', {})
        
        # If payment was successfully deleted, update booking status back to PENDING
        if delete_result.get('success', False):
            # Get booking ID from payment service first
            payment_query = {
                'query': f'''
                {{
                    payment(id: {id}) {{
                        bookingId
                    }}
                }}
                '''
            }
            
            # Since payment is deleted, we need to update booking status to PENDING
            # This requires getting the booking ID from the payment before deletion
            # For now, we'll just return success for payment deletion
            pass
        
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'Payment deletion completed')
        )
        
# Admin mutations (Movie, Cinema, User, Coupon)
class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()
        releaseDate = String()
        posterUrl = String()    # Added poster URL
        rating = Float()        # Added rating

    Output = CreateMovieResponse

    @require_admin
    def mutate(self, info, current_user, title, genre, duration, description=None, releaseDate=None, posterUrl=None, rating=None):
        query_data = {
            'query': '''
            mutation($title: String!, $genre: String!, $duration: Int!, $description: String, $releaseDate: String, $posterUrl: String, $rating: Float) {
                createMovie(title: $title, genre: $genre, duration: $duration, description: $description, releaseDate: $releaseDate, posterUrl: $posterUrl, rating: $rating) {
                    movie {
                        id title genre duration description releaseDate posterUrl rating
                    }
                    success message
                }
            }
            ''',
            'variables': {
                'title': title, 'genre': genre, 'duration': duration,
                'description': description, 'releaseDate': releaseDate,
                'posterUrl': posterUrl, 'rating': rating
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

class UpdateMovie(Mutation):
    class Arguments:
        id = Int(required=True)
        title = String()
        genre = String()
        duration = Int()
        description = String()
        releaseDate = String()

    Output = UpdateMovieResponse

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
                'releaseDate': releaseDate
            }
        }
        
        result = make_service_request(SERVICE_URLS['movie'], query_data, 'movie')
        if not result:
            return UpdateMovieResponse(movie=None, success=False, message="Movie service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                else:
                    error_messages.append(str(error))
            return UpdateMovieResponse(movie=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateMovie', {})
        return UpdateMovieResponse(
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
        
        
class CreateCinema(Mutation):
    class Arguments:
        name = String(required=True)
        city = String(required=True)  # Changed from location to city
        capacity = Int(required=True)

    Output = CreateCinemaResponse

    @require_admin
    def mutate(self, info, current_user, name, city, capacity):
        query_data = {
            'query': '''
            mutation($name: String!, $city: String!, $capacity: Int!) {
                createCinema(name: $name, city: $city, capacity: $capacity) {
                    cinema { id name city capacity }
                    success message
                }
            }
            ''',
            'variables': {'name': name, 'city': city, 'capacity': capacity}
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

# Tambahkan mutation UpdateCinema setelah class UseCoupon
class UpdateCinema(Mutation):
    class Arguments:
        id = Int(required=True)
        name = String()
        city = String()  # Changed from location to city
        capacity = Int()

    Output = UpdateCinemaResponse

    @require_admin
    def mutate(self, info, current_user, id, name=None, city=None, capacity=None):
        query_data = {
            'query': '''
            mutation($id: Int!, $name: String, $city: String, $capacity: Int) {
                updateCinema(id: $id, name: $name, city: $city, capacity: $capacity) {
                    cinema {
                        id
                        name
                        city
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
                'city': city,
                'capacity': capacity
            }
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        if not result:
            return UpdateCinemaResponse(cinema=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                else:
                    error_messages.append(str(error))
            return UpdateCinemaResponse(cinema=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateCinema', {})
        return UpdateCinemaResponse(
            cinema=update_result.get('cinema'),
            success=update_result.get('success', False),
            message=update_result.get('message', 'Cinema update completed')
        )

class CreateAuditorium(Mutation):
    class Arguments:
        cinema_id = Int(required=True)
        name = String(required=True)
        seat_layout = JSONString()

    Output = CreateAuditoriumResponse

    @require_admin
    def mutate(self, info, current_user, cinema_id, name, seat_layout=None):
        # ✅ FIXED: Convert seat_layout string to proper JSON format
        if isinstance(seat_layout, str):
            # Convert simple string to JSON object that cinema-service expects
            seat_layout_json = {
                "layout_type": seat_layout,
                "rows": 10 if seat_layout == "Standard" else 8 if seat_layout == "Premium" else 6 if seat_layout == "VIP" else 12,
                "seats_per_row": 10 if seat_layout == "Standard" else 12 if seat_layout == "Premium" else 8 if seat_layout == "VIP" else 15,
                "seats": []
            }
            
            # Generate seat numbers based on layout type
            rows = seat_layout_json["rows"]
            seats_per_row = seat_layout_json["seats_per_row"]
            
            for row in range(rows):
                row_letter = chr(65 + row)  # A, B, C, etc.
                for seat in range(1, seats_per_row + 1):
                    seat_layout_json["seats"].append(f"{row_letter}{seat}")
            
            seat_layout = json.dumps(seat_layout_json)
        elif isinstance(seat_layout, dict):
            seat_layout = json.dumps(seat_layout)
            
        query_data = {
            'query': '''
            mutation($cinemaId: Int!, $name: String!, $seatLayout: JSONString) {
                createAuditorium(cinemaId: $cinemaId, name: $name, seatLayout: $seatLayout) {
                    auditorium { 
                        id 
                        cinemaId 
                        name 
                        seatLayout 
                        cinema {
                            id
                            name
                            city
                        }
                    }
                    success 
                    message
                }
            }
            ''',
            'variables': {'cinemaId': cinema_id, 'name': name, 'seatLayout': seat_layout}
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        if not result:
            return CreateAuditoriumResponse(auditorium=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                elif isinstance(error, str):
                    error_messages.append(error)
                else:
                    error_messages.append(str(error))
            return CreateAuditoriumResponse(auditorium=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        create_result = result.get('data', {}).get('createAuditorium', {})
        auditorium_data = create_result.get('auditorium')
        
        if auditorium_data:
            # Transform camelCase response to snake_case for gateway AuditoriumType
            transformed_auditorium = {
                'id': auditorium_data.get('id'),
                'cinema_id': auditorium_data.get('cinemaId'),
                'name': auditorium_data.get('name'),
                'seat_layout': auditorium_data.get('seatLayout'),
                'cinema': auditorium_data.get('cinema')
            }
            
            return CreateAuditoriumResponse(
                auditorium=transformed_auditorium,
                success=create_result.get('success', False),
                message=create_result.get('message', 'Auditorium operation completed')
            )
        
        return CreateAuditoriumResponse(
            auditorium=None,
            success=create_result.get('success', False),
            message=create_result.get('message', 'Auditorium operation completed')
        )

class UpdateAuditorium(Mutation):
    class Arguments:
        id = Int(required=True)
        cinema_id = Int()
        name = String()
        seat_layout = JSONString()

    Output = CreateAuditoriumResponse

    @require_admin
    def mutate(self, info, current_user, id, cinema_id=None, name=None, seat_layout=None):
        
        if isinstance(seat_layout, dict):
            seat_layout = json.dumps(seat_layout)
            
        query_data = {
            'query': '''
            mutation($id: Int!, $cinemaId: Int, $name: String, $seatLayout: JSONString) {
                updateAuditorium(id: $id, cinemaId: $cinemaId, name: $name, seatLayout: $seatLayout) {
                    auditorium { 
                        id 
                        cinemaId 
                        name 
                        seatLayout 
                        cinema {
                            id
                            name
                            city
                        }
                    }
                    success 
                    message
                }
            }
            ''',
            'variables': {
                'id': id,
                'cinemaId': cinema_id, 
                'name': name, 
                'seatLayout': seat_layout
            }
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        if not result:
            return CreateAuditoriumResponse(auditorium=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                elif isinstance(error, str):
                    error_messages.append(error)
                else:
                    error_messages.append(str(error))
            return CreateAuditoriumResponse(auditorium=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateAuditorium', {})
        auditorium_data = update_result.get('auditorium')
        if auditorium_data:
            # Transform camelCase response to snake_case for gateway AuditoriumType
            transformed_auditorium = {
                'id': auditorium_data.get('id'),
                'cinema_id': auditorium_data.get('cinemaId'),  # Transform camelCase to snake_case
                'name': auditorium_data.get('name'),
                'seat_layout': auditorium_data.get('seatLayout'),  # Transform camelCase to snake_case
                'cinema': auditorium_data.get('cinema')
            }
            
            return CreateAuditoriumResponse(
                auditorium=transformed_auditorium,
                success=update_result.get('success', False),
                message=update_result.get('message', 'Auditorium update completed')
            )
        
        return CreateAuditoriumResponse(
            auditorium=None,
            success=update_result.get('success', False),
            message=update_result.get('message', 'Auditorium update completed')
        )

class DeleteAuditorium(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deleteAuditorium(id: $id) {
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
        
        delete_result = result.get('data', {}).get('deleteAuditorium', {})
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'Auditorium deletion completed')
        )
        
class CreateShowtime(Mutation):
    class Arguments:
        movieId = Int(required=True)  # Changed to camelCase
        auditoriumId = Int(required=True)  # Changed to camelCase
        startTime = String(required=True)  # Changed from DateTime to String
        price = Float(required=True)

    Output = CreateShowtimeResponse

    @require_admin
    def mutate(self, info, current_user, movieId, auditoriumId, startTime, price):
        # Validate startTime format
        try:
            from datetime import datetime
            # Try to parse the datetime string to ensure it's valid ISO format
            datetime.fromisoformat(startTime.replace('Z', '+00:00'))
        except ValueError:
            return CreateShowtimeResponse(
                showtime=None,
                success=False,
                message="Invalid startTime format. Use ISO format: YYYY-MM-DDTHH:MM:SS"
            )
        
        # Step 1: Validate movie exists in movie service
        movie_check_query = {
            'query': f'''
            {{
                movie(id: {movieId}) {{
                    id
                    title
                }}
            }}
            '''
        }
        
        movie_result = make_service_request(SERVICE_URLS['movie'], movie_check_query, 'movie')
        if not movie_result:
            return CreateShowtimeResponse(
                showtime=None, 
                success=False, 
                message="Movie service unavailable"
            )
        
        if movie_result.get('errors'):
            return CreateShowtimeResponse(
                showtime=None, 
                success=False, 
                message=f"Movie with ID {movieId} not found"
            )
        
        movie_data = movie_result.get('data', {}).get('movie')
        if not movie_data:
            return CreateShowtimeResponse(
                showtime=None, 
                success=False, 
                message=f"Movie with ID {movieId} does not exist"
            )
        
        # Step 2: Create showtime - FIXED: Use String type for startTime
        query_data = {
            'query': '''
            mutation($movieId: Int!, $auditoriumId: Int!, $startTime: String!, $price: Float!) {
                createShowtime(movieId: $movieId, auditoriumId: $auditoriumId, startTime: $startTime, price: $price) {
                    showtime { 
                        id 
                        movieId 
                        auditoriumId 
                        startTime 
                        price
                        auditorium {
                            id
                            name
                            cinema {
                                id
                                name
                                city
                            }
                        }
                    }
                    success 
                    message
                }
            }
            ''',
            'variables': {
                'movieId': movieId, 
                'auditoriumId': auditoriumId, 
                'startTime': startTime,  # Pass as string directly
                'price': price
            }
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        if not result:
            return CreateShowtimeResponse(showtime=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                elif isinstance(error, str):
                    error_messages.append(error)
                else:
                    error_messages.append(str(error))
            return CreateShowtimeResponse(showtime=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        create_result = result.get('data', {}).get('createShowtime', {})
        
        # Transform camelCase response to snake_case for gateway ShowtimeType
        showtime_data = create_result.get('showtime')
        if showtime_data:
            transformed_showtime = {
                'id': showtime_data.get('id'),
                'movie_id': showtime_data.get('movieId'),  # Transform camelCase to snake_case
                'auditorium_id': showtime_data.get('auditoriumId'),  # Transform camelCase to snake_case
                'start_time': showtime_data.get('startTime'),  # Transform camelCase to snake_case
                'price': showtime_data.get('price'),
                'auditorium': showtime_data.get('auditorium'),
                'movie': movie_data  # Add movie data from validation step
            }
            
            return CreateShowtimeResponse(
                showtime=transformed_showtime,
                success=create_result.get('success', False),
                message=create_result.get('message', 'Showtime created successfully')
            )
        
        return CreateShowtimeResponse(
            showtime=None,
            success=create_result.get('success', False),
            message=create_result.get('message', 'Showtime operation completed')
        )
        
class UpdateShowtime(Mutation):
    class Arguments:
        id = Int(required=True)
        movieId = Int()  # Changed to camelCase
        auditoriumId = Int()  # Changed to camelCase
        startTime = String()  # Changed from DateTime to String
        price = Float()

    Output = CreateShowtimeResponse

    @require_admin
    def mutate(self, info, current_user, id, movieId=None, auditoriumId=None, startTime=None, price=None):
        # Validate startTime format if provided
        if startTime:
            try:
                from datetime import datetime
                datetime.fromisoformat(startTime.replace('Z', '+00:00'))
            except ValueError:
                return CreateShowtimeResponse(
                    showtime=None,
                    success=False,
                    message="Invalid startTime format. Use ISO format: YYYY-MM-DDTHH:MM:SS"
                )
        
        # Build variables dict dynamically
        variables = {'id': id}
        mutation_fields = []
        
        if movieId is not None:
            variables['movieId'] = movieId
            mutation_fields.append('$movieId: Int')
        if auditoriumId is not None:
            variables['auditoriumId'] = auditoriumId
            mutation_fields.append('$auditoriumId: Int')
        if startTime is not None:
            variables['startTime'] = startTime
            mutation_fields.append('$startTime: String')  # Changed from DateTime to String
        if price is not None:
            variables['price'] = price
            mutation_fields.append('$price: Float')
        
        # Build mutation arguments dynamically
        mutation_args = []
        if movieId is not None:
            mutation_args.append('movieId: $movieId')
        if auditoriumId is not None:
            mutation_args.append('auditoriumId: $auditoriumId')
        if startTime is not None:
            mutation_args.append('startTime: $startTime')
        if price is not None:
            mutation_args.append('price: $price')
        
        fields_str = ', '.join(mutation_fields)
        args_str = ', '.join(mutation_args)
        
        query_data = {
            'query': f'''
            mutation($id: Int!{', ' + fields_str if fields_str else ''}) {{
                updateShowtime(id: $id{', ' + args_str if args_str else ''}) {{
                    showtime {{ 
                        id 
                        movieId 
                        auditoriumId 
                        startTime 
                        price
                        auditorium {{
                            id
                            name
                            cinema {{
                                id
                                name
                                city
                            }}
                        }}
                    }}
                    success 
                    message
                }}
            }}
            ''',
            'variables': variables
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        if not result:
            return CreateShowtimeResponse(showtime=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return CreateShowtimeResponse(showtime=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateShowtime', {})
        
        # Transform camelCase response to snake_case for gateway ShowtimeType
        showtime_data = update_result.get('showtime')
        if showtime_data:
            transformed_showtime = {
                'id': showtime_data.get('id'),
                'movie_id': showtime_data.get('movieId'),  # Transform camelCase to snake_case
                'auditorium_id': showtime_data.get('auditoriumId'),  # Transform camelCase to snake_case
                'start_time': showtime_data.get('startTime'),  # Transform camelCase to snake_case
                'price': showtime_data.get('price'),
                'auditorium': showtime_data.get('auditorium')
            }
            
            # Fetch movie details from movie service if movieId is available
            movie_id_value = showtime_data.get('movieId')
            if movie_id_value:
                movie_query = {
                    'query': f'''
                    {{
                        movie(id: {movie_id_value}) {{
                            id
                            title
                            genre
                            duration
                            description
                            releaseDate
                            posterUrl
                            rating
                        }}
                    }}
                    '''
                }
                
                movie_result = make_service_request(SERVICE_URLS['movie'], movie_query, 'movie')
                if movie_result and not movie_result.get('errors'):
                    movie_data = movie_result.get('data', {}).get('movie')
                    if movie_data:
                        # Add movie details to showtime
                        transformed_showtime['movie'] = {
                            'id': movie_data.get('id'),
                            'title': movie_data.get('title'),
                            'genre': movie_data.get('genre'),
                            'duration': movie_data.get('duration'),
                            'description': movie_data.get('description'),
                            'releaseDate': movie_data.get('releaseDate'),
                            'posterUrl': movie_data.get('posterUrl'),
                            'rating': movie_data.get('rating')
                        }
            
            return CreateShowtimeResponse(
                showtime=transformed_showtime,
                success=update_result.get('success', False),
                message=update_result.get('message', 'Showtime updated successfully')
            )
        
        return CreateShowtimeResponse(
            showtime=None,
            success=update_result.get('success', False),
            message=update_result.get('message', 'Showtime update completed')
        )
        
class DeleteShowtime(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin
    def mutate(self, info, current_user, id):
        query_data = {
            'query': '''
            mutation($id: Int!) {
                deleteShowtime(id: $id) {
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
        
        delete_result = result.get('data', {}).get('deleteShowtime', {})
        return DeleteResponse(
            success=delete_result.get('success', False),
            message=delete_result.get('message', 'Showtime deletion completed')
        )

class UpdateSeatStatus(Mutation):
    class Arguments:
        showtime_id = Int(required=True)
        seat_number = String(required=True)
        status = String(required=True)
        booking_id = Int()

    Output = UpdateSeatStatusResponse

    @require_auth
    def mutate(self, info, current_user, showtime_id, seat_number, status, booking_id=None):
        query_data = {
            'query': '''
            mutation($showtimeId: Int!, $seatNumber: String!, $status: String!, $bookingId: Int) {
                updateSeatStatus(showtimeId: $showtimeId, seatNumber: $seatNumber, status: $status, bookingId: $bookingId) {
                    seatStatus { 
                        id 
                        showtime_id 
                        seat_number 
                        status
                        booking_id
                        updated_at
                    }
                    success 
                    message
                }
            }
            ''',
            'variables': {
                'showtimeId': showtime_id,
                'seatNumber': seat_number,
                'status': status,
                'bookingId': booking_id
            }
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        if not result:
            return UpdateSeatStatusResponse(seat_status=None, success=False, message="Cinema service unavailable")
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return UpdateSeatStatusResponse(seat_status=None, success=False, message=f"Error: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updateSeatStatus', {})
        return UpdateSeatStatusResponse(
            seat_status=update_result.get('seatStatus'),
            success=update_result.get('success', False),
            message=update_result.get('message', 'Seat status update completed')
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
        
class CreateCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        name = String(required=True)
        discount_percentage = Float(required=True)
        valid_until = String(required=True)
        stock = Int(required=True)
    
    Output = CreateCouponResponse

    @require_admin
    def mutate(self, info, current_user, code, name, discount_percentage, valid_until, stock):
        query_data = {
            'query': '''
            mutation($code: String!, $name: String!, $discount_percentage: Float!, $valid_until: String!, $stock: Int!) {
                createCoupon(code: $code, name: $name, discountPercentage: $discount_percentage, validUntil: $valid_until, stock: $stock) {
                    coupon { id code name discountPercentage validUntil isActive stock }
                    success message
                }
            }
            ''',
            'variables': {
                'code': code,
                'name': name,
                'discount_percentage': discount_percentage,
                'valid_until': valid_until,
                'stock': stock
            }
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        # ✓ PERBAIKI ERROR HANDLING
        if not result:
            return CreateCouponResponse(
                coupon=None,
                success=False,
                message="Coupon service unavailable"
            )
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return CreateCouponResponse(
                coupon=None,
                success=False,
                message=f"Error: {'; '.join(error_messages)}"
            )
        
        create_result = result.get('data', {}).get('createCoupon', {})
        return CreateCouponResponse(
            coupon=create_result.get('coupon'),
            success=create_result.get('success', False),
            message=create_result.get('message', 'Coupon creation completed')
        )

class RedeemCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        bookingAmount = Float(required=True)  # ✓ Changed from booking_amount to bookingAmount
    
    Output = RedeemCouponResponse

    @require_auth
    def mutate(self, info, current_user, code, bookingAmount):  # ✓ Changed parameter name
        query_data = {
            'query': '''
            mutation($userId: Int!, $code: String!, $bookingAmount: Float!) {
                redeemCoupon(userId: $userId, code: $code, bookingAmount: $bookingAmount) {
                    success message discountAmount 
                    coupon { id code name discountPercentage }
                }
            }
            ''',
            'variables': {
                'userId': current_user['user_id'],  # ✓ Changed field name
                'code': code, 
                'bookingAmount': bookingAmount      # ✓ Changed field name
            }
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        if not result:
            return RedeemCouponResponse(
                success=False,
                message="Coupon service unavailable",
                discountAmount=0.0,
                coupon=None
            )
        
        if isinstance(result, str):
            return RedeemCouponResponse(
                success=False,
                message=f"Service error: {result}",
                discountAmount=0.0,
                coupon=None
            )
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', 'Unknown error'))
                else:
                    error_messages.append(str(error))
            
            return RedeemCouponResponse(
                success=False,
                message=f"Error: {'; '.join(error_messages)}",
                discountAmount=0.0,
                coupon=None
            )
        
        redeem_result = result.get('data', {}).get('redeemCoupon', {})
        return RedeemCouponResponse(
            success=redeem_result.get('success', False),
            message=redeem_result.get('message', 'Coupon redemption completed'),
            discountAmount=redeem_result.get('discountAmount', 0.0),  # ✓ Changed field name
            coupon=redeem_result.get('coupon')
        )

class UpdatePaymentCount(Mutation):
    class Arguments:
        userId = Int(required=True)  # ✓ Changed from user_id to userId
    
    Output = UpdatePaymentCountResponse

    @require_admin
    def mutate(self, info, current_user, userId):  # ✓ Changed parameter name
        """Admin can update payment count for coupon eligibility"""
        query_data = {
            'query': '''
            mutation($userId: Int!) {
                updatePaymentCount(userId: $userId) {
                    userId paymentCount isEligible paymentsNeeded
                }
            }
            ''',
            'variables': {'userId': userId}  # ✓ Changed field name
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        if not result:
            return UpdatePaymentCountResponse(
                userId=userId,
                paymentCount=0,
                isEligible=False,
                paymentsNeeded=3
            )
        
        if isinstance(result, str):
            raise Exception(f"Service error: {result}")
        
        if result.get('errors'):
            error_messages = []
            for error in result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', 'Unknown error'))
                else:
                    error_messages.append(str(error))
            
            raise Exception(f"Failed to update payment count: {'; '.join(error_messages)}")
        
        update_result = result.get('data', {}).get('updatePaymentCount', {})
        if not update_result:
            raise Exception("No data returned from coupon service")
            
        return UpdatePaymentCountResponse(
            userId=update_result.get('userId', userId),        # ✓ Changed field name
            paymentCount=update_result.get('paymentCount', 0), # ✓ Changed field name
            isEligible=update_result.get('isEligible', False), # ✓ Changed field name
            paymentsNeeded=update_result.get('paymentsNeeded', 3)  # ✓ Changed field name
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
    delete_payment = DeletePayment.Field()
    update_booking = UpdateBooking.Field()
    delete_booking = DeleteBooking.Field()
    redeem_coupon = RedeemCoupon.Field()  # CHANGED: dari use_coupon ke redeem_coupon
    update_user = UpdateUser.Field()
    
    # Admin mutations
    create_movie = CreateMovie.Field()
    update_movie = UpdateMovie.Field()
    delete_movie = DeleteMovie.Field()
    create_cinema = CreateCinema.Field()
    update_cinema = UpdateCinema.Field()
    delete_cinema = DeleteCinema.Field()
    create_auditorium = CreateAuditorium.Field()
    update_auditorium = UpdateAuditorium.Field()  
    delete_auditorium = DeleteAuditorium.Field() 
    create_showtime = CreateShowtime.Field()
    update_showtime = UpdateShowtime.Field() 
    delete_showtime = DeleteShowtime.Field()
    delete_user = DeleteUser.Field()
    
    # Admin coupon mutations
    create_coupon = CreateCoupon.Field()  # TAMBAH: Admin bisa create coupon
    update_payment_count = UpdatePaymentCount.Field()  # TAMBAH: Admin bisa update payment count
    
    update_seat_status = UpdateSeatStatus.Field()

schema = Schema(query=Query, mutation=Mutation)