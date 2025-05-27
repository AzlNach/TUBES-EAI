from graphene import ObjectType, String, Int, List, Field, Mutation, Schema
from models import Movie, db

class MovieType(ObjectType):
    id = Int()
    title = String()
    genre = String()
    duration = Int()
    description = String()

class Query(ObjectType):
    movies = List(MovieType)
    movie = Field(MovieType, id=Int(required=True))

    def resolve_movies(self, info):
        return Movie.query.all()

    def resolve_movie(self, info, id):
        return Movie.query.get(id)

class CreateMovie(Mutation):
    class Arguments:
        title = String(required=True)
        genre = String(required=True)
        duration = Int(required=True)
        description = String()

    movie = Field(MovieType)

    def mutate(self, info, title, genre, duration, description=None):
        movie = Movie(title=title, genre=genre, duration=duration, description=description)
        movie.save()
        return CreateMovie(movie=movie)

class UpdateMovie(Mutation):
    class Arguments:
        id = Int(required=True)
        title = String()
        genre = String()
        duration = Int()
        description = String()

    movie = Field(MovieType)

    def mutate(self, info, id, title=None, genre=None, duration=None, description=None):
        movie = Movie.query.get(id)
        if movie:
            if title:
                movie.title = title
            if genre:
                movie.genre = genre
            if duration:
                movie.duration = duration
            if description is not None:
                movie.description = description
            movie.save()
        return UpdateMovie(movie=movie)

class DeleteMovie(Mutation):
    class Arguments:
        id = Int(required=True)

    success = String()

    def mutate(self, info, id):
        movie = Movie.query.get(id)
        if movie:
            movie.delete()
            return DeleteMovie(success="Movie deleted successfully.")
        return DeleteMovie(success="Movie not found.")

class Mutation(ObjectType):
    create_movie = CreateMovie.Field()
    update_movie = UpdateMovie.Field()
    delete_movie = DeleteMovie.Field()

schema = Schema(query=Query, mutation=Mutation)