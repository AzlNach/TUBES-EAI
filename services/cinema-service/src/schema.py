from graphene import ObjectType, String, Int, List, Field, Mutation, Schema, Boolean, Float, JSONString
from models import Cinema, Auditorium, Showtime, SeatStatus, db
from datetime import datetime
import traceback
import json

# GraphQL Types
class CinemaType(ObjectType):
    id = Int()
    name = String()
    city = String()  # Changed from location to city
    capacity = Int()
    auditoriums = List(lambda: AuditoriumType)

    def resolve_auditoriums(self, info):
        return self.auditoriums

class AuditoriumType(ObjectType):
    id = Int()
    cinema_id = Int()
    name = String()
    seat_layout = JSONString()
    cinema = Field(CinemaType)
    showtimes = List(lambda: ShowtimeType)

    def resolve_cinema(self, info):
        return self.cinema

    def resolve_showtimes(self, info):
        return self.showtimes

class ShowtimeType(ObjectType):
    id = Int()
    movieId = Int()  # Changed to camelCase for consistency
    auditoriumId = Int()  # Changed to camelCase for consistency
    startTime = String()  # Changed from DateTime to String
    price = Float()
    auditorium = Field(AuditoriumType)
    seat_statuses = List(lambda: SeatStatusType)

    def resolve_movieId(self, info):
        """Resolve movie_id field to camelCase movieId"""
        return getattr(self, 'movie_id', None)
    
    def resolve_auditoriumId(self, info):
        """Resolve auditorium_id field to camelCase auditoriumId"""
        return getattr(self, 'auditorium_id', None)
    
    def resolve_startTime(self, info):
        """Resolve start_time field to camelCase startTime"""
        return getattr(self, 'start_time', None)

    def resolve_auditorium(self, info):
        return self.auditorium

    def resolve_seat_statuses(self, info):
        return self.seat_statuses

class SeatStatusType(ObjectType):
    id = Int()
    showtimeId = Int()  # Changed to camelCase for consistency
    seatNumber = String()  # Changed to camelCase for consistency
    status = String()
    bookingId = Int()  # Changed to camelCase for consistency
    updatedAt = String()  # Changed to String for consistency
    showtime = Field(ShowtimeType)

    def resolve_showtimeId(self, info):
        """Resolve showtime_id field to camelCase showtimeId"""
        return getattr(self, 'showtime_id', None)
    
    def resolve_seatNumber(self, info):
        """Resolve seat_number field to camelCase seatNumber"""
        return getattr(self, 'seat_number', None)
    
    def resolve_bookingId(self, info):
        """Resolve booking_id field to camelCase bookingId"""
        return getattr(self, 'booking_id', None)
    
    def resolve_updatedAt(self, info):
        """Resolve updated_at field to camelCase updatedAt and convert to string"""
        updated_at = getattr(self, 'updated_at', None)
        if updated_at:
            if hasattr(updated_at, 'isoformat'):
                return updated_at.isoformat()
            return str(updated_at)
        return None

    def resolve_showtime(self, info):
        return self.showtime

# Response Types
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

class DeleteResponse(ObjectType):
    success = Boolean()
    message = String()

# Cinema Mutations
class CreateCinema(Mutation):
    class Arguments:
        name = String(required=True)
        city = String(required=True)
        capacity = Int()

    Output = CreateCinemaResponse

    @require_admin
    def mutate(self, info, current_user, name, city, capacity=100):
        # Forward request ke cinema service
        mutation_query = {
            'query': '''
                mutation CreateCinema($name: String!, $city: String!, $capacity: Int!) {
                    createCinema(name: $name, city: $city, capacity: $capacity) {
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
            'variables': {'name': name, 'city': city, 'capacity': capacity}
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], mutation_query, 'cinema')
        
        if result and not result.get('errors'):
            create_result = result.get('data', {}).get('createCinema', {})
            
            if create_result.get('success'):
                cinema_data = create_result.get('cinema', {})
                transformed_cinema = {
                    'id': cinema_data.get('id'),
                    'name': cinema_data.get('name'),
                    'city': cinema_data.get('city'),
                    'capacity': cinema_data.get('capacity')
                }
                
                return CreateCinemaResponse(
                    cinema=transformed_cinema,
                    success=True,
                    message=create_result.get('message', 'Cinema created successfully')
                )
        
        return CreateCinemaResponse(
            cinema=None,
            success=False,
            message='Failed to create cinema'
        )

class UpdateCinema(Mutation):
    class Arguments:
        id = Int(required=True)
        name = String()
        city = String()
        capacity = Int()

    Output = CreateCinemaResponse

    @require_admin
    def mutate(self, info, current_user, id, name=None, city=None, capacity=None):
        # Forward request ke cinema service
        mutation_query = {
            'query': '''
                mutation UpdateCinema($id: Int!, $name: String, $city: String, $capacity: Int) {
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
            'variables': {'id': id, 'name': name, 'city': city, 'capacity': capacity}
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], mutation_query, 'cinema')
        
        if result and not result.get('errors'):
            update_result = result.get('data', {}).get('updateCinema', {})
            
            if update_result.get('success'):
                cinema_data = update_result.get('cinema', {})
                transformed_cinema = {
                    'id': cinema_data.get('id'),
                    'name': cinema_data.get('name'),
                    'city': cinema_data.get('city'),
                    'capacity': cinema_data.get('capacity')
                }
                
                return CreateCinemaResponse(
                    cinema=transformed_cinema,
                    success=True,
                    message=update_result.get('message', 'Cinema updated successfully')
                )
        
        return CreateCinemaResponse(
            cinema=None,
            success=False,
            message='Failed to update cinema'
        )

