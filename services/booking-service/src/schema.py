from graphene import ObjectType, String, Int, Float, List, Field, Mutation, Schema, Boolean
from models import Booking, Ticket, db
from datetime import datetime
import traceback
import requests
import os

# Service URLs
CINEMA_SERVICE_URL = os.getenv('CINEMA_SERVICE_URL', 'http://cinema-service:3008')

class TicketType(ObjectType):
    id = Int()
    bookingId = Int()    # Changed from booking_id to bookingId (camelCase)
    seatNumber = String() # Changed from seat_number to seatNumber (camelCase)
    
    def resolve_bookingId(self, info):
        return self.booking_id if hasattr(self, 'booking_id') else getattr(self, 'bookingId', None)
        
    def resolve_seatNumber(self, info):
        return self.seat_number if hasattr(self, 'seat_number') else getattr(self, 'seatNumber', None)

class BookingType(ObjectType):
    id = Int()
    userId = Int()  # Changed to camelCase to match gateway expectations
    showtimeId = Int()  # Changed to camelCase to match gateway expectations
    status = String()
    totalPrice = Float()  # Changed to camelCase to match gateway expectations
    bookingDate = String()  # Changed to camelCase to match gateway expectations
    tickets = List(TicketType)

    def resolve_userId(self, info):
        return self.user_id  # Map from snake_case model to camelCase response
    
    def resolve_showtimeId(self, info):
        return self.showtime_id  # Map from snake_case model to camelCase response
    
    def resolve_totalPrice(self, info):
        return float(self.total_price) if self.total_price else None  # Map from snake_case model to camelCase response
    
    def resolve_bookingDate(self, info):
        return self.booking_date.isoformat() if self.booking_date else None  # Map from snake_case model to camelCase response

    def resolve_tickets(self, info):
        return self.tickets

class CreateBookingResponse(ObjectType):
    booking = Field(BookingType)
    success = Boolean()
    message = String()

class CreateBooking(Mutation):
    class Arguments:
        userId = Int(required=True)  # Changed to camelCase
        showtimeId = Int(required=True)  # Changed to camelCase
        seatNumbers = List(String, required=True)  # Changed to camelCase
        totalPrice = Float()  # Changed to camelCase

    Output = CreateBookingResponse

    def mutate(self, info, userId, showtimeId, seatNumbers, totalPrice=None):
        try:
            # Step 1: Create booking first
            booking = Booking(
                user_id=userId,  # Map camelCase to snake_case
                showtime_id=showtimeId,  # Map camelCase to snake_case
                total_price=totalPrice,  # Map camelCase to snake_case
                status='PENDING'
            )
            booking.save()
            
            # Step 2: Update seat statuses in cinema service to RESERVED
            failed_seats = []
            for seat_number in seatNumbers:
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
                        'showtimeId': showtimeId,
                        'seatNumber': seat_number,
                        'status': 'RESERVED',
                        'bookingId': booking.id
                    }
                }
                
                response = requests.post(
                    f"{CINEMA_SERVICE_URL}/graphql",
                    json=seat_update_query,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )
                
                if not response.ok:
                    failed_seats.append(seat_number)
                    continue
                    
                response_data = response.json()
                if response_data.get('errors') or not response_data.get('data', {}).get('updateSeatStatus', {}).get('success'):
                    failed_seats.append(seat_number)
            
            # If any seat reservation failed, rollback booking
            if failed_seats:
                booking.delete()
                return CreateBookingResponse(
                    booking=None,
                    success=False,
                    message=f"Failed to reserve seats: {', '.join(failed_seats)}. Booking cancelled."
                )
            
            return CreateBookingResponse(
                booking=booking,
                success=True,
                message="Booking created successfully and seats reserved"
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
        showtimeId = Int()  # Changed to match new structure
        seatNumbers = List(String)  # Changed to match new structure
        totalPrice = Float()  # camelCase
        status = String()

    Output = UpdateBookingResponse

    def mutate(self, info, id, showtimeId=None, seatNumbers=None, totalPrice=None, status=None):
        try:
            booking = Booking.query.get(id)
            if not booking:
                return UpdateBookingResponse(
                    booking=None,
                    success=False,
                    message=f"Booking with ID {id} not found"
                )
            
            old_status = booking.status
            old_showtime_id = booking.showtime_id
            
            # Update fields if provided (map camelCase to snake_case for model)
            if showtimeId is not None:
                booking.showtime_id = showtimeId
            if totalPrice is not None:
                booking.total_price = totalPrice
            if status is not None:
                # Validate status is one of the allowed values
                valid_statuses = ['PENDING', 'PAID', 'CANCELLED']
                if status not in valid_statuses:
                    return UpdateBookingResponse(
                        booking=None,
                        success=False,
                        message=f"Invalid status '{status}'. Valid statuses are: {', '.join(valid_statuses)}"
                    )
                booking.status = status
                
            booking.save()

            # Handle seat status updates if seat numbers are provided
            if seatNumbers:
                current_showtime_id = showtimeId if showtimeId is not None else old_showtime_id
                
                # Update seat statuses in cinema service for new seats
                for seat_number in seatNumbers:
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
                            'showtimeId': current_showtime_id,
                            'seatNumber': seat_number,
                            'status': 'RESERVED' if booking.status == 'PENDING' else 'BOOKED',
                            'bookingId': booking.id
                        }
                    }
                    
                    response = requests.post(
                        f"{CINEMA_SERVICE_URL}/graphql",
                        json=seat_update_query,
                        timeout=30,
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if not response.ok:
                        print(f"Failed to update seat {seat_number} status")
                        continue
                        
                    response_data = response.json()
                    if response_data.get('errors'):
                        print(f"Error updating seat {seat_number}: {response_data['errors']}")

            # If status changed from PENDING to PAID, create tickets
            if old_status == 'PENDING' and status == 'PAID':
                # Create tickets for the booking
                if seatNumbers:
                    for seat_number in seatNumbers:
                        ticket = Ticket(
                            booking_id=booking.id,
                            seat_number=seat_number
                        )
                        ticket.save()
            
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
            
            showtime_id = booking.showtime_id
            
            # Get seat numbers from tickets before deleting
            seat_numbers = [ticket.seat_number for ticket in booking.tickets]
            
            # Delete booking (this will cascade delete tickets)
            booking.delete()
            
            # Update seat statuses back to AVAILABLE in cinema service
            for seat_number in seat_numbers:
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
                        'showtimeId': showtime_id,
                        'seatNumber': seat_number,
                        'status': 'AVAILABLE'
                    }
                }
                
                requests.post(
                    f"{CINEMA_SERVICE_URL}/graphql",
                    json=seat_update_query,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )
            
            return DeleteBookingResponse(
                success=True,
                message="Booking cancelled successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return DeleteBookingResponse(
                success=False,
                message=f"Error deleting booking: {str(e)}"
            )

