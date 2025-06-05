from flask import Flask, request, jsonify
from models import User, db
from schema import schema
import os
import json
import time
import sys

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://user:password@mysql-server/user_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with app
db.init_app(app)

def create_sample_data():
    """Create sample admin user if none exist"""
    try:
        if User.query.count() == 0:
            # Create default admin user
            admin_user = User(username="admin", email="admin@cinema.com", role="ADMIN")
            admin_user.set_password("admin123")
            db.session.add(admin_user)
            
            # Create default regular user
            regular_user = User(username="user", email="user@cinema.com", role="USER")
            regular_user.set_password("user123")
            db.session.add(regular_user)
            
            db.session.commit()
            print("Sample user data created successfully!")
            print("Admin: admin@cinema.com / admin123")
            print("User: user@cinema.com / user123")
        else:
            print("User data already exists")
    except Exception as e:
        print(f"Error creating sample data: {e}")
        db.session.rollback()

def wait_for_db():
    """Wait for database to be ready"""
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            with app.app_context():
                db.create_all()
                create_sample_data()  # Add sample data
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

@app.route('/graphql', methods=['POST', 'GET'])
def graphql_endpoint():
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data:
                return jsonify({'errors': ['No JSON data provided']}), 400
                
            query = data.get('query')
            variables = data.get('variables')
            
            print(f"Received GraphQL request: {query[:100]}...")  # Debug log
            
            result = schema.execute(query, variables=variables)
            
            response = {
                'data': result.data,
                'errors': [str(error) for error in result.errors] if result.errors else None
            }
            
            print(f"GraphQL response: {str(response)[:200]}...")  # Debug log
            
            return jsonify(response)
        except Exception as e:
            print(f"Error in GraphQL endpoint: {str(e)}")
            return jsonify({'errors': [str(e)]}), 500
            
    elif request.method == 'GET':
        # Return GraphiQL interface
        return '''
        <!DOCTYPE html>
        <html>
        <head>
            <title>User Service - GraphiQL</title>
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
    app.run(debug=True, host='0.0.0.0', port=3012)