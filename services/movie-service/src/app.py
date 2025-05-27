from flask import Flask, request, jsonify
from models import Movie, db
from schema import schema
import os
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://user:password@movie-db/movie_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with app
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

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
        # Return GraphiQL interface
        return '''
        <!DOCTYPE html>
        <html>
        <head>
            <title>GraphiQL</title>
            <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
        </head>
        <body style="margin: 0;">
            <div id="graphiql" style="height: 100vh;"></div>
            <script
                crossorigin
                src="https://unpkg.com/react@17/umd/react.production.min.js"
            ></script>
            <script
                crossorigin
                src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"
            ></script>
            <script
                crossorigin
                src="https://unpkg.com/graphiql/graphiql.min.js"
            ></script>
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