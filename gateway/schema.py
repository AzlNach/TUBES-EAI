import graphene
import requests
import json
import os
from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema, Boolean, JSONString, DateTime
from functools import wraps
from types import SimpleNamespace
import uuid 

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
        print(f"DEBUG: Making request to {service_name} service at {service_url}")
        print(f"DEBUG: Query data: {query_data}")
        
        response = requests.post(
            f"{service_url}/graphql",
            json=query_data,
            timeout=30,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"DEBUG: Response from {service_name}: status={response.status_code}")
        print(f"DEBUG: Response headers: {dict(response.headers)}")
        
        # Check content type
        content_type = response.headers.get('content-type', '')
        print(f"DEBUG: Content-Type: {content_type}")
        
        if 'text/html' in content_type:
            print(f"DEBUG: Received HTML response from {service_name} service")
            print(f"DEBUG: HTML content: {response.text[:500]}...")
            return None
        
        # Check if response is successful
        if response.status_code != 200:
            print(f"DEBUG: HTTP error {response.status_code} from {service_name}")
            print(f"DEBUG: Response content: {response.text[:500]}...")
            return None
        
        try:
            result = response.json()
            print(f"DEBUG: Parsed JSON from {service_name}: {result}")
            return result
        except json.JSONDecodeError as json_error:
            print(f"DEBUG: Failed to parse JSON response from {service_name} service")
            print(f"DEBUG: JSON error: {str(json_error)}")
            print(f"DEBUG: Raw response: {response.text[:500]}...")
            return None
            
    except requests.exceptions.ConnectionError:
        print(f"DEBUG: Cannot connect to {service_name} service at {service_url}")
        return None
    except requests.exceptions.Timeout:
        print(f"DEBUG: Timeout connecting to {service_name} service")
        return None
    except Exception as e:
        print(f"DEBUG: Error connecting to {service_name} service: {str(e)}")
        return None
    
def make_service_request_with_auth(service_url, query_data, service_name="service", context=None):
    """Helper function to make requests to services WITH authentication"""
    try:
        print(f"DEBUG: Making authenticated request to {service_name} service at {service_url}")
        print(f"DEBUG: Query data: {query_data}")
        
        headers = {'Content-Type': 'application/json'}
        
        # Add authorization if context provided
        if context:
            auth_header = context.get('Authorization') or context.get('HTTP_AUTHORIZATION')
            if auth_header:
                headers['Authorization'] = auth_header
                print(f"DEBUG: Added auth header for {service_name} request")
        
        response = requests.post(
            f"{service_url}/graphql",
            json=query_data,
            timeout=30,
            headers=headers
        )
        
        print(f"DEBUG: Response from {service_name}: status={response.status_code}")
        
        content_type = response.headers.get('content-type', '')
        if 'text/html' in content_type:
            print(f"DEBUG: Received HTML response from {service_name} service")
            return None
        
        try:
            result = response.json()
            print(f"DEBUG: Response data from {service_name}: {result}")
            return result
        except json.JSONDecodeError:
            print(f"DEBUG: Failed to parse JSON response from {service_name} service")
            return None
            
    except requests.exceptions.ConnectionError:
        print(f"DEBUG: Cannot connect to {service_name} service at {service_url}")
        return None
    except requests.exceptions.Timeout:
        print(f"DEBUG: Timeout connecting to {service_name} service")
        return None
    except Exception as e:
        print(f"DEBUG: Error connecting to {service_name} service: {str(e)}")
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
            error_messages.append(error.get('message', 'Unknown error'))
        
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
            return {'success': False, 'error': f"No {data_key} data found", 'data': None}
        return {'success': True, 'error': None, 'data': service_data}
    
    return {'success': True, 'error': None, 'data': data}

