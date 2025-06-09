from flask import Flask, request, send_from_directory, send_file
from flask_graphql import GraphQLView
from schema import schema
import os

app = Flask(__name__, 
           static_folder='static',
           static_url_path='/static')


# Middleware untuk menambahkan headers ke context
def add_context(request):
    return {
        'Authorization': request.headers.get('Authorization'),
        'HTTP_AUTHORIZATION': request.headers.get('HTTP_AUTHORIZATION')
    }

# GraphQL endpoint
app.add_url_rule(
    '/graphql',
    view_func=GraphQLView.as_view(
        'graphql',
        schema=schema,
        graphiql=True,  # Enable GraphiQL interface
        get_context=lambda: add_context(request)
    )
)

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(app.static_folder, filename)

@app.route('/login')
def login_page():
    return send_file('./static/templates/login.html')

@app.route('/register')
def register_page():
    return send_file('./static/templates/register.html')

@app.route('/movies')
def movies_page():
    return send_file('./static/templates/movies.html')

# ADD THIS: Cinemas page route (untuk konsistensi)
@app.route('/cinemas')
def cinemas_page():
    return send_file('./static/templates/cinemas.html')

# ADD THIS: Showtimes page route (untuk konsistensi)
@app.route('/showtimes')
def showtimes_page():
    return send_file('./static/templates/showtimes.html')


@app.route('/dashboard')
def dashboard_page():
    return send_file('./static/templates/index.html')

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cinema GraphQL Gateway</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            h1 { color: #333; }
            .section { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
            code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>🎬 Cinema GraphQL Gateway</h1>
        
        <div class="section">
            <h3>🚀 GraphQL Endpoint</h3>
            <p><strong>URL:</strong> <a href="/graphql">/graphql</a></p>
            <p>Interactive GraphiQL interface available for testing queries and mutations.</p>
        </div>
        
        <div class="section">
            <h3>🔓 Public Operations</h3>
            <p><strong>Register:</strong> <code>mutation { register(username: "user", email: "user@test.com", password: "pass") { success token user { id username role } } }</code></p>
            <p><strong>Login:</strong> <code>mutation { login(email: "user@test.com", password: "pass") { success token user { id username role } } }</code></p>
        </div>
        
        <div class="section">
            <h3>👤 User Operations (Require Authentication)</h3>
            <p>Add <code>Authorization: Bearer YOUR_TOKEN</code> header</p>
            <ul>
                <li><strong>View Movies:</strong> <code>query { movies { id title genre duration } }</code></li>
                <li><strong>View Cinemas:</strong> <code>query { cinemas { id name location capacity } }</code></li>
                <li><strong>My Bookings:</strong> <code>query { myBookings { id movie_id cinema_id status } }</code></li>
                <li><strong>Create Booking:</strong> <code>mutation { createBooking(movie_id: 1, cinema_id: 1, showtime: "2024-12-20 19:00") { booking { id status } } }</code></li>
            </ul>
        </div>
        
        <div class="section">
            <h3>👨‍💼 Admin Operations (Require Admin Role)</h3>
            <ul>
                <li><strong>View All Users:</strong> <code>query { users { id username email role } }</code></li>
                <li><strong>Create Movie:</strong> <code>mutation { createMovie(title: "Movie Title", genre: "Action", duration: 120) { movie { id title } } }</code></li>
                <li><strong>All Bookings:</strong> <code>query { allBookings { id user_id movie_id status } }</code></li>
            </ul>
        </div>
    </body>
    </html>
    '''

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)