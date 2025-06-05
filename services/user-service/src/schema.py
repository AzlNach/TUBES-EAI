from graphene import ObjectType, String, Int, Field, List, Mutation, Schema, Boolean
from models import User, db
import traceback
from auth import verify_token, create_token

class UserType(ObjectType):
    id = Int()
    username = String()
    email = String()
    role = String()

class CreateUserResponse(ObjectType):
    success = Boolean()
    message = String()
    user = Field(lambda: UserType)

class TokenVerificationResponse(ObjectType):
    valid = Boolean()
    userId = Int()  # ← Changed from user_id to userId
    role = String()
    error = String()

class LoginResponse(ObjectType):
    success = Boolean()
    token = String()
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
            print(f"Creating user: {username}, {email}, {role}")  # Debug log
            
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
            
            print(f"User created successfully: {user}")  # Debug log
            
            return CreateUserResponse(success=True, message="User created successfully", user=user)
        except Exception as e:
            print(f"Error creating user: {str(e)}")  # Debug log
            traceback.print_exc()
            db.session.rollback()
            return CreateUserResponse(success=False, message=f"Error creating user: {str(e)}", user=None)

class LoginUser(Mutation):
    class Arguments:
        email = String(required=True)
        password = String(required=True)

    Output = LoginResponse

    def mutate(self, info, email, password):
        try:
            print(f"Login attempt for: {email}")  # Debug log
            
            user = User.get_by_email(email)
            if user and user.check_password(password):
                token = create_token(user.id)
                print(f"Login successful for user: {user.username}")  # Debug log
                return LoginResponse(success=True, token=token, message="Login successful", user=user)
            
            print(f"Invalid credentials for: {email}")  # Debug log
            return LoginResponse(success=False, token=None, message="Invalid credentials", user=None)
        except Exception as e:
            print(f"Login error: {str(e)}")  # Debug log
            traceback.print_exc()
            return LoginResponse(success=False, token=None, message=f"Login error: {str(e)}", user=None)

class VerifyToken(Mutation):
    class Arguments:
        token = String(required=True)

    Output = TokenVerificationResponse

    def mutate(self, info, token):
        try:
            print(f"Verifying token: {token[:20]}...")
            
            result = verify_token(token)
            if result['valid']:
                print(f"Token valid for user_id: {result['user_id']}, role: {result['role']}")
                return TokenVerificationResponse(
                    valid=True,
                    userId=result['user_id'],  # ← Changed to userId
                    role=result['role']
                )
            else:
                print(f"Token invalid: {result.get('error', 'Unknown error')}")
                return TokenVerificationResponse(
                    valid=False,
                    error=result.get('error', 'Invalid token')
                )
        except Exception as e:
            print(f"Token verification error: {str(e)}")
            traceback.print_exc()
            return TokenVerificationResponse(
                valid=False,
                error=f"Token verification failed: {str(e)}"
            )

class UpdateUser(Mutation):
    class Arguments:
        id = Int(required=True)
        username = String()
        email = String()
        password = String()

    user = Field(UserType)

    def mutate(self, info, id, username=None, email=None, password=None):
        try:
            user = User.query.filter(User.id == id).first()
            
            if not user:
                raise Exception(f"User with ID {id} not found")
                
            if username:
                user.username = username
            if email:
                user.email = email
            if password:
                user.set_password(password)
                
            db.session.commit()
            return UpdateUser(user=user)
        except Exception as e:
            db.session.rollback()
            traceback.print_exc()
            raise Exception(f"Error updating user: {str(e)}")

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
    verify_token = Field(TokenVerificationResponse, token=String(required=True))

    def resolve_users(self, info):
        try:
            print("Resolving users query")  # Debug log
            users = User.query.all()
            print(f"Found {len(users)} users")  # Debug log
            return users
        except Exception as e:
            print(f"Error in resolve_users: {str(e)}")  # Debug log
            traceback.print_exc()
            return []

    def resolve_user(self, info, id):
        try:
            print(f"Resolving user query for ID: {id}")  # Debug log
            user = User.get_by_id(id)
            if user:
                print(f"Found user: {user.username}")  # Debug log
            else:
                print(f"User with ID {id} not found")  # Debug log
            return user
        except Exception as e:
            print(f"Error in resolve_user: {str(e)}")  # Debug log
            traceback.print_exc()
            return None
    
    def resolve_verify_token(self, info, token):
        try:
            print(f"Resolving verify_token query")
            result = verify_token(token)
            if result['valid']:
                return TokenVerificationResponse(
                    valid=True,
                    userId=result['user_id'],  # ← Changed to userId
                    role=result['role']
                )
            else:
                return TokenVerificationResponse(
                    valid=False,
                    error=result.get('error', 'Invalid token')
                )
        except Exception as e:
            print(f"Error in resolve_verify_token: {str(e)}")
            traceback.print_exc()
            return TokenVerificationResponse(
                valid=False,
                error=f"Token verification failed: {str(e)}"
            )

class Mutation(ObjectType):
    create_user = CreateUser.Field()
    login_user = LoginUser.Field()
    update_user = UpdateUser.Field()
    delete_user = DeleteUser.Field()
    verify_token = VerifyToken.Field()

schema = Schema(query=Query, mutation=Mutation)