class DeleteCinema(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    @require_admin
    def mutate(self, info, current_user, id):
        # Forward request ke cinema service
        mutation_query = {
            'query': '''
                mutation DeleteCinema($id: Int!) {
                    deleteCinema(id: $id) {
                        success
                        message
                    }
                }
            ''',
            'variables': {'id': id}
        }
        
        result = make_service_request(SERVICE_URLS['cinema'], mutation_query, 'cinema')
        
        if result and not result.get('errors'):
            delete_result = result.get('data', {}).get('deleteCinema', {})
            
            return DeleteResponse(
                success=delete_result.get('success', False),
                message=delete_result.get('message', 'Cinema deletion completed')
            )
        
        return DeleteResponse(
            success=False,
            message='Failed to delete cinema'
        )

# Auditorium Mutations
class CreateAuditorium(Mutation):
    class Arguments:
        cinema_id = Int(required=True)
        name = String(required=True)
        seat_layout = JSONString()

    Output = CreateAuditoriumResponse

    def mutate(self, info, cinema_id, name, seat_layout=None):
        try:
            # Validate cinema exists
            cinema = Cinema.query.get(cinema_id)
            if not cinema:
                return CreateAuditoriumResponse(
                    auditorium=None,
                    success=False,
                    message="Cinema not found"
                )

            new_auditorium = Auditorium(
                cinema_id=cinema_id, 
                name=name, 
                seat_layout=seat_layout  # seat_layout is already a dict, no need to parse JSON
            )
            new_auditorium.save()
            return CreateAuditoriumResponse(
                auditorium=new_auditorium, 
                success=True, 
                message="Auditorium created successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return CreateAuditoriumResponse(
                auditorium=None, 
                success=False, 
                message=f"Error creating auditorium: {str(e)}"
            )

class UpdateAuditorium(Mutation):
    class Arguments:
        id = Int(required=True)
        cinema_id = Int()
        name = String()
        seat_layout = JSONString()

    Output = CreateAuditoriumResponse

    def mutate(self, info, id, cinema_id=None, name=None, seat_layout=None):
        try:
            auditorium = Auditorium.query.get(id)
            if not auditorium:
                return CreateAuditoriumResponse(
                    auditorium=None,
                    success=False,
                    message=f"Auditorium with ID {id} not found"
                )

            if cinema_id:
                # Validate cinema exists
                cinema = Cinema.query.get(cinema_id)
                if not cinema:
                    return CreateAuditoriumResponse(
                        auditorium=None,
                        success=False,
                        message="Cinema not found"
                    )
                auditorium.cinema_id = cinema_id
            if name:
                auditorium.name = name
            if seat_layout is not None:
                auditorium.seat_layout = seat_layout
                
            auditorium.save()
            return CreateAuditoriumResponse(
                auditorium=auditorium,
                success=True,
                message="Auditorium updated successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return CreateAuditoriumResponse(
                auditorium=None,
                success=False,
                message=f"Error updating auditorium: {str(e)}"
            )

class DeleteAuditorium(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    def mutate(self, info, id):
        try:
            auditorium = Auditorium.query.get(id)
            if not auditorium:
                return DeleteResponse(success=False, message="Auditorium not found")
                
            auditorium.delete()
            return DeleteResponse(success=True, message="Auditorium deleted successfully")
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteResponse(success=False, message=f"Error deleting auditorium: {str(e)}")

# Showtime Mutations
class CreateShowtime(Mutation):
    class Arguments:
        movie_id = Int(required=True)
        auditorium_id = Int(required=True)
        start_time = String(required=True)  # Changed from DateTime to String
        price = Float(required=True)

    Output = CreateShowtimeResponse

    def mutate(self, info, movie_id, auditorium_id, start_time, price):
        try:
            # Validate auditorium exists
            auditorium = Auditorium.query.get(auditorium_id)
            if not auditorium:
                return CreateShowtimeResponse(
                    showtime=None,
                    success=False,
                    message="Auditorium not found"
                )

            # Validate start_time format (basic validation)
            try:
                # Try to parse the datetime string to ensure it's valid ISO format
                datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            except ValueError:
                return CreateShowtimeResponse(
                    showtime=None,
                    success=False,
                    message="Invalid start_time format. Use ISO format: YYYY-MM-DDTHH:MM:SS"
                )

            new_showtime = Showtime(
                movie_id=movie_id,
                auditorium_id=auditorium_id,
                start_time=start_time,  # Store as string
                price=price
            )
            new_showtime.save()

            # Create initial seat statuses based on auditorium layout
            if auditorium.seat_layout:
                for seat in auditorium.seat_layout.get('seats', []):
                    seat_status = SeatStatus(
                        showtime_id=new_showtime.id,
                        seat_number=seat.get('number'),
                        status='AVAILABLE'
                    )
                    seat_status.save()

            return CreateShowtimeResponse(
                showtime=new_showtime, 
                success=True, 
                message="Showtime created successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return CreateShowtimeResponse(
                showtime=None, 
                success=False, 
                message=f"Error creating showtime: {str(e)}"
            )

class UpdateShowtime(Mutation):
    class Arguments:
        id = Int(required=True)
        movie_id = Int() 
        auditorium_id = Int()
        start_time = String()  # Changed from DateTime to String
        price = Float()

    Output = CreateShowtimeResponse

    def mutate(self, info, id, movie_id=None, auditorium_id=None, start_time=None, price=None):
        try:
            showtime = Showtime.query.get(id)
            if not showtime:
                return CreateShowtimeResponse(
                    showtime=None,
                    success=False,
                    message=f"Showtime with ID {id} not found"
                )

            if movie_id:
                showtime.movie_id = movie_id
            if auditorium_id:
                # Validate auditorium exists
                auditorium = Auditorium.query.get(auditorium_id)
                if not auditorium:
                    return CreateShowtimeResponse(
                        showtime=None,
                        success=False,
                        message="Auditorium not found"
                    )
                showtime.auditorium_id = auditorium_id
            if start_time:
                # Validate start_time format
                try:
                    datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                except ValueError:
                    return CreateShowtimeResponse(
                        showtime=None,
                        success=False,
                        message="Invalid start_time format. Use ISO format: YYYY-MM-DDTHH:MM:SS"
                    )
                showtime.start_time = start_time
            if price is not None:
                showtime.price = price
                
            showtime.save()
            return CreateShowtimeResponse(
                showtime=showtime,
                success=True,
                message="Showtime updated successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return CreateShowtimeResponse(
                showtime=None,
                success=False,
                message=f"Error updating showtime: {str(e)}"
            )

class DeleteShowtime(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteResponse

    def mutate(self, info, id):
        try:
            showtime = Showtime.query.get(id)
            if not showtime:
                return DeleteResponse(success=False, message="Showtime not found")
                
            showtime.delete()
            return DeleteResponse(success=True, message="Showtime deleted successfully")
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteResponse(success=False, message=f"Error deleting showtime: {str(e)}")

# Seat Status Mutations
class UpdateSeatStatus(Mutation):
    class Arguments:
        showtime_id = Int(required=True)
        seat_number = String(required=True)
        status = String(required=True)
        booking_id = Int()

    Output = UpdateSeatStatusResponse

    def mutate(self, info, showtime_id, seat_number, status, booking_id=None):
        try:
            # Find existing seat status
            seat_status = SeatStatus.query.filter_by(
                showtime_id=showtime_id, 
                seat_number=seat_number
            ).first()
            
            if not seat_status:
                return UpdateSeatStatusResponse(
                    seat_status=None,
                    success=False,
                    message=f"Seat {seat_number} not found for showtime {showtime_id}"
                )
            
            # Validate status transition
            if seat_status.status == 'BOOKED' and status != 'AVAILABLE':
                return UpdateSeatStatusResponse(
                    seat_status=None,
                    success=False,
                    message=f"Seat {seat_number} is already booked and cannot be changed to {status}"
                )
            
            if status == 'RESERVED' and seat_status.status in ['BOOKED', 'RESERVED']:
                return UpdateSeatStatusResponse(
                    seat_status=None,
                    success=False,
                    message=f"Seat {seat_number} is already {seat_status.status}"
                )
            
            # Update seat status
            seat_status.status = status
            seat_status.booking_id = booking_id
            seat_status.save()
            
            return UpdateSeatStatusResponse(
                seat_status=seat_status,
                success=True,
                message=f"Seat {seat_number} status updated to {status}"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return UpdateSeatStatusResponse(
                seat_status=None,
                success=False,
                message=f"Error updating seat status: {str(e)}"
            )

# Query Class
class Query(ObjectType):
    # Cinema queries
    cinemas = List(CinemaType)
    cinema = Field(CinemaType, id=Int(required=True))
    
    # Auditorium queries
    auditoriums = List(AuditoriumType)
    auditorium = Field(AuditoriumType, id=Int(required=True))
    auditoriums_by_cinema = List(AuditoriumType, cinema_id=Int(required=True))
    
    # Showtime queries
    showtimes = List(ShowtimeType)
    showtime = Field(ShowtimeType, id=Int(required=True))
    showtimes_by_auditorium = List(ShowtimeType, auditorium_id=Int(required=True))
    showtimes_by_movie = List(ShowtimeType, movie_id=Int(required=True))  # Changed from String to Int
    
    # Seat status queries
    seat_statuses = List(SeatStatusType, showtime_id=Int(required=True))

    def resolve_cinemas(self, info):
        try:
            return Cinema.query.all()
        except Exception as e:
            print(f"Error in resolve_cinemas: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_cinema(self, info, id):
        try:
            return Cinema.query.get(id)
        except Exception as e:
            print(f"Error in resolve_cinema: {str(e)}")
            return None

    def resolve_auditoriums(self, info):
        try:
            return Auditorium.query.all()
        except Exception as e:
            print(f"Error in resolve_auditoriums: {str(e)}")
            return []

    def resolve_auditorium(self, info, id):
        try:
            return Auditorium.query.get(id)
        except Exception as e:
            print(f"Error in resolve_auditorium: {str(e)}")
            return None

    def resolve_auditoriums_by_cinema(self, info, cinema_id):
        try:
            return Auditorium.query.filter_by(cinema_id=cinema_id).all()
        except Exception as e:
            print(f"Error in resolve_auditoriums_by_cinema: {str(e)}")
            return []

    def resolve_showtimes(self, info):
        try:
            return Showtime.query.all()
        except Exception as e:
            print(f"Error in resolve_showtimes: {str(e)}")
            return []

    def resolve_showtime(self, info, id):
        try:
            return Showtime.query.get(id)
        except Exception as e:
            print(f"Error in resolve_showtime: {str(e)}")
            return None

    def resolve_showtimes_by_auditorium(self, info, auditorium_id):
        try:
            return Showtime.query.filter_by(auditorium_id=auditorium_id).all()
        except Exception as e:
            print(f"Error in resolve_showtimes_by_auditorium: {str(e)}")
            return []

    def resolve_showtimes_by_movie(self, info, movie_id):
        try:
            return Showtime.query.filter_by(movie_id=movie_id).all()
        except Exception as e:
            print(f"Error in resolve_showtimes_by_movie: {str(e)}")
            return []

    def resolve_seat_statuses(self, info, showtime_id):
        try:
            return SeatStatus.query.filter_by(showtime_id=showtime_id).all()
        except Exception as e:
            print(f"Error in resolve_seat_statuses: {str(e)}")
            return []

# Mutation Class
class Mutation(ObjectType):
    # Cinema mutations
    create_cinema = CreateCinema.Field()
    update_cinema = UpdateCinema.Field()
    delete_cinema = DeleteCinema.Field()
    
    # Auditorium mutations
    create_auditorium = CreateAuditorium.Field()
    update_auditorium = UpdateAuditorium.Field()
    delete_auditorium = DeleteAuditorium.Field()
    
    # Showtime mutations
    create_showtime = CreateShowtime.Field()
    update_showtime = UpdateShowtime.Field()
    delete_showtime = DeleteShowtime.Field()
    
    # Seat status mutations
    update_seat_status = UpdateSeatStatus.Field()

schema = Schema(query=Query, mutation=Mutation)