from graphene import ObjectType, String, Int, List, Field, Mutation, Schema, Float, Boolean
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
    success = Boolean()
    message = String()

    def mutate(self, info, user_id, movie_id, cinema_id, showtime, seats=None, total_price=None):
        try:
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
            return CreateBooking(booking=booking, success=True, message="Booking created successfully")
        except Exception as e:
            return CreateBooking(booking=None, success=False, message=f"Error creating booking: {str(e)}")

class UpdateBooking(Mutation):
    class Arguments:
        id = Int(required=True)
        movie_id = Int()
        cinema_id = Int()
        showtime = String()
        seats = String()
        total_price = Float()
        status = String()

    booking = Field(BookingType)
    success = Boolean()
    message = String()

    def mutate(self, info, id, movie_id=None, cinema_id=None, showtime=None, seats=None, total_price=None, status=None):
        try:
            booking = Booking.query.get(id)
            
            if not booking:
                return UpdateBooking(
                    booking=None,
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
            
            # Update fields if provided
            if movie_id is not None:
                booking.movie_id = movie_id
            if cinema_id is not None:
                booking.cinema_id = cinema_id
            if showtime is not None:
                booking.showtime = showtime
            if seats is not None:
                booking.seats = seats
            if total_price is not None:
                booking.total_price = total_price
            if status is not None:
                booking.status = status
                
            booking.save()
            return UpdateBooking(
                booking=booking,
                success=True,
                message="Booking updated successfully"
            )
        except Exception as e:
            db.session.rollback()
            return UpdateBooking(
                booking=None,
                success=False,
                message=f"Error updating booking: {str(e)}"
            )

class UpdateBookingStatus(Mutation):
    class Arguments:
        id = Int(required=True)
        status = String(required=True)

    booking = Field(BookingType)
    success = Boolean()
    message = String()

    def mutate(self, info, id, status):
        try:
            booking = Booking.query.get(id)
            
            if not booking:
                return UpdateBookingStatus(
                    booking=None,
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
                
            booking.status = status
            booking.save()
            return UpdateBookingStatus(
                booking=booking,
                success=True,
                message=f"Booking status updated to {status} successfully"
            )
        except Exception as e:
            db.session.rollback()
            return UpdateBookingStatus(
                booking=None,
                success=False,
                message=f"Error updating booking status: {str(e)}"
            )

class DeleteBooking(Mutation):
    class Arguments:
        id = Int(required=True)

    success = Boolean()
    message = String()

    def mutate(self, info, id):
        try:
            booking = Booking.query.get(id)
            
            if not booking:
                return DeleteBooking(
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
                
            booking.delete()
            return DeleteBooking(
                success=True,
                message=f"Booking with ID {id} deleted successfully"
            )
        except Exception as e:
            db.session.rollback()
            return DeleteBooking(
                success=False,
                message=f"Error deleting booking: {str(e)}"
            )

class Query(ObjectType):
    bookings = List(BookingType)
    booking = Field(BookingType, id=Int(required=True))
    user_bookings = List(BookingType, user_id=Int(required=True))

    def resolve_bookings(self, info):
        return Booking.query.all()

    def resolve_booking(self, info, id):
        return Booking.query.get(id)
        
    def resolve_user_bookings(self, info, user_id):
        return Booking.query.filter(Booking.user_id == user_id).all()

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