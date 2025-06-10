from flask import Flask, request, jsonify
from models import Movie, db
from schema import schema
import os
import json
import time
import sys
from graphene import ObjectType, String, Int, List, Field, Mutation, Schema, Boolean, Float, DateTime
from datetime import datetime
import traceback

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://user:password@mysql-server/movie_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with app
db.init_app(app)

def wait_for_db():
    """Wait for database to be ready"""
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            with app.app_context():
                db.create_all()
                print("Database connection successful!")
                return True
        except Exception as e:
            retry_count += 1
            print(f"Database connection failed (attempt {retry_count}/{max_retries}): {e}")
            if retry_count < max_retries:
                print("Retrying in 2 seconds...")
                time.sleep(2)
            else:
                print("Max retries reached. Exiting.")
                sys.exit(1)
    
    return False

# Wait for database before starting
wait_for_db()

# GraphQL Types
class MovieType(ObjectType):
    id = Int()
    title = String()
    genre = String()
    duration = Int()
    description = String()
    release_date = String()  # Changed to String for better compatibility
    poster_url = String()
    rating = Float()
    
    # Camel case resolvers for frontend compatibility
    def resolve_release_date(self, info):
        """Convert release_date to ISO string format"""
        if hasattr(self, 'release_date') and self.release_date:
            if isinstance(self.release_date, str):
                return self.release_date
            return self.release_date.isoformat() if self.release_date else None
        return None

    def resolve_poster_url(self, info):
        """Resolve poster_url field"""
        return getattr(self, 'poster_url', None)

# Response Types for mutations
class CreateMovieResponse(ObjectType):
    movie = Field(MovieType)
    success = Boolean()
    message = String()

class UpdateMovieResponse(ObjectType):
    movie = Field(MovieType)
    success = Boolean()
    message = String()

class DeleteMovieResponse(ObjectType):
    success = Boolean()
    message = String()

# Movie Mutations
class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()
        release_date = String()  # Accept as string
        poster_url = String()
        rating = Float()

    Output = CreateMovieResponse

    def mutate(self, info, title, genre, duration, description=None, release_date=None, poster_url=None, rating=None):
        try:
            # Validate inputs
            if not title.strip():
                return CreateMovieResponse(
                    movie=None,
                    success=False,
                    message="Title cannot be empty"
                )
            
            if not genre.strip():
                return CreateMovieResponse(
                    movie=None,
                    success=False,
                    message="Genre cannot be empty"
                )
            
            if duration <= 0:
                return CreateMovieResponse(
                    movie=None,
                    success=False,
                    message="Duration must be greater than 0"
                )
            
            if rating is not None and (rating < 0 or rating > 10):
                return CreateMovieResponse(
                    movie=None,
                    success=False,
                    message="Rating must be between 0 and 10"
                )

            # Parse release_date if provided
            parsed_release_date = None
            if release_date:
                try:
                    parsed_release_date = datetime.fromisoformat(release_date.replace('Z', '+00:00')).date()
                except ValueError:
                    try:
                        parsed_release_date = datetime.strptime(release_date, '%Y-%m-%d').date()
                    except ValueError:
                        return CreateMovieResponse(
                            movie=None,
                            success=False,
                            message="Invalid date format. Use YYYY-MM-DD"
                        )

            new_movie = Movie(
                title=title.strip(),
                genre=genre.strip(),
                duration=duration,
                description=description.strip() if description else None,
                release_date=parsed_release_date,
                poster_url=poster_url.strip() if poster_url else None,
                rating=rating
            )
            new_movie.save()
            
            return CreateMovieResponse(
                movie=new_movie,
                success=True,
                message="Movie created successfully"
            )
        except Exception as e:
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
        poster_url = String()
        rating = Float()

    Output = UpdateMovieResponse

    def mutate(self, info, id, title=None, genre=None, duration=None, description=None, release_date=None, poster_url=None, rating=None):
        try:
            movie = Movie.query.get(id)
            if not movie:
                return UpdateMovieResponse(
                    movie=None,
                    success=False,
                    message=f"Movie with ID {id} not found"
                )

            # Update fields if provided
            if title is not None:
                if not title.strip():
                    return UpdateMovieResponse(
                        movie=None,
                        success=False,
                        message="Title cannot be empty"
                    )
                movie.title = title.strip()
            
            if genre is not None:
                if not genre.strip():
                    return UpdateMovieResponse(
                        movie=None,
                        success=False,
                        message="Genre cannot be empty"
                    )
                movie.genre = genre.strip()
            
            if duration is not None:
                if duration <= 0:
                    return UpdateMovieResponse(
                        movie=None,
                        success=False,
                        message="Duration must be greater than 0"
                    )
                movie.duration = duration
            
            if description is not None:
                movie.description = description.strip() if description else None
            
            if release_date is not None:
                if release_date:
                    try:
                        parsed_date = datetime.fromisoformat(release_date.replace('Z', '+00:00')).date()
                        movie.release_date = parsed_date
                    except ValueError:
                        try:
                            parsed_date = datetime.strptime(release_date, '%Y-%m-%d').date()
                            movie.release_date = parsed_date
                        except ValueError:
                            return UpdateMovieResponse(
                                movie=None,
                                success=False,
                                message="Invalid date format. Use YYYY-MM-DD"
                            )
                else:
                    movie.release_date = None
            
            if poster_url is not None:
                movie.poster_url = poster_url.strip() if poster_url else None
            
            if rating is not None:
                if rating < 0 or rating > 10:
                    return UpdateMovieResponse(
                        movie=None,
                        success=False,
                        message="Rating must be between 0 and 10"
                    )
                movie.rating = rating

            movie.save()
            
            return UpdateMovieResponse(
                movie=movie,
                success=True,
                message="Movie updated successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return UpdateMovieResponse(
                movie=None,
                success=False,
                message=f"Error updating movie: {str(e)}"
            )

