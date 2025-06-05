from graphene import ObjectType, String, Int, List, Field, Mutation, Schema, Boolean
from models import Cinema, db
import traceback

class CinemaType(ObjectType):
    id = Int()
    name = String()
    location = String()
    capacity = Int()

class CreateCinemaResponse(ObjectType):
    cinema = Field(CinemaType)
    success = Boolean()
    message = String()

class CreateCinema(Mutation):
    class Arguments:
        name = String(required=True)
        location = String(required=True)
        capacity = Int()

    Output = CreateCinemaResponse

    def mutate(self, info, name, location, capacity=100):
        try:
            new_cinema = Cinema(name=name, location=location, capacity=capacity)
            new_cinema.save()
            return CreateCinemaResponse(
                cinema=new_cinema, 
                success=True, 
                message="Cinema created successfully"
            )
        except Exception as e:
            traceback.print_exc()
            db.session.rollback()
            return CreateCinemaResponse(
                cinema=None, 
                success=False, 
                message=f"Error creating cinema: {str(e)}"
            )

class UpdateCinema(Mutation):
    class Arguments:
        id = Int(required=True)
        name = String()
        location = String()
        capacity = Int()

    cinema = Field(CinemaType)

    def mutate(self, info, id, name=None, location=None, capacity=None):
        try:
            cinema = Cinema.query.get(id)
            if not cinema:
                raise Exception(f"Cinema with ID {id} not found")
                
            if name:
                cinema.name = name
            if location:
                cinema.location = location
            if capacity:
                cinema.capacity = capacity
            cinema.save()
            return UpdateCinema(cinema=cinema)
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Error updating cinema: {str(e)}")

class DeleteCinemaResponse(ObjectType):
    success = Boolean()
    message = String()

class DeleteCinema(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteCinemaResponse

    def mutate(self, info, id):
        try:
            cinema = Cinema.query.get(id)
            if not cinema:
                return DeleteCinemaResponse(success=False, message="Cinema not found")
                
            cinema.delete()
            return DeleteCinemaResponse(success=True, message="Cinema deleted successfully")
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteCinemaResponse(success=False, message=f"Error deleting cinema: {str(e)}")

class Query(ObjectType):
    cinemas = List(CinemaType)
    cinema = Field(CinemaType, id=Int(required=True))

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

class Mutation(ObjectType):
    create_cinema = CreateCinema.Field()
    update_cinema = UpdateCinema.Field()
    delete_cinema = DeleteCinema.Field()

schema = Schema(query=Query, mutation=Mutation)