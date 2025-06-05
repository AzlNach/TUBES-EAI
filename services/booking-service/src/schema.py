from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema, Boolean
from models import Booking, db
from datetime import datetime
import traceback

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

class CreateBookingResponse(ObjectType):
    booking = Field(BookingType)
    success = Boolean()
    message = String()

class CreateBooking(Mutation):
    class Arguments:
        user_id = Int(required=True)
        movie_id = Int(required=True)
        cinema_id = Int(required=True)
        showtime = String(required=True)
        seats = String()
        total_price = Float()

    Output = CreateBookingResponse

    def mutate(self, info, user_id, movie_id, cinema_id, showtime, seats=None, total_price=None):
        try:
            booking = Booking(
                user_id=user_id,
                movie_id=movie_id,
                cinema_id=cinema_id,
                showtime=showtime,
                seats=seats,
                total_price=total_price,
                status='PENDING'
            )
            booking.save()
            
            return CreateBookingResponse(
                booking=booking,
                success=True,
                message="Booking created successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return CreateBookingResponse(
                booking=None,
                success=False,
                message=f"Error creating booking: {str(e)}"
            )

class UpdateBookingResponse(ObjectType):
    booking = Field(BookingType)
    success = Boolean()
    message = String()

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

    def mutate(self, info, id, movie_id=None, cinema_id=None, showtime=None, seats=None, total_price=None, status=None):
        try:
            booking = Booking.query.get(id)
            if not booking:
                return UpdateBookingResponse(
                    booking=None,
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
            
            if movie_id:
                booking.movie_id = movie_id
            if cinema_id:
                booking.cinema_id = cinema_id
            if showtime:
                booking.showtime = showtime
            if seats:
                booking.seats = seats
            if total_price:
                booking.total_price = total_price
            if status:
                booking.status = status
                
            booking.save()
            
            return UpdateBookingResponse(
                booking=booking,
                success=True,
                message="Booking updated successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return UpdateBookingResponse(
                booking=None,
                success=False,
                message=f"Error updating booking: {str(e)}"
            )

class UpdateBookingStatus(Mutation):
    class Arguments:
        id = Int(required=True)
        status = String(required=True)

    Output = UpdateBookingResponse

    def mutate(self, info, id, status):
        try:
            booking = Booking.query.get(id)
            if not booking:
                return UpdateBookingResponse(
                    booking=None,
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
            
            booking.status = status
            booking.save()
            
            return UpdateBookingResponse(
                booking=booking,
                success=True,
                message=f"Booking status updated to {status}"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return UpdateBookingResponse(
                booking=None,
                success=False,
                message=f"Error updating booking status: {str(e)}"
            )

class DeleteBookingResponse(ObjectType):
    success = Boolean()
    message = String()

class DeleteBooking(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteBookingResponse

    def mutate(self, info, id):
        try:
            booking = Booking.query.get(id)
            if not booking:
                return DeleteBookingResponse(
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
            
            booking.delete()
            return DeleteBookingResponse(
                success=True,
                message="Booking deleted successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return DeleteBookingResponse(
                success=False,
                message=f"Error deleting booking: {str(e)}"
            )

class Query(ObjectType):
    bookings = List(BookingType)
    booking = Field(BookingType, id=Int(required=True))
    user_bookings = List(BookingType, userId=Int(required=True))  # ← Changed from user_id to userId

    def resolve_bookings(self, info):
        try:
            return Booking.query.all()
        except Exception as e:
            print(f"Error in resolve_bookings: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_booking(self, info, id):
        try:
            return Booking.query.get(id)
        except Exception as e:
            print(f"Error in resolve_booking: {str(e)}")
            return None
        
    def resolve_user_bookings(self, info, userId):  # ← Changed parameter name
        try:
            return Booking.query.filter(Booking.user_id == userId).all()
        except Exception as e:
            print(f"Error in resolve_user_bookings: {str(e)}")
            traceback.print_exc()
            return []

class Mutation(ObjectType):
    create_booking = CreateBooking.Field()
    update_booking = UpdateBooking.Field()
    update_booking_status = UpdateBookingStatus.Field()
    delete_booking = DeleteBooking.Field()

schema = Schema(query=Query, mutation=Mutation)

# Example mutation queries for reference
create_booking_query = '''
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
'''

update_booking_query = '''
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
'''

update_status_query = '''
mutation($id: Int!, $status: String!) {
    updateBookingStatus(id: $id, status: $status) {
        booking {
            id
            status
        }
        success
        message
    }
}
'''

delete_booking_query = '''
mutation($id: Int!) {
    deleteBooking(id: $id) {
        success
        message
    }
}
'''