class CreateTicketsResponse(ObjectType):
    tickets = List(TicketType)
    success = Boolean()
    message = String()

class CreateTickets(Mutation):
    class Arguments:
        bookingId = Int(required=True)  # Changed to camelCase
        seatNumbers = List(String, required=True)  # Changed to camelCase

    Output = CreateTicketsResponse

    def mutate(self, info, bookingId, seatNumbers):
        try:
            booking = Booking.query.get(bookingId)
            if not booking:
                return CreateTicketsResponse(
                    tickets=None,
                    success=False,
                    message=f"Booking with ID {bookingId} not found"
                )

            if booking.status != 'PAID':
                return CreateTicketsResponse(
                    tickets=None,
                    success=False,
                    message="Tickets can only be created for paid bookings"
                )

            tickets = []
            for seat_number in seatNumbers:
                ticket = Ticket(
                    booking_id=bookingId,  # Map camelCase to snake_case
                    seat_number=seat_number
                )
                ticket.save()
                tickets.append(ticket)

            # Update seat statuses to BOOKED in cinema service
            for seat_number in seatNumbers:
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
                        'showtimeId': booking.showtime_id,
                        'seatNumber': seat_number,
                        'status': 'BOOKED',
                        'bookingId': bookingId
                    }
                }
                
                requests.post(
                    f"{CINEMA_SERVICE_URL}/graphql",
                    json=seat_update_query,
                    timeout=30,
                    headers={'Content-Type': 'application/json'}
                )

            return CreateTicketsResponse(
                tickets=tickets,
                success=True,
                message="Tickets created successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return CreateTicketsResponse(
                tickets=None,
                success=False,
                message=f"Error creating tickets: {str(e)}"
            )

class Query(ObjectType):
    bookings = List(BookingType)
    booking = Field(BookingType, id=Int(required=True))
    userBookings = List(BookingType, userId=Int(required=True))  # Changed to camelCase
    tickets = List(TicketType, bookingId=Int(required=True))  # Changed to camelCase

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
        
    def resolve_userBookings(self, info, userId):  # Changed to camelCase
        try:
            return Booking.query.filter(Booking.user_id == userId).all()
        except Exception as e:
            print(f"Error in resolve_userBookings: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_tickets(self, info, bookingId):  # Changed to camelCase
        try:
            return Ticket.query.filter(Ticket.booking_id == bookingId).all()
        except Exception as e:
            print(f"Error in resolve_tickets: {str(e)}")
            return []

class Mutation(ObjectType):
    createBooking = CreateBooking.Field()  # Changed to camelCase
    updateBooking = UpdateBooking.Field()  # Changed to camelCase
    deleteBooking = DeleteBooking.Field()  # Changed to camelCase
    createTickets = CreateTickets.Field()  # Changed to camelCase


schema = Schema(query=Query, mutation=Mutation)
#