from graphene import ObjectType, Schema, String, Field, List, Mutation, Int, Float
import requests
import json
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UserType(ObjectType):
    id = Int()
    username = String()
    email = String()

class MovieType(ObjectType):
    id = Int()
    title = String()
    genre = String()
    duration = Int()
    description = String()

class CinemaType(ObjectType):
    id = Int()
    name = String()
    location = String()

class BookingType(ObjectType):
    id = Int()
    user_id = Int()
    movie_id = Int()
    cinema_id = Int()
    showtime = String()
    booking_date = String()

class PaymentType(ObjectType):
    id = Int()
    amount = Float()
    status = String()
    user_id = Int()
    order_id = Int()

class CouponType(ObjectType):
    id = Int()
    code = String()
    discount = Float()
    expiration_date = String()

class Query(ObjectType):
    users = List(UserType)
    movies = List(MovieType)
    cinemas = List(CinemaType)
    bookings = List(BookingType)
    payments = List(PaymentType)
    coupons = List(CouponType)

    def resolve_users(self, info):
        try:
            response = requests.post('http://user-service:3012/graphql', 
                json={'query': '{ users { id username email } }'}, 
                timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', {}).get('users', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling user-service: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in resolve_users: {e}")
            return []

    def resolve_movies(self, info):
        try:
            response = requests.post('http://movie-service:3010/graphql', 
                json={'query': '{ movies { id title genre duration description } }'}, 
                timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', {}).get('movies', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling movie-service: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in resolve_movies: {e}")
            return []

    def resolve_cinemas(self, info):
        try:
            response = requests.post('http://cinema-service:3008/graphql', 
                json={'query': '{ cinemas { id name location } }'}, 
                timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', {}).get('cinemas', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling cinema-service: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in resolve_cinemas: {e}")
            return []

    def resolve_bookings(self, info):
        try:
            response = requests.post('http://booking-service:3007/graphql', 
                json={'query': '{ bookings { id user_id movie_id cinema_id showtime booking_date } }'}, 
                timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', {}).get('bookings', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling booking-service: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in resolve_bookings: {e}")
            return []

    def resolve_payments(self, info):
        try:
            response = requests.post('http://payment-service:3011/graphql', 
                json={'query': '{ payments { id amount status user_id order_id } }'}, 
                timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', {}).get('payments', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling payment-service: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in resolve_payments: {e}")
            return []

    def resolve_coupons(self, info):
        try:
            response = requests.post('http://coupon-service:3009/graphql', 
                json={'query': '{ coupons { id code discount expiration_date } }'}, 
                timeout=10)
            response.raise_for_status()
            data = response.json()
            return data.get('data', {}).get('coupons', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling coupon-service: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in resolve_coupons: {e}")
            return []

# Mutation classes untuk gateway
class CreateUser(Mutation):
    class Arguments:
        username = String(required=True)
        email = String(required=True)
        password = String(required=True)

    user = Field(UserType)

    def mutate(self, info, username, email, password):
        try:
            mutation_query = '''
            mutation($username: String!, $email: String!, $password: String!) {
                createUser(username: $username, email: $email, password: $password) {
                    user {
                        id
                        username
                        email
                    }
                }
            }
            '''
            variables = {
                'username': username,
                'email': email,
                'password': password
            }
            response = requests.post('http://user-service:3012/graphql',
                json={'query': mutation_query, 'variables': variables},
                timeout=10)
            response.raise_for_status()
            data = response.json()
            user_data = data.get('data', {}).get('createUser', {}).get('user')
            return CreateUser(user=user_data)
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise Exception("Failed to create user")

class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()

    movie = Field(MovieType)

    def mutate(self, info, title, genre, duration, description=None):
        try:
            mutation_query = '''
            mutation($title: String!, $genre: String!, $duration: Int!, $description: String) {
                createMovie(title: $title, genre: $genre, duration: $duration, description: $description) {
                    movie {
                        id
                        title
                        genre
                        duration
                        description
                    }
                }
            }
            '''
            variables = {
                'title': title,
                'genre': genre,
                'duration': duration,
                'description': description
            }
            response = requests.post('http://movie-service:3010/graphql',
                json={'query': mutation_query, 'variables': variables},
                timeout=10)
            response.raise_for_status()
            data = response.json()
            movie_data = data.get('data', {}).get('createMovie', {}).get('movie')
            return CreateMovie(movie=movie_data)
        except Exception as e:
            logger.error(f"Error creating movie: {e}")
            raise Exception("Failed to create movie")

class CreateCinema(Mutation):
    class Arguments:
        name = String(required=True)
        location = String(required=True)

    cinema = Field(CinemaType)

    def mutate(self, info, name, location):
        try:
            mutation_query = '''
            mutation($name: String!, $location: String!) {
                createCinema(name: $name, location: $location) {
                    cinema {
                        id
                        name
                        location
                    }
                }
            }
            '''
            variables = {
                'name': name,
                'location': location
            }
            response = requests.post('http://cinema-service:3008/graphql',
                json={'query': mutation_query, 'variables': variables},
                timeout=10)
            response.raise_for_status()
            data = response.json()
            cinema_data = data.get('data', {}).get('createCinema', {}).get('cinema')
            return CreateCinema(cinema=cinema_data)
        except Exception as e:
            logger.error(f"Error creating cinema: {e}")
            raise Exception("Failed to create cinema")

class CreateBooking(Mutation):
    class Arguments:
        user_id = Int(required=True)
        movie_id = Int(required=True)
        cinema_id = Int(required=True)
        showtime = String(required=True)

    booking = Field(BookingType)

    def mutate(self, info, user_id, movie_id, cinema_id, showtime):
        try:
            mutation_query = '''
            mutation($userId: Int!, $movieId: Int!, $cinemaId: Int!, $showtime: String!) {
                createBooking(userId: $userId, movieId: $movieId, cinemaId: $cinemaId, showtime: $showtime) {
                    booking {
                        id
                        user_id
                        movie_id
                        cinema_id
                        showtime
                        booking_date
                    }
                }
            }
            '''
            variables = {
                'userId': user_id,
                'movieId': movie_id,
                'cinemaId': cinema_id,
                'showtime': showtime
            }
            response = requests.post('http://booking-service:3007/graphql',
                json={'query': mutation_query, 'variables': variables},
                timeout=10)
            response.raise_for_status()
            data = response.json()
            booking_data = data.get('data', {}).get('createBooking', {}).get('booking')
            return CreateBooking(booking=booking_data)
        except Exception as e:
            logger.error(f"Error creating booking: {e}")
            raise Exception("Failed to create booking")

class CreatePayment(Mutation):
    class Arguments:
        amount = Float(required=True)
        user_id = Int(required=True)
        order_id = Int(required=True)

    payment = Field(PaymentType)

    def mutate(self, info, amount, user_id, order_id):
        try:
            mutation_query = '''
            mutation($amount: Float!, $userId: Int!, $orderId: Int!) {
                createPayment(amount: $amount, userId: $userId, orderId: $orderId) {
                    payment {
                        id
                        amount
                        status
                        user_id
                        order_id
                    }
                }
            }
            '''
            variables = {
                'amount': amount,
                'userId': user_id,
                'orderId': order_id
            }
            response = requests.post('http://payment-service:3011/graphql',
                json={'query': mutation_query, 'variables': variables},
                timeout=10)
            response.raise_for_status()
            data = response.json()
            payment_data = data.get('data', {}).get('createPayment', {}).get('payment')
            return CreatePayment(payment=payment_data)
        except Exception as e:
            logger.error(f"Error creating payment: {e}")
            raise Exception("Failed to create payment")

class CreateCoupon(Mutation):
    class Arguments:
        code = String(required=True)
        discount = Float(required=True)
        expiration_date = String(required=True)

    coupon = Field(CouponType)

    def mutate(self, info, code, discount, expiration_date):
        try:
            mutation_query = '''
            mutation($code: String!, $discount: Float!, $expirationDate: String!) {
                createCoupon(code: $code, discount: $discount, expirationDate: $expirationDate) {
                    coupon {
                        id
                        code
                        discount
                        expiration_date
                    }
                }
            }
            '''
            variables = {
                'code': code,
                'discount': discount,
                'expirationDate': expiration_date
            }
            response = requests.post('http://coupon-service:3009/graphql',
                json={'query': mutation_query, 'variables': variables},
                timeout=10)
            response.raise_for_status()
            data = response.json()
            coupon_data = data.get('data', {}).get('createCoupon', {}).get('coupon')
            return CreateCoupon(coupon=coupon_data)
        except Exception as e:
            logger.error(f"Error creating coupon: {e}")
            raise Exception("Failed to create coupon")

class GatewayMutation(ObjectType):
    create_user = CreateUser.Field()
    create_movie = CreateMovie.Field()
    create_cinema = CreateCinema.Field()
    create_booking = CreateBooking.Field()
    create_payment = CreatePayment.Field()
    create_coupon = CreateCoupon.Field()

# Schema dengan mutation yang sudah didefinisikan
schema = Schema(query=Query, mutation=GatewayMutation)