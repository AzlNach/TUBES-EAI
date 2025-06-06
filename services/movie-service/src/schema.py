from graphene import ObjectType, String, Int, List, Field, Mutation, Schema, Boolean
from models import Movie, db
from datetime import datetime
import traceback

class MovieType(ObjectType):
    id = Int()
    title = String()
    genre = String()
    duration = Int()
    description = String()
    releaseDate = String()  # Changed from release_date to releaseDate
    
    def resolve_releaseDate(self, info):
        # Convert the database field to the expected format
        if hasattr(self, 'release_date') and self.release_date:
            return self.release_date.strftime('%Y-%m-%d')
        return None

class CreateMovieResponse(ObjectType):
    movie = Field(MovieType)
    success = Boolean()
    message = String()

class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()
        releaseDate = String()  # ← Changed from release_date to releaseDate

    Output = CreateMovieResponse

    def mutate(self, info, title, genre, duration, description=None, releaseDate=None):  # ← Changed parameter name
        try:
            print(f"Creating movie: {title}, {genre}, {duration}")
            
            movie = Movie(
                title=title, 
                genre=genre, 
                duration=duration, 
                description=description
            )
            
            if releaseDate:  # ← Updated variable name
                try:
                    movie.release_date = datetime.strptime(releaseDate, '%Y-%m-%d').date()
                except ValueError:
                    return CreateMovieResponse(
                        movie=None, 
                        success=False, 
                        message="Invalid date format. Use YYYY-MM-DD"
                    )
            
            movie.save()
            print(f"Movie saved successfully: {movie}")
            
            return CreateMovieResponse(
                movie=movie, 
                success=True, 
                message="Movie created successfully"
            )
        except Exception as e:
            print(f"Error creating movie: {str(e)}")
            traceback.print_exc()
            db.session.rollback()
            return CreateMovieResponse(
                movie=None, 
                success=False, 
                message=f"Error creating movie: {str(e)}"
            )

class UpdateMovie(Mutation):
    class Arguments:
        id = Int(required=True)
        title = String()
        genre = String()
        duration = Int()
        description = String()
        releaseDate = String()

    Output = CreateMovieResponse  # ← Change to use CreateMovieResponse

    def mutate(self, info, id, title=None, genre=None, duration=None, description=None, releaseDate=None):
        try:
            movie = Movie.query.get(id)
            if not movie:
                return CreateMovieResponse(
                    movie=None,
                    success=False,
                    message=f"Movie with ID {id} not found"
                )
                
            if title:
                movie.title = title
            if genre:
                movie.genre = genre
            if duration:
                movie.duration = duration
            if description is not None:
                movie.description = description
            if releaseDate:
                try:
                    movie.release_date = datetime.strptime(releaseDate, '%Y-%m-%d').date()
                except ValueError:
                    return CreateMovieResponse(
                        movie=None,
                        success=False,
                        message="Invalid date format. Use YYYY-MM-DD"
                    )
            
            movie.save()
            return CreateMovieResponse(
                movie=movie,
                success=True,
                message="Movie updated successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return CreateMovieResponse(
                movie=None,
                success=False,
                message=f"Error updating movie: {str(e)}"
            )

class DeleteMovieResponse(ObjectType):
    success = Boolean()
    message = String()

class DeleteMovie(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteMovieResponse

    def mutate(self, info, id):
        try:
            movie = Movie.query.get(id)
            if not movie:
                return DeleteMovieResponse(success=False, message="Movie not found")
                
            movie.delete()
            return DeleteMovieResponse(success=True, message="Movie deleted successfully")
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteMovieResponse(success=False, message=f"Error deleting movie: {str(e)}")

class Query(ObjectType):
    movies = List(MovieType)
    movie = Field(MovieType, id=Int(required=True))

    def resolve_movies(self, info):
        try:
            return Movie.query.all()
        except Exception as e:
            print(f"Error in resolve_movies: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_movie(self, info, id):
        try:
            return Movie.query.get(id)
        except Exception as e:
            print(f"Error in resolve_movie: {str(e)}")
            return None

class Mutation(ObjectType):
    create_movie = CreateMovie.Field()
    update_movie = UpdateMovie.Field()
    delete_movie = DeleteMovie.Field()

schema = Schema(query=Query, mutation=Mutation)