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
    release_date = String()

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
        release_date = String()

    Output = CreateMovieResponse

    def mutate(self, info, title, genre, duration, description=None, release_date=None):
        try:
            print(f"Creating movie: {title}, {genre}, {duration}")
            
            movie = Movie(
                title=title, 
                genre=genre, 
                duration=duration, 
                description=description
            )
            
            if release_date:
                try:
                    movie.release_date = datetime.strptime(release_date, '%Y-%m-%d').date()
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
        release_date = String()

    movie = Field(MovieType)

    def mutate(self, info, id, title=None, genre=None, duration=None, description=None, release_date=None):
        try:
            movie = Movie.query.get(id)
            if not movie:
                raise Exception(f"Movie with ID {id} not found")
                
            if title:
                movie.title = title
            if genre:
                movie.genre = genre
            if duration:
                movie.duration = duration
            if description is not None:
                movie.description = description
            if release_date:
                try:
                    movie.release_date = datetime.strptime(release_date, '%Y-%m-%d').date()
                except ValueError:
                    raise Exception("Invalid date format. Use YYYY-MM-DD")
            movie.save()
            return UpdateMovie(movie=movie)
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Error updating movie: {str(e)}")

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