class DeleteMovie(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteMovieResponse

    def mutate(self, info, id):
        try:
            movie = Movie.query.get(id)
            if not movie:
                return DeleteMovieResponse(
                    success=False,
                    message=f"Movie with ID {id} not found"
                )
            
            movie.delete()
            return DeleteMovieResponse(
                success=True,
                message="Movie deleted successfully"
            )
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteMovieResponse(
                success=False,
                message=f"Error deleting movie: {str(e)}"
            )

# Query Class
class Query(ObjectType):
    # Public queries (no auth required)
    movies = List(MovieType)
    public_movies = List(MovieType)  # Alias for consistency
    movie = Field(MovieType, id=Int(required=True))

    def resolve_movies(self, info):
        try:
            return Movie.query.all()
        except Exception as e:
            print(f"Error in resolve_movies: {str(e)}")
            traceback.print_exc()
            return []

    def resolve_public_movies(self, info):
        """Alias for movies - for frontend consistency"""
        return self.resolve_movies(info)

    def resolve_movie(self, info, id):
        try:
            return Movie.query.get(id)
        except Exception as e:
            print(f"Error in resolve_movie: {str(e)}")
            return None

# Mutation Class
class Mutation(ObjectType):
    create_movie = CreateMovie.Field()
    update_movie = UpdateMovie.Field()
    delete_movie = DeleteMovie.Field()

schema = Schema(query=Query, mutation=Mutation)

@app.route('/graphql', methods=['POST', 'GET'])
def graphql_endpoint():
    if request.method == 'POST':
        data = request.get_json()
        query = data.get('query')
        variables = data.get('variables')
        result = schema.execute(query, variables=variables)
        return jsonify({
            'data': result.data,
            'errors': [str(error) for error in result.errors] if result.errors else None
        })
    elif request.method == 'GET':
        # Return GraphiQL interface with compatible React versions
        return '''
        <!DOCTYPE html>
        <html>
        <head>
            <title>Movie Service - GraphiQL</title>
            <link href="https://unpkg.com/graphiql@1.5.0/graphiql.min.css" rel="stylesheet" />
        </head>
        <body style="margin: 0;">
            <div id="graphiql" style="height: 100vh;"></div>
            <script src="https://unpkg.com/react@16.14.0/umd/react.production.min.js"></script>
            <script src="https://unpkg.com/react-dom@16.14.0/umd/react-dom.production.min.js"></script>
            <script src="https://unpkg.com/graphiql@1.5.0/graphiql.min.js"></script>
            <script>
                ReactDOM.render(
                    React.createElement(GraphiQL, {
                        fetcher: GraphiQL.createFetcher({ url: '/graphql' }),
                    }),
                    document.getElementById('graphiql'),
                );
            </script>
        </body>
        </html>
        '''

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3010)