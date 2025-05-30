from graphene import ObjectType, String, Int, List, Field, Mutation, Schema, Float
from models import Booking, db
from datetime import datetime

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

class CreateBooking(Mutation):
    class Arguments:
        user_id = Int(required=True)
        movie_id = Int(required=True)
        cinema_id = Int(required=True)
        showtime = String(required=True)
        seats = String()
        total_price = Float()

    booking = Field(BookingType)

    def mutate(self, info, user_id, movie_id, cinema_id, showtime, seats=None, total_price=None):
        booking = Booking(
            user_id=user_id, 
            movie_id=movie_id, 
            cinema_id=cinema_id, 
            showtime=showtime,
            seats=seats,
            total_price=total_price,
            status="PENDING",
            booking_date=datetime.utcnow()
        )
        booking.save()
        return CreateBooking(booking=booking)

class UpdateBookingStatus(Mutation):
    class Arguments:
        id = Int(required=True)
        status = String(required=True)

    booking = Field(BookingType)

    def mutate(self, info, id, status):
        booking = Booking.query.get(id)
        if booking:
            booking.status = status
            booking.save()
        return UpdateBookingStatus(booking=booking)

class Query(ObjectType):
    bookings = List(BookingType)
    booking = Field(BookingType, id=Int(required=True))

    def resolve_bookings(self, info):
        return Booking.query.all()

    def resolve_booking(self, info, id):
        return Booking.query.get(id)

class Mutation(ObjectType):
    create_booking = CreateBooking.Field()
    update_booking_status = UpdateBookingStatus.Field()

schema = Schema(query=Query, mutation=Mutation)

mutation_query = '''
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
    }
}
'''