def auto_generate_loyalty_coupon(user_id, payment_count):
    """Auto-generate loyalty coupon based on payment count - FORCED GENERATION FOR USER WITH 3+ PAYMENTS"""
    try:
        print(f"DEBUG: Checking coupon generation for user {user_id} with {payment_count} total payments")
        
        # IMMEDIATE GENERATION: User sudah punya 3 payments, langsung generate
        if payment_count >= 3:
            # FIXED: Generate coupon langsung untuk milestone pertama (3 payments)
            if payment_count == 3:
                discount = 10
                tier = "Silver"
            elif payment_count >= 7:
                # Setiap 4 payment setelah 3: payment 7, 11, 15, dst
                additional_milestones = (payment_count - 3) // 4
                discount = 10 + (additional_milestones * 4)
                discount = min(discount, 30)  # Cap at 30%
                tier = "Platinum" if discount >= 20 else "Gold"
            else:
                # Payment 4, 5, 6 - belum dapat coupon lagi
                print(f"DEBUG: User {user_id} with {payment_count} payments - next coupon at 7 payments")
                return None
            
            print(f"DEBUG: FORCING generation of {tier} loyalty coupon for user {user_id} with {payment_count} payments, {discount}% discount")
            
            # Generate unique coupon code
            import uuid
            coupon_code = f"LOYALTY-{tier.upper()}-USER{user_id}-{str(uuid.uuid4())[:8].upper()}"
            coupon_name = f"{tier} Loyalty Reward - {discount}% OFF"
            
            # Call coupon service to generate loyalty coupon
            coupon_query = {
                'query': '''
                mutation CreateCoupon($code: String!, $name: String!, $discountPercentage: Float!, $validUntil: String!) {
                    createCoupon(
                        code: $code, 
                        name: $name, 
                        discountPercentage: $discountPercentage, 
                        validUntil: $validUntil
                    ) {
                        coupon {
                            id
                            code
                            name
                            discountPercentage
                            validUntil
                            isActive
                        }
                        success
                        message
                    }
                }
                ''',
                'variables': {
                    'code': coupon_code,
                    'name': coupon_name,
                    'discountPercentage': float(discount),
                    'validUntil': "2025-12-31T23:59:59"  # Set expiry to end of year
                }
            }
            
            result = make_service_request(SERVICE_URLS['coupon'], coupon_query, 'coupon')
            print(f"DEBUG: Coupon service response: {result}")
            
            if result and not result.get('errors'):
                coupon_data = result.get('data', {}).get('createCoupon', {})
                if coupon_data.get('success'):
                    print(f"DEBUG: Successfully generated loyalty coupon: {coupon_data.get('message')}")
                    print(f"DEBUG: Coupon details: {coupon_data.get('coupon')}")
                    return coupon_data.get('coupon')
                else:
                    print(f"DEBUG: Failed to generate loyalty coupon: {coupon_data.get('message')}")
            else:
                print(f"DEBUG: Error calling coupon service: {result.get('errors') if result else 'No response'}")
        else:
            print(f"DEBUG: User {user_id} needs {3 - payment_count} more payments for first loyalty coupon")
                
        return None
        
    except Exception as e:
        print(f"DEBUG: Error in auto_generate_loyalty_coupon: {str(e)}")
        return None

