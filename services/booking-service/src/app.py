from flask import Flask, request, jsonify
from models import Booking, db
from schema import schema
import os
import json
import time
import sys

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://user:password@mysql-server/booking_db')
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
# ...existing code...
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
            <title>Booking Service - GraphiQL</title>
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

# ...existing code...
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3007)