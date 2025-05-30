from graphene import ObjectType, String, Int, Field, List, Mutation, Schema, Boolean
from models import User, db  # Already using absolute import, which is good
import traceback
from graphql import GraphQLError
import bcrypt

class UserType(ObjectType):
    id = Int()
    username = String()
    email = String()
    role = String()

class CreateUserResponse(ObjectType):
    success = Boolean()
    message = String()
    user = Field(lambda: UserType)

class CreateUser(Mutation):
    class Arguments:
        username = String(required=True)
        email = String(required=True)
        password = String(required=True)
        role = String()

    Output = CreateUserResponse

    def mutate(self, info, username, email, password, role="USER"):
        try:
            # Check if user with this username or email already exists
            existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
            if existing_user:
                if existing_user.username == username:
                    return CreateUserResponse(success=False, message="Username already exists", user=None)
                else:
                    return CreateUserResponse(success=False, message="Email already exists", user=None)
                
            # Create new user
            user = User(username=username, email=email, role=role)
            user.set_password(password)
            user.save()
            
            return CreateUserResponse(success=True, message="User created successfully", user=user)
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()  # Print the full error for debugging
            return CreateUserResponse(success=False, message=f"Error creating user: {str(e)}", user=None)

class LoginResponse(ObjectType):
    success = Boolean()
    token = String()
    message = String()
    user = Field(lambda: UserType)

class LoginUser(Mutation):
    class Arguments:
        email = String(required=True)
        password = String(required=True)

    Output = LoginResponse

    def mutate(self, info, email, password):
        try:
            user = User.get_by_email(email)
            if user and user.check_password(password):
                # Change from relative import to absolute import
                from auth import create_token
                token = create_token(user.id)
                return LoginResponse(success=True, token=token, message="Login successful", user=user)
            return LoginResponse(success=False, token=None, message="Invalid credentials", user=None)
        except Exception as e:
            traceback.print_exc()
            return LoginResponse(success=False, token=None, message=f"Login error: {str(e)}", user=None)

class UpdateUser(Mutation):
    class Arguments:
        id = Int(required=True)
        username = String()
        email = String()
        password = String()

    user = Field(UserType)

    def mutate(self, info, id, username=None, email=None, password=None):
        user = User.query.filter(User.id == id).first()
        
        if not user:
            raise GraphQLError(f"User with ID {id} not found")
            
        if username:
            user.username = username
        if email:
            user.email = email
        if password:
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            user.password = hashed_password.decode('utf-8')
            
        db.session.commit()
        return UpdateUser(user=user)

class DeleteUserResponse(ObjectType):
    success = Boolean()
    message = String()

class DeleteUser(Mutation):
    class Arguments:
        id = Int(required=True)

    Output = DeleteUserResponse

    def mutate(self, info, id):
        try:
            user = User.query.get(id)
            if not user:
                return DeleteUserResponse(success=False, message=f"User with ID {id} not found")
                
            db.session.delete(user)
            db.session.commit()
            return DeleteUserResponse(success=True, message=f"User with ID {id} deleted successfully")
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            return DeleteUserResponse(success=False, message=f"Error deleting user: {str(e)}")

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
    update_user = UpdateUser.Field()
    delete_user = DeleteUser.Field()

schema = Schema(query=Query, mutation=UserMutation)