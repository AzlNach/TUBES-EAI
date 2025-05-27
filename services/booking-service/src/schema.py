from graphene import ObjectType, String, Int, List, Field, Mutation, Schema
from models import Booking, db

class BookingType(ObjectType):
    id = Int()
    user_id = Int()
    movie_id = Int()
    cinema_id = Int()
    showtime = String()
    booking_date = String()

class CreateBooking(Mutation):
    class Arguments:
        user_id = Int(required=True)
        movie_id = Int(required=True)
        cinema_id = Int(required=True)
        showtime = String(required=True)

    booking = Field(BookingType)

    def mutate(self, info, user_id, movie_id, cinema_id, showtime):
        booking = Booking(user_id=user_id, movie_id=movie_id, cinema_id=cinema_id, showtime=showtime)
        booking.save()
        return CreateBooking(booking=booking)

class Query(ObjectType):
    bookings = List(BookingType)

    def resolve_bookings(self, info):
        return Booking.query.all()

class Mutation(ObjectType):
    create_booking = CreateBooking.Field()

schema = Schema(query=Query, mutation=Mutation)