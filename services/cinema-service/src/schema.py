from graphene import ObjectType, String, Int, List, Field, Mutation, Schema
from models import Cinema, db

class CinemaType(ObjectType):
    id = Int()
    name = String()
    location = String()

class Query(ObjectType):
    cinemas = List(CinemaType)
    cinema = Field(CinemaType, id=Int(required=True))

    def resolve_cinemas(self, info):
        return Cinema.query.all()

    def resolve_cinema(self, info, id):
        return Cinema.query.get(id)

class CreateCinema(Mutation):
    class Arguments:
        name = String(required=True)
        location = String(required=True)

    cinema = Field(CinemaType)

    def mutate(self, info, name, location):
        new_cinema = Cinema(name=name, location=location)
        new_cinema.save()
        return CreateCinema(cinema=new_cinema)

class UpdateCinema(Mutation):
    class Arguments:
        id = Int(required=True)
        name = String()
        location = String()

    cinema = Field(CinemaType)

    def mutate(self, info, id, name=None, location=None):
        cinema = Cinema.query.get(id)
        if cinema:
            if name:
                cinema.name = name
            if location:
                cinema.location = location
            cinema.save()
        return UpdateCinema(cinema=cinema)

class DeleteCinema(Mutation):
    class Arguments:
        id = Int(required=True)

    success = String()

    def mutate(self, info, id):
        cinema = Cinema.query.get(id)
        if cinema:
            cinema.delete()
            return DeleteCinema(success="Cinema deleted successfully.")
        return DeleteCinema(success="Cinema not found.")

class Mutation(ObjectType):
    create_cinema = CreateCinema.Field()
    update_cinema = UpdateCinema.Field()
    delete_cinema = DeleteCinema.Field()

schema = Schema(query=Query, mutation=Mutation)