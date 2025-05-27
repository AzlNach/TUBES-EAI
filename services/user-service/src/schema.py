from graphene import ObjectType, String, Int, Field, List, Mutation, Schema
from models import User, db
from auth import create_token

class UserType(ObjectType):
    id = Int()
    username = String()
    email = String()

class CreateUser(Mutation):
    class Arguments:
        username = String(required=True)
        email = String(required=True)
        password = String(required=True)

    user = Field(UserType)

    def mutate(self, info, username, email, password):
        user = User(username=username, email=email)
        user.set_password(password)
        user.save()
        return CreateUser(user=user)

class LoginUser(Mutation):
    class Arguments:
        email = String(required=True)
        password = String(required=True)

    token = String()

    def mutate(self, info, email, password):
        user = User.get_by_email(email)
        if user and user.check_password(password):
            token = create_token(user.id)
            return LoginUser(token=token)
        raise Exception("Invalid credentials")

class Query(ObjectType):
    users = List(UserType)
    user = Field(UserType, id=Int(required=True))

    def resolve_users(self, info):
        return User.query.all()

    def resolve_user(self, info, id):
        return User.get_by_id(id)

class UserMutation(ObjectType):
    create_user = CreateUser.Field()
    login_user = LoginUser.Field()

schema = Schema(query=Query, mutation=UserMutation)