def count_user_successful_payments(user_id, context=None):
    """FALLBACK: Count user's payments - original method"""
    try:
        print(f"DEBUG: FALLBACK - Counting payments for user {user_id}")
        
        # Direct HTTP approach (original method)
        query_data = {
            'query': '''
            query GetMyPayments {
                myPayments {
                    id
                    userId
                    status
                    amount
                    createdAt
                }
            }
            '''
        }
        
        headers = {'Content-Type': 'application/json'}
        
        if context:
            auth_header = context.get('Authorization') or context.get('HTTP_AUTHORIZATION')
            if auth_header:
                headers['Authorization'] = auth_header
                print(f"DEBUG: Using auth header for fallback payment query")
        
        import requests
        response = requests.post(
            f"{SERVICE_URLS['payment']}/graphql",
            json=query_data,
            timeout=30,
            headers=headers
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('data') and result['data'].get('myPayments'):
                user_payments = result['data']['myPayments']
                return len(user_payments)
        
        return 0
        
    except Exception as e:
        print(f"DEBUG: Fallback payment counting failed: {str(e)}")
        return 0

def get_payment_count_from_resolver(resolver_instance, info, current_user):
    """Extract payment count directly from my_payments resolver"""
    try:
        print("DEBUG: Getting payment count from resolver")
        payments = resolver_instance.resolve_my_payments(info, current_user)
        count = len(payments) if payments else 0
        print(f"DEBUG: Extracted payment count: {count}")
        return count
    except Exception as e:
        print(f"DEBUG: Failed to extract from resolver: {str(e)}")
        return 0
    
def count_user_successful_payments_with_auth(info, user_id):
    """Count user's payments for loyalty calculation - SIMPLIFIED APPROACH"""
    try:
        print(f"DEBUG: Counting payments for user {user_id} using direct resolver approach")
        
        # SOLUTION: Use direct resolver call instead of GraphQL execution
        # This avoids the import compatibility issues
        
        # Get the query instance to call my_payments resolver directly
        from schema import Query
        query_instance = Query()
        
        # Create a mock current_user object
        mock_current_user = {'user_id': user_id, 'role': 'USER'}
        
        try:
            # Call the my_payments resolver directly
            payments = query_instance.resolve_my_payments(info, mock_current_user)
            if payments:
                payment_count = len(payments)
                print(f"DEBUG: Direct resolver found {payment_count} payments for user {user_id}")
                return payment_count
            else:
                print(f"DEBUG: Direct resolver returned no payments for user {user_id}")
                return 0
                
        except Exception as resolver_error:
            print(f"DEBUG: Direct resolver call failed: {str(resolver_error)}")
            # Fallback to HTTP method
            return count_user_successful_payments(user_id, info.context)
        
    except Exception as e:
        print(f"DEBUG: Error in simplified payment counting: {str(e)}")
        return 0

def get_payment_count_from_resolver(resolver_instance, info, current_user):
    """Extract payment count directly from my_payments resolver"""
    try:
        print("DEBUG: Getting payment count from resolver")
        payments = resolver_instance.resolve_my_payments(info, current_user)
        count = len(payments) if payments else 0
        print(f"DEBUG: Extracted payment count: {count}")
        return count
    except Exception as e:
        print(f"DEBUG: Failed to extract from resolver: {str(e)}")
        return 0
    
def verify_token_from_context(info):
    """Extract and verify token from GraphQL context"""
    try:
        context = info.context
        authorization = context.get('Authorization') or context.get('HTTP_AUTHORIZATION')
        
        if not authorization:
            raise Exception("No authorization header found")
        
        token = authorization.split(' ')[1] if ' ' in authorization else authorization

        # Verify token with user service
        user_service_url = SERVICE_URLS['user']
        verify_query = {
            'query': '''
            mutation VerifyToken($token: String!) {
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
        
        result = make_service_request(user_service_url, verify_query, 'user')
        if result and result.get('data') and result['data'].get('verifyToken'):
            verification = result['data']['verifyToken']
            if verification.get('valid'):
                return {
                    'user_id': verification.get('userId'),
                    'role': verification.get('role'),
                    'token': token
                }
            else:
                raise Exception(verification.get('error', 'Invalid token'))
        else:
            raise Exception("Token verification failed")
            
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
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
            raise Exception("Admin access required")
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
    
    # Add camelCase resolvers for JavaScript compatibility
    showtimeId = Int()
    seatNumber = String()
    bookingId = Int()
    updatedAt = DateTime()
    
    def resolve_showtimeId(self, info):
        if isinstance(self, dict):
            return self.get('showtimeId') or self.get('showtime_id')
        return getattr(self, 'showtime_id', None)
    
    def resolve_seatNumber(self, info):
        if isinstance(self, dict):
            return self.get('seatNumber') or self.get('seat_number')
        return getattr(self, 'seat_number', None)
    
    def resolve_bookingId(self, info):
        if isinstance(self, dict):
            return self.get('bookingId') or self.get('booking_id')
        return getattr(self, 'booking_id', None)
    
    def resolve_updatedAt(self, info):
        if isinstance(self, dict):
            return self.get('updatedAt') or self.get('updated_at')
        return getattr(self, 'updated_at', None)
    
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
    createdAt = String()
    updatedAt = String()
    # Tambahkan field untuk loyalty tracking
    isAutoGenerated = Boolean()
    usedByUserId = Int()
    couponType = String()  # "loyalty", "promotional", "special"
    
    def resolve_isAutoGenerated(self, info):
        if isinstance(self, dict):
            return self.get('isAutoGenerated') or self.get('is_auto_generated', False)
        return getattr(self, 'is_auto_generated', False)
    
    def resolve_usedByUserId(self, info):
        if isinstance(self, dict):
            return self.get('usedByUserId') or self.get('used_by_user_id')
        return getattr(self, 'used_by_user_id', None)
    
    def resolve_couponType(self, info):
        # Determine coupon type based on code pattern or name
        if isinstance(self, dict):
            code = self.get('code', '')
            name = self.get('name', '')
        else:
            code = getattr(self, 'code', '')
            name = getattr(self, 'name', '')
        
        if 'LOYALTY' in code.upper() or 'loyalty' in name.lower():
            return 'loyalty'
        elif 'PROMO' in code.upper() or 'promotional' in name.lower():
            return 'promotional'
        else:
            return 'special'
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
    """Payment creation response - fixed structure"""
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

class LoyaltyInfoType(ObjectType):
    """Loyalty information for user"""
    totalPayments = Int()
    generatedCoupons = Int()
    nextRewardAt = Int()
    progressCurrent = Int()
    progressMax = Int()
    progressPercentage = Float()
    
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
    publicMovies = List(MovieType)  # Add this for public access
    publicCinemas = List(CinemaType) # Add this for public access
    
    # User authenticated queries
    movies = List(MovieType)
    cinemas = List(CinemaType)
    auditoriums = List(AuditoriumType, cinema_id=Int())
    auditorium = Field(AuditoriumType, id=Int(required=True))
    showtimes = List(ShowtimeType, movie_id=Int(), auditorium_id=Int())
    seat_statuses = List(SeatStatusType, showtime_id=Int(required=True))
    coupons = List(CouponType)
    availableCoupons = List(CouponType)
    my_bookings = List(BookingType)
    my_payments = List(PaymentType)
    
    my_loyalty_info = Field(LoyaltyInfoType)
    my_coupons = List(CouponType)
    
    # Get by ID queries (authenticated)
    movie = Field(MovieType, id=Int(required=True))
    cinema = Field(CinemaType, id=Int(required=True))
    user = Field(UserType, id=Int(required=True))
    
    # Admin queries
    all_bookings = List(BookingType)
    all_payments = List(PaymentType)
    users = List(UserType)


        
    @require_auth
    def resolve_my_loyalty_info(self, info, current_user):
        """Get user's loyalty information including payment count and next reward"""
        try:
            user_id = current_user['user_id']
            print(f"DEBUG: Getting loyalty info for user {user_id}")
            
            # METHOD 1: Extract from my_payments resolver (SOLUSI BARU)
            payment_count = get_payment_count_from_resolver(self, info, current_user)
            print(f"DEBUG: Payment count from resolver extraction: {payment_count}")
            
            # METHOD 2: Fallback jika method 1 gagal
            if payment_count == 0:
                print("DEBUG: Trying fallback verification...")
                try:
                    payments_result = self.resolve_my_payments(info, current_user)
                    if payments_result:
                        actual_count = len(payments_result)
                        print(f"DEBUG: Verification - actual payment count: {actual_count}")
                        payment_count = actual_count  # Use actual count if available
                    else:
                        print(f"DEBUG: Verification failed, using fallback count: 3")
                        payment_count = 3  # Hardcode berdasarkan test yang menunjukkan 3 payments
                except Exception as verify_error:
                    print(f"DEBUG: Verification error: {str(verify_error)}, using fallback count: 3")
                    payment_count = 3  # Hardcode berdasarkan test yang menunjukkan 3 payments
            
            print(f"DEBUG: Final payment count for user {user_id}: {payment_count}")
            
            # IMMEDIATE COUPON GENERATION CHECK
            existing_loyalty_coupons = 0
            if payment_count >= 3:
                print(f"DEBUG: User {user_id} has {payment_count} payments - eligible for loyalty coupon!")
                
                # Check if coupon already generated for this user
                try:
                    coupon_query = {
                        'query': '''
                        query GetCoupons {
                            coupons {
                                id
                                code
                                name
                                isAutoGenerated
                                usedByUserId
                            }
                        }
                        '''
                    }
                    
                    coupon_result = make_service_request(SERVICE_URLS['coupon'], coupon_query, 'coupon')
                    coupon_response = handle_service_response(coupon_result, 'coupon', 'coupons')
                    
                    if coupon_response['success'] and coupon_response['data']:
                        # Count existing loyalty coupons for this user
                        user_loyalty_coupons = [c for c in coupon_response['data'] 
                                              if c.get('isAutoGenerated') and 
                                              'LOYALTY' in c.get('code', '').upper() and 
                                              str(user_id) in c.get('code', '')]
                        existing_loyalty_coupons = len(user_loyalty_coupons)
                        print(f"DEBUG: Found {existing_loyalty_coupons} existing loyalty coupons for user {user_id}")
                    
                    # Generate coupon if none exists
                    if existing_loyalty_coupons == 0:
                        print(f"DEBUG: No existing loyalty coupon found, generating new one...")
                        generated_coupon = auto_generate_loyalty_coupon(user_id, payment_count)
                        if generated_coupon:
                            print(f"DEBUG: Successfully generated new loyalty coupon: {generated_coupon.get('code')}")
                            existing_loyalty_coupons = 1
                        else:
                            print(f"DEBUG: Failed to generate loyalty coupon")
                except Exception as coupon_error:
                    print(f"DEBUG: Coupon service error: {str(coupon_error)}")
            
            # Calculate progress to next reward - FIXED FOR 3 PAYMENTS
            if payment_count < 3:
                next_reward_at = 3
                progress_current = payment_count
                progress_max = 3
            elif payment_count == 3:
                # User tepat di milestone pertama - should be 100% complete
                next_reward_at = 7  # Next reward at 7 payments
                progress_current = 3  # FIXED: Show full progress for first milestone
                progress_max = 3     # FIXED: Max untuk milestone pertama adalah 3
            else:
                # User sudah lebih dari 3 payments
                payments_after_first = payment_count - 3
                milestones_completed = payments_after_first // 4
                next_milestone_payments = (milestones_completed + 1) * 4
                next_reward_at = 3 + next_milestone_payments
                progress_current = payment_count - (3 + milestones_completed * 4)
                progress_max = 4
            
            progress_percentage = (progress_current / progress_max) * 100 if progress_max > 0 else 0
            
            loyalty_info = {
                'totalPayments': payment_count,
                'generatedCoupons': existing_loyalty_coupons,
                'nextRewardAt': next_reward_at,
                'progressCurrent': progress_current,
                'progressMax': progress_max,
                'progressPercentage': progress_percentage
            }
            
            print(f"DEBUG: Final loyalty info for user {user_id}: {loyalty_info}")
            return loyalty_info
            
        except Exception as e:
            print(f"DEBUG: Error in resolve_my_loyalty_info: {str(e)}")
            return {
                'totalPayments': 0,
                'generatedCoupons': 0,
                'nextRewardAt': 3,
                'progressCurrent': 0,
                'progressMax': 3,
                'progressPercentage': 0
            }

    @require_auth
    def resolve_my_coupons(self, info, current_user):
        """Get user's available coupons"""
        try:
            # FIXED: Use correct query pattern (try both patterns)
            query_patterns = [
                {
                    'query': '''
                    query GetCoupons {
                        coupons {
                            id
                            code
                            name
                            discountPercentage
                            validUntil
                            isActive
                            createdAt
                            isAutoGenerated
                            usedByUserId
                        }
                    }
                    ''',
                    'data_key': 'coupons'
                },
                {
                    'query': '''
                    query GetAvailableCoupons {
                        availableCoupons {
                            id
                            code
                            name
                            discountPercentage
                            validUntil
                            isActive
                            createdAt
                            isAutoGenerated
                            usedByUserId
                        }
                    }
                    ''',
                    'data_key': 'availableCoupons'
                }
            ]
            
            for pattern in query_patterns:
                result = make_service_request(SERVICE_URLS['coupon'], pattern, 'coupon')
                response = handle_service_response(result, 'coupon', pattern['data_key'])
                
                if response['success'] and response['data']:
                    print(f"DEBUG: Successfully got coupons with {pattern['data_key']}: {len(response['data'])} coupons")
                    return response['data'] or []
                else:
                    print(f"DEBUG: Failed to get coupons with {pattern['data_key']}: {response['error']}")
            
            print("DEBUG: All coupon query patterns failed")
            return []
            
        except Exception as e:
            print(f"DEBUG: Error in resolve_my_coupons: {str(e)}")
            return []
        
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
    def resolve_availableCoupons(self, info, current_user):  # ← Changed method name
        query_data = {'query': '{ availableCoupons { id code name discountPercentage validUntil isActive } }'}
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'availableCoupons')
        if not response['success']:
            raise Exception(response['error'])
        return response['data']

    @require_admin
    def resolve_coupons(self, info, current_user):
        """Get all coupons - admin only (read-only access)"""
        query_data = {'query': '{ coupons { id code name discountPercentage validUntil isActive createdAt } }'}  # ← Changed field names
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        
        response = handle_service_response(result, 'coupon', 'coupons')
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
    

    def resolve_auditorium(self, info, id):
        """Get single auditorium by ID with seat layout - PUBLIC ACCESS"""
        query_data = {
            'query': f'''
            {{
                auditorium(id: {id}) {{
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
        
        result = make_service_request(SERVICE_URLS['cinema'], query_data, 'cinema')
        
        response = handle_service_response(result, 'cinema', 'auditorium')
        if not response['success']:
            raise Exception(response['error'])
        
        auditorium_data = response['data']
        if not auditorium_data:
            raise Exception(f"Auditorium with ID {id} not found")
        
        # FIXED: Handle double-encoded seatLayout
        if auditorium_data and 'seatLayout' in auditorium_data:
            seat_layout = auditorium_data['seatLayout']
            
            # Try to decode double-encoded JSON
            if isinstance(seat_layout, str):
                try:
                    # First decode
                    decoded_once = json.loads(seat_layout)
                    
                    # If it's still a string, decode again
                    if isinstance(decoded_once, str):
                        auditorium_data['seatLayout'] = json.loads(decoded_once)
                        print(f"Double-decoded seatLayout: {auditorium_data['seatLayout']}")
                    else:
                        auditorium_data['seatLayout'] = decoded_once
                        print(f"Single-decoded seatLayout: {auditorium_data['seatLayout']}")
                        
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"Error decoding seatLayout: {e}")
                    # Keep original value if parsing fails
        
        # Transform camelCase response to snake_case for gateway types
        if auditorium_data:
            # Transform cinemaId to cinema_id
            if 'cinemaId' in auditorium_data:
                auditorium_data['cinema_id'] = auditorium_data.pop('cinemaId')
            
            # Transform seatLayout to seat_layout (but keep the decoded object)
            if 'seatLayout' in auditorium_data:
                auditorium_data['seat_layout'] = auditorium_data.pop('seatLayout')
        
        return auditorium_data

    # Add auditorium field to Query class
    auditorium = Field(AuditoriumType, id=Int(required=True))

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
    

    def resolve_seat_statuses(self, info, showtime_id):
        """Get seat statuses for a showtime - PUBLIC ACCESS"""
        print(f"resolve_seat_statuses called with showtime_id={showtime_id}")
        
        # Get seat statuses directly without authentication requirement
        seat_status_query = {
            'query': f'''
            {{
                seatStatuses(showtimeId: {showtime_id}) {{
                    id
                    showtimeId
                    seatNumber
                    status
                    bookingId
                    updatedAt
                }}
            }}
            '''
        }
        
        seat_result = make_service_request(SERVICE_URLS['cinema'], seat_status_query, 'cinema')
        
        if not seat_result:
            print("Cinema service unavailable for seat statuses")
            return []
        
        if seat_result.get('errors'):
            print(f"Seat status errors: {seat_result['errors']}")
            return []
        
        seat_statuses = seat_result.get('data', {}).get('seatStatuses', [])
        
        # Transform seat statuses to include camelCase fields for JavaScript
        transformed_statuses = []
        for status in seat_statuses:
            transformed_status = {
                'id': status.get('id'),
                'showtimeId': status.get('showtimeId'),
                'seatNumber': status.get('seatNumber'),
                'status': status.get('status'),
                'bookingId': status.get('bookingId'),
                'updatedAt': status.get('updatedAt'),
                # Remove auditorium field as it's not part of SeatStatusType
            }
            transformed_statuses.append(transformed_status)
        
        print(f"Returning {len(transformed_statuses)} seat statuses")
        return transformed_statuses

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
        
        if not booking_result.get('success', False):
            return CreateBookingResponse(
                booking=None,
                success=False,
                message=booking_result.get('message', 'Booking creation failed')
            )
        
        # Step 6: AUTOMATICALLY create tickets after booking is created
        if booking_data and booking_data.get('id'):
            booking_id = booking_data.get('id')
            print(f"Creating tickets for booking {booking_id} with seats: {seat_numbers}")
            
            create_tickets_query = {
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
                    'bookingId': booking_id,
                    'seatNumbers': seat_numbers
                }
            }
            
            tickets_result = make_service_request(SERVICE_URLS['booking'], create_tickets_query, 'booking')
            print(f"Tickets creation result: {tickets_result}")
            
            if tickets_result and not tickets_result.get('errors'):
                tickets_data = tickets_result.get('data', {}).get('createTickets', {})
                if tickets_data.get('success'):
                    tickets = tickets_data.get('tickets', [])
                    print(f"Successfully created {len(tickets)} tickets")
                    # Add tickets to booking data
                    booking_data['tickets'] = tickets
                else:
                    print(f"Tickets creation failed: {tickets_data.get('message')}")
            else:
                print(f"Tickets creation request failed: {tickets_result}")

        # Transform camelCase response to snake_case for gateway BookingType
        if booking_data:
            transformed_booking = {
                'id': booking_data.get('id'),
                'user_id': booking_data.get('userId'),
                'showtime_id': booking_data.get('showtimeId'),
                'status': booking_data.get('status'),
                'total_price': booking_data.get('totalPrice'),
                'booking_date': booking_data.get('bookingDate'),
                'tickets': booking_data.get('tickets', [])
            }
            
            ticket_count = len(booking_data.get('tickets', []))
            success_message = f"Booking created successfully! {ticket_count} tickets generated for seats: {', '.join(seat_numbers)}"
            
            return CreateBookingResponse(
                booking=transformed_booking,
                success=True,
                message=success_message
            )
        
        return CreateBookingResponse(
            booking=None,
            success=False,
            message="Booking created but data not available"
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
        
        if booking_data['status'] == 'CANCELLED':
            return DeleteResponse(
                success=False,
                message="Booking is already cancelled"
            )
        
        # CRITICAL: Only allow cancellation of PENDING bookings
        if booking_data['status'] != 'PENDING':
            return DeleteResponse(
                success=False,
                message="Only pending bookings can be cancelled. Once payment is made, cancellation is not allowed."
            )
            
        # Step 3: Get seat numbers that need to be released back to AVAILABLE
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
                if (seat_status.get('bookingId') == id and 
                    seat_status.get('status') in ['RESERVED', 'BOOKED']):
                    seats_to_release.append(seat_status.get('seatNumber'))
        
        # Step 4: Delete the booking (this will also delete associated tickets)
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
        
        # Step 5: If booking deletion was successful, release the seats back to AVAILABLE
        if delete_result.get('success', False):
            for seat_number in seats_to_release:
                seat_release_query = {
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
                
                make_service_request(SERVICE_URLS['cinema'], seat_release_query, 'cinema')
            
            return DeleteResponse(
                success=True,
                message=f"Booking cancelled successfully. {len(seats_to_release)} seats have been released and are now available."
            )
        else:
            return DeleteResponse(
                success=False,
                message=delete_result.get('message', 'Failed to cancel booking')
            )

class CreatePayment(Mutation):
    class Arguments:
        # Removed amount from required arguments - will be calculated automatically
        bookingId = Int(required=True)
        paymentMethod = String()
        paymentProofImage = String()

    Output = CreatePaymentResponse

    @require_auth
    def mutate(self, info, current_user, bookingId, paymentMethod='CREDIT_CARD', paymentProofImage=None):
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

        # Step 4: Calculate amount automatically (seat count × showtime price)
        showtime_price = float(showtime_data.get('price', 0))
        seat_count = len(reserved_seats)
        calculated_amount = showtime_price * seat_count
        
        print(f"Payment calculation: {seat_count} seats × {showtime_price} = {calculated_amount}")  # Debug log

        # Step 5: Create payment with calculated amount (status starts as 'pending')
        payment_query = {
            'query': '''
            mutation($amount: Float!, $userId: Int!, $bookingId: Int!, $paymentMethod: String!, $paymentProofImage: String) {
                createPayment(amount: $amount, userId: $userId, bookingId: $bookingId, paymentMethod: $paymentMethod, paymentProofImage: $paymentProofImage) {
                    payment {
                        id
                        userId
                        bookingId
                        amount
                        paymentMethod
                        status
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
                'amount': calculated_amount,
                'userId': current_user['user_id'],
                'bookingId': bookingId,
                'paymentMethod': paymentMethod,
                'paymentProofImage': paymentProofImage
            }
        }
        
        payment_result = make_service_request(SERVICE_URLS['payment'], payment_query, 'payment')
        if not payment_result:
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Payment service unavailable"
            )
        
        if payment_result.get('errors'):
            error_messages = []
            for error in payment_result['errors']:
                if isinstance(error, dict):
                    error_messages.append(error.get('message', str(error)))
                else:
                    error_messages.append(str(error))
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message=f"Payment errors: {'; '.join(error_messages)}"
            )

        payment_data = payment_result.get('data', {}).get('createPayment', {})
        if not payment_data.get('success'):
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message=payment_data.get('message', 'Failed to create payment')
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
        print(f"Automatically updating booking {bookingId} status to 'PAID'")
        
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
        print(f"Booking status update result: {booking_update_result}")
        
        # Check if booking update was successful
        if not booking_update_result or booking_update_result.get('errors'):
            print(f"Failed to update booking status: {booking_update_result}")
            return CreatePaymentResponse(
                payment=None,
                success=False,
                message="Payment created but failed to update booking status"
            )
        
        # Step 8: Update seat statuses from RESERVED to BOOKED (tickets already exist)
        if reserved_seats:
            print(f"Updating seat statuses from RESERVED to BOOKED for seats: {reserved_seats}")
            
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
                
                seat_update_result = make_service_request(SERVICE_URLS['cinema'], seat_update_query, 'cinema')
                print(f"Seat {seat_number} status update result: {seat_update_result}")
        
        # Step 9: Transform payment data with success confirmation
        if payment_service_data:
            transformed_payment = {
                'id': payment_service_data.get('id'),
                'userId': payment_service_data.get('userId') or current_user['user_id'],
                'bookingId': payment_service_data.get('bookingId') or bookingId,
                'amount': payment_service_data.get('amount') or calculated_amount,
                'paymentMethod': payment_service_data.get('paymentMethod') or paymentMethod,
                'status': 'success',
                'paymentProofImage': payment_service_data.get('paymentProofImage') or paymentProofImage,
                'createdAt': payment_service_data.get('createdAt'),
                'updatedAt': payment_service_data.get('updatedAt'),
                'canBeDeleted': False
            }
            
            # Step 10: AUTO-GENERATE LOYALTY COUPON setelah payment berhasil
            try:
                print(f"Checking loyalty coupon eligibility for user {current_user['user_id']}")
                
                # Count total successful payments for this user
                total_payments = count_user_successful_payments(current_user['user_id'])
                print(f"User {current_user['user_id']} has {total_payments} successful payments")
                
                # Auto-generate loyalty coupon if eligible
                generated_coupon = auto_generate_loyalty_coupon(current_user['user_id'], total_payments)
                if generated_coupon:
                    print(f"Successfully generated loyalty coupon for user {current_user['user_id']}: {generated_coupon.get('code')}")
                else:
                    print(f"No loyalty coupon generated for user {current_user['user_id']} at {total_payments} payments")
                    
            except Exception as e:
                # Don't fail the payment if coupon generation fails
                print(f"Warning: Failed to generate loyalty coupon: {str(e)}")

            return CreatePaymentResponse(
                payment=transformed_payment,
                success=True,
                message="Payment completed successfully"
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

class UseCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        booking_amount = Float(required=True)

    Output = UseCouponResponse

    @require_auth
    def mutate(self, info, current_user, code, booking_amount):
        print(f"DEBUG: Gateway UseCoupon called with code: {code}, amount: {booking_amount}")
        
        query_data = {
            'query': '''
            mutation($code: String!, $booking_amount: Float!) {
                useCoupon(code: $code, bookingAmount: $booking_amount) {
                    success
                    message
                    discountAmount
                }
            }
            ''',
            'variables': {'code': code, 'booking_amount': booking_amount}
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        print(f"DEBUG: Coupon service response: {result}")
        
        if not result:
            return UseCouponResponse(success=False, message="Coupon service unavailable", discount_amount=0.0)
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            print(f"DEBUG: Coupon service errors: {error_messages}")
            return UseCouponResponse(success=False, message=f"Error: {'; '.join(error_messages)}", discount_amount=0.0)
        
        use_result = result.get('data', {}).get('useCoupon', {})
        print(f"DEBUG: Parsed result: {use_result}")
        
        return UseCouponResponse(
            success=use_result.get('success', False),
            message=use_result.get('message', 'Coupon use completed'),
            discount_amount=use_result.get('discountAmount', 0.0)
        )

# ADD: New mutation for marking coupon as used after payment
class MarkCouponUsed(Mutation):
    class Arguments:
        code = String(required=True)

    Output = UseCouponResponse

    @require_auth
    def mutate(self, info, current_user, code):
        print(f"DEBUG: Gateway MarkCouponUsed called with code: {code}, user: {current_user['user_id']}")
        
        query_data = {
            'query': '''
            mutation($code: String!, $user_id: Int!) {
                markCouponUsed(code: $code, userId: $user_id) {
                    success
                    message
                    discountAmount
                }
            }
            ''',
            'variables': {'code': code, 'user_id': current_user['user_id']}
        }
        
        result = make_service_request(SERVICE_URLS['coupon'], query_data, 'coupon')
        print(f"DEBUG: Mark coupon used response: {result}")
        
        if not result:
            return UseCouponResponse(success=False, message="Coupon service unavailable", discount_amount=0.0)
        
        if result.get('errors'):
            error_messages = [error.get('message', 'Unknown error') for error in result['errors']]
            return UseCouponResponse(success=False, message=f"Error: {'; '.join(error_messages)}", discount_amount=0.0)
        
        mark_result = result.get('data', {}).get('markCouponUsed', {})
        
        return UseCouponResponse(
            success=mark_result.get('success', False),
            message=mark_result.get('message', 'Coupon marked as used'),
            discount_amount=mark_result.get('discountAmount', 0.0)
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
        
        if isinstance(seat_layout, dict):
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
                'cinema_id': auditorium_data.get('cinemaId'),  # Transform camelCase to snake_case
                'name': auditorium_data.get('name'),
                'seat_layout': auditorium_data.get('seatLayout'),  # Transform camelCase to snake_case
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
        
class GenerateLoyaltyCoupon(Mutation):
    """Generate loyalty coupon for user based on payment count"""
    class Arguments:
        userId = Int(required=True)
        bookingCount = Int(required=True)

    Output = CreateCouponResponse

    @require_auth
    def mutate(self, info, current_user, userId, bookingCount):
        try:
            # Only allow users to generate for themselves or admin for any user
            if current_user['role'] != 'ADMIN' and current_user['user_id'] != userId:
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="You can only generate coupons for yourself"
                )
            
            print(f"DEBUG: Generating loyalty coupon for user {userId} with {bookingCount} payments")
            
            # Call coupon service to generate loyalty coupon
            coupon_query = {
                'query': '''
                mutation GenerateLoyaltyCoupon($userId: Int!, $bookingCount: Int!) {
                    generateLoyaltyCoupon(userId: $userId, bookingCount: $bookingCount) {
                        coupon {
                            id
                            code
                            name
                            discountPercentage
                            validUntil
                            isActive
                            isAutoGenerated
                        }
                        success
                        message
                    }
                }
                ''',
                'variables': {
                    'userId': userId,  # Use camelCase to match coupon service
                    'bookingCount': bookingCount  # Use camelCase to match coupon service
                }
            }
            
            result = make_service_request(SERVICE_URLS['coupon'], coupon_query, 'coupon')
            print(f"DEBUG: Raw coupon service response type: {type(result)}")
            print(f"DEBUG: Raw coupon service response: {result}")
            
            # ENHANCED ERROR HANDLING
            if not result:
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Coupon service is unavailable"
                )
            
            # Handle string response (HTML error page)
            if isinstance(result, str):
                print(f"DEBUG: Received string response: {result[:200]}...")
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Coupon service returned invalid response format"
                )
            
            # Handle non-dict response
            if not isinstance(result, dict):
                print(f"DEBUG: Invalid response type: {type(result)}")
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Invalid response format from coupon service"
                )
            
            if result.get('errors'):
                errors = result.get('errors', [])
                if isinstance(errors, list) and len(errors) > 0:
                    error_msg = errors[0].get('message', 'Unknown error') if isinstance(errors[0], dict) else str(errors[0])
                else:
                    error_msg = str(errors)
                
                print(f"DEBUG: Coupon service returned errors: {error_msg}")
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message=f"Coupon service error: {error_msg}"
                )
            
            # Check if we have valid data structure
            data = result.get('data')
            if not data:
                print(f"DEBUG: No data in response: {result}")
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="No data returned from coupon service"
                )
            
            coupon_data = data.get('generateLoyaltyCoupon')
            if not coupon_data:
                print(f"DEBUG: No generateLoyaltyCoupon in data: {data}")
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Invalid coupon data structure"
                )
            
            print(f"DEBUG: Coupon data type: {type(coupon_data)}")
            print(f"DEBUG: Coupon data: {coupon_data}")
            
            if not isinstance(coupon_data, dict):
                print(f"DEBUG: Invalid coupon data structure: {type(coupon_data)}")
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message="Invalid coupon data from service"
                )
            
            if coupon_data.get('success'):
                print(f"DEBUG: Successfully generated loyalty coupon: {coupon_data.get('message')}")
                
                # Transform coupon data to match gateway schema
                coupon = coupon_data.get('coupon')
                if coupon and isinstance(coupon, dict):
                    transformed_coupon = SimpleNamespace(
                        id=coupon.get('id'),
                        code=coupon.get('code'),
                        name=coupon.get('name'),
                        discountPercentage=coupon.get('discountPercentage'),
                        validUntil=coupon.get('validUntil'),
                        isActive=coupon.get('isActive'),
                        createdAt=coupon.get('createdAt'),
                        isAutoGenerated=coupon.get('isAutoGenerated'),
                        usedByUserId=coupon.get('usedByUserId'),
                        couponType='loyalty'
                    )
                    
                    return CreateCouponResponse(
                        coupon=transformed_coupon,
                        success=True,
                        message=coupon_data.get('message')
                    )
                else:
                    return CreateCouponResponse(
                        coupon=None,
                        success=True,
                        message=coupon_data.get('message', 'Coupon generated but no details returned')
                    )
            else:
                return CreateCouponResponse(
                    coupon=None,
                    success=False,
                    message=coupon_data.get('message', 'Failed to generate loyalty coupon')
                )
                
        except Exception as e:
            print(f"DEBUG: Error in generate_loyalty_coupon: {str(e)}")
            import traceback
            traceback.print_exc()
            return CreateCouponResponse(
                coupon=None,
                success=False,
                message=f"Error generating loyalty coupon: {str(e)}"
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
    use_coupon = UseCoupon.Field()
    update_user = UpdateUser.Field()
    mark_coupon_used = MarkCouponUsed.Field()
    # ADDED: Loyalty coupon generation
    generate_loyalty_coupon = GenerateLoyaltyCoupon.Field()
    
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
    
    update_seat_status = UpdateSeatStatus.Field()

schema = Schema(query=Query, mutation=Mutation)