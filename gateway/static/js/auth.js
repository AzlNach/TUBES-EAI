// Configuration for API endpoints
const GRAPHQL_ENDPOINT = '/graphql';

// Authentication utility functions
class AuthService {
    static TOKEN_KEY = 'cinema_auth_token';
    static USER_KEY = 'cinema_user_data';

    // Check if user is logged in
    static isLoggedIn() {
        return localStorage.getItem(this.TOKEN_KEY) !== null;
    }

    // Get current user token
    static getToken() {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    // Get current user data
    static getUser() {
        const userData = localStorage.getItem(this.USER_KEY);
        return userData ? JSON.parse(userData) : null;
    }

    // Save authentication data
    static saveAuth(token, user) {
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        console.log('Auth data saved:', { token: token.substring(0, 20) + '...', user });
    }

    // Clear authentication data
    static clearAuth() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        console.log('Auth data cleared');
    }

    // Make GraphQL request
    static async graphqlRequest(query, variables = {}, requireAuth = false) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
        };

        // Only add Authorization header if token exists and auth is required
        if (token && requireAuth) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('Making GraphQL request:', { 
            query: query.substring(0, 200) + '...', 
            variables,
            requireAuth,
            hasToken: !!token,
            endpoint: GRAPHQL_ENDPOINT
        });

        try {
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            console.log('GraphQL response status:', response.status);
            console.log('GraphQL response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('GraphQL HTTP Error Response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const result = await response.json();
            console.log('GraphQL response data:', result);
            
            return result;
        } catch (error) {
            console.error('GraphQL Request Error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

        static async testGraphQLConnection() {
        try {
            const result = await this.graphqlRequest(`
                query {
                    test
                }
            `, {}, false);
            
            console.log('GraphQL connection test result:', result);
            return result;
        } catch (error) {
            console.error('GraphQL connection test failed:', error);
            throw error;
        }
    }

    // Login user
    static async login(email, password) {
        const query = `
            mutation LoginUser($email: String!, $password: String!) {
                login(email: $email, password: $password) {
                    success
                    token
                    message
                    user {
                        id
                        username
                        email
                        role
                    }
                }
            }
        `;

        const result = await this.graphqlRequest(query, { email, password }, false);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        const loginData = result.data.login;
        if (loginData.success && loginData.token) {
            this.saveAuth(loginData.token, loginData.user);
            return loginData;
        } else {
            throw new Error(loginData.message || 'Login failed');
        }
    }

    // Register user
    static async register(username, email, password) {
        const query = `
            mutation RegisterUser($username: String!, $email: String!, $password: String!) {
                register(username: $username, email: $email, password: $password) {
                    success
                    token
                    message
                    user {
                        id
                        username
                        email
                        role
                    }
                }
            }
        `;

        const result = await this.graphqlRequest(query, { username, email, password }, false);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        const registerData = result.data.register;
        if (registerData.success) {
            if (registerData.token && registerData.user) {
                this.saveAuth(registerData.token, registerData.user);
            }
            return registerData;
        } else {
            throw new Error(registerData.message || 'Registration failed');
        }
    }

    // Verify token
    static async verifyToken() {
        const token = this.getToken();
        if (!token) {
            return { valid: false, error: 'No token found' };
        }

        const query = `
            query {
                test
            }
        `;

        try {
            const result = await this.graphqlRequest(query, {}, true);
            if (result.errors) {
                return { valid: false, error: result.errors[0].message };
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Logout user
    static logout() {
        this.clearAuth();
        this.showMessage('You have been logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }

    // Utility function to show messages
    static showMessage(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHtml);
        
        setTimeout(() => {
            const alerts = document.querySelectorAll('.alert.position-fixed');
            alerts.forEach(alert => {
                if (alert.textContent.includes(message)) {
                    alert.remove();
                }
            });
        }, 5000);
    }

    // Check if user has specific role
    static hasRole(role) {
        const user = this.getUser();
        return user && user.role === role;
    }

    // Check if user is admin
    static isAdmin() {
        return this.hasRole('ADMIN');
    }

    // PUBLIC METHODS - No authentication required
    static async getPublicMovies() {
        const query = `
            query {
                publicMovies {
                    id
                    title
                    genre
                    duration
                    description
                    releaseDate
                    posterUrl
                    rating
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(query, {}, false);
            
            if (result.errors) {
                console.error('Error fetching public movies:', result.errors);
                return [];
            }

            return result.data.publicMovies || [];
        } catch (error) {
            console.error('Error in getPublicMovies:', error);
            return [];
        }
    }

    static async getPublicCinemas() {
        const query = `
            query {
                publicCinemas {
                    id
                    name
                    city
                    capacity
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(query, {}, false);
            
            if (result.errors) {
                console.error('Error fetching public cinemas:', result.errors);
                return [];
            }

            return result.data.publicCinemas || [];
        } catch (error) {
            console.error('Error in getPublicCinemas:', error);
            return [];
        }
    }

    // AUTHENTICATED METHODS
    static async getMovies() {
        const query = `
            query {
                movies {
                    id
                    title
                    genre
                    duration
                    description
                    releaseDate
                    posterUrl
                    rating
                }
            }
        `;

        const result = await this.graphqlRequest(query, {}, true);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        return result.data.movies || [];
    }

    static async getCinemas() {
        const query = `
            query {
                cinemas {
                    id
                    name
                    city
                    capacity
                }
            }
        `;

        const result = await this.graphqlRequest(query, {}, true);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        return result.data.cinemas || [];
    }

    // Helper method to get movies (public or authenticated based on login status)
    static async getMoviesForDisplay() {
        try {
            if (this.isLoggedIn()) {
                // Try authenticated first, fallback to public if fails
                try {
                    return await this.getMovies();
                } catch (authError) {
                    console.warn('Authenticated movies request failed, falling back to public:', authError);
                    return await this.getPublicMovies();
                }
            } else {
                return await this.getPublicMovies();
            }
        } catch (error) {
            console.error('Error fetching movies for display:', error);
            return [];
        }
    }
    // Helper method to get cinemas (public or authenticated based on login status)
    static async getCinemasForDisplay() {
        try {
            if (this.isLoggedIn()) {
                // Try authenticated first, fallback to public if fails
                try {
                    return await this.getCinemas();
                } catch (authError) {
                    console.warn('Authenticated cinemas request failed, falling back to public:', authError);
                    return await this.getPublicCinemas();
                }
            } else {
                return await this.getPublicCinemas();
            }
        } catch (error) {
            console.error('Error fetching cinemas for display:', error);
            return [];
        }
    }
    // Other authenticated methods...
    static async getShowtimes(movieId = null, auditoriumId = null) {
        const query = `
            query GetShowtimes($movieId: Int, $auditoriumId: Int) {
                showtimes(movieId: $movieId, auditoriumId: $auditoriumId) {
                    id
                    movieId
                    auditoriumId
                    startTime
                    price
                }
            }
        `;

        const variables = {};
        if (movieId) variables.movieId = movieId;
        if (auditoriumId) variables.auditoriumId = auditoriumId;

        const result = await this.graphqlRequest(query, variables, true);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        return result.data.showtimes || [];
    }

    static async getShowtimesForDisplay(movieId = null, auditoriumId = null) {
        const query = `
            query GetShowtimes($movieId: Int, $auditoriumId: Int) {
                showtimes(movieId: $movieId, auditoriumId: $auditoriumId) {
                    id
                    movieId
                    auditoriumId
                    startTime
                    price
                    movie {
                        id
                        title
                        genre
                        duration
                        posterUrl
                        rating
                        description
                    }
                    auditorium {
                        id
                        name
                        cinema {
                            id
                            name
                            city
                        }
                    }
                }
            }
        `;

        try {
            const variables = {};
            if (movieId) variables.movieId = parseInt(movieId);
            if (auditoriumId) variables.auditoriumId = parseInt(auditoriumId);

            console.log('GraphQL query variables:', variables);
            console.log('GraphQL query being sent:', query);
            
            const result = await this.graphqlRequest(query, variables, false);
            
            console.log('GraphQL result:', result);
            
            if (result.errors) {
                console.error('GraphQL errors:', result.errors);
                result.errors.forEach(error => {
                    console.error('GraphQL Error Detail:', error.message);
                    console.error('Error locations:', error.locations);
                });
                return [];
            }

            const showtimes = result.data?.showtimes || [];
            console.log('Parsed showtimes:', showtimes.length, 'items');
            console.log('First showtime sample:', showtimes[0]);
            
            return showtimes;
        } catch (error) {
            console.error('Error in getShowtimesForDisplay:', error);
            console.error('Error stack:', error.stack);
            return [];
        }
    }

    static async getSeatStatuses(showtimeId) {
        const query = `
            query GetSeatStatuses($showtimeId: Int!) {
                seatStatuses(showtimeId: $showtimeId) {
                    id
                    showtimeId
                    seatNumber
                    status
                    bookingId
                }
            }
        `;

        const result = await this.graphqlRequest(query, { showtimeId }, true);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        return result.data.seatStatuses || [];
    }

    static async createBooking(showtimeId, seatNumbers, totalPrice) {
        const mutation = `
            mutation CreateBooking($showtimeId: Int!, $seatNumbers: [String!]!, $totalPrice: Float!) {
                createBooking(showtimeId: $showtimeId, seatNumbers: $seatNumbers, totalPrice: $totalPrice) {
                    success
                    message
                    booking {
                        id
                        status
                        totalPrice
                        bookingDate
                    }
                }
            }
        `;

        const result = await this.graphqlRequest(mutation, { showtimeId, seatNumbers, totalPrice }, true);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        const bookingData = result.data.createBooking;
        if (!bookingData.success) {
            throw new Error(bookingData.message || 'Booking failed');
        }

        return bookingData;
    }

    static async getMyBookings() {
        const query = `
            query {
                myBookings {
                    id
                    userId
                    showtimeId
                    status
                    totalPrice
                    bookingDate
                    tickets {
                        id
                        seatNumber
                    }
                }
            }
        `;

        const result = await this.graphqlRequest(query, {}, true);
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        return result.data.myBookings || [];
    }
}


// Update navigation based on auth status
function updateNavigation() {
    const authContainer = document.getElementById('navbar-auth');
    if (!authContainer) return;

    if (AuthService.isLoggedIn()) {
        const user = AuthService.getUser();
        authContainer.innerHTML = `
            <div class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fas fa-user me-1"></i> ${user.username}
                    <span class="badge bg-primary ms-2">${user.role}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><h6 class="dropdown-header">Account</h6></li>
                    <li><a class="dropdown-item" href="/dashboard">
                        <i class="fas fa-home me-2"></i>Dashboard
                    </a></li>
                    <li><a class="dropdown-item" href="bookings.html">
                        <i class="fas fa-ticket-alt me-2"></i>My Bookings
                    </a></li>
                    <li><a class="dropdown-item" href="payments.html">
                        <i class="fas fa-credit-card me-2"></i>Payments
                    </a></li>
                    ${user.role === 'ADMIN' ? `
                    <li><hr class="dropdown-divider"></li>
                    <li><h6 class="dropdown-header">Admin</h6></li>
                    <li><a class="dropdown-item" href="admin-dashboard.html">
                        <i class="fas fa-tachometer-alt me-2"></i>Admin Panel
                    </a></li>
                    <li><a class="dropdown-item" href="admin-movies.html">
                        <i class="fas fa-film me-2"></i>Manage Movies
                    </a></li>
                    <li><a class="dropdown-item" href="admin-cinemas.html">
                        <i class="fas fa-building me-2"></i>Manage Cinemas
                    </a></li>
                    ` : ''}
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" onclick="AuthService.logout()">
                        <i class="fas fa-sign-out-alt me-2"></i>Logout
                    </a></li>
                </ul>
            </div>
        `;
    } else {
        authContainer.innerHTML = `
            <a class="nav-link" href="/login">
                <i class="fas fa-sign-in-alt me-1"></i> Login
            </a>
            <a class="nav-link" href="/register">
                <i class="fas fa-user-plus me-1"></i> Register
            </a>
        `;
    }
}

// Form validation utilities
class FormValidator {
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static validatePassword(password) {
        return password && password.length >= 6;
    }

    static validateUsername(username) {
        return username && username.length >= 3 && username.length <= 20;
    }

    static showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const feedback = field.parentNode.querySelector('.invalid-feedback') || 
                        field.nextElementSibling;
        
        field.classList.add('is-invalid');
        if (feedback) {
            feedback.textContent = message;
        }
    }

    static clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        field.classList.remove('is-invalid');
        const feedback = field.parentNode.querySelector('.invalid-feedback') || 
                        field.nextElementSibling;
        if (feedback) {
            feedback.textContent = '';
        }
    }

    static clearAllErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        const invalidFields = form.querySelectorAll('.is-invalid');
        invalidFields.forEach(field => {
            field.classList.remove('is-invalid');
        });
        const feedbacks = form.querySelectorAll('.invalid-feedback');
        feedbacks.forEach(feedback => {
            feedback.textContent = '';
        });
    }

    static validateForm(formId, rules) {
        const form = document.getElementById(formId);
        if (!form) return false;

        let isValid = true;
        this.clearAllErrors(formId);

        for (const [fieldId, validation] of Object.entries(rules)) {
            const field = document.getElementById(fieldId);
            if (!field) continue;

            const value = field.value.trim();
            
            if (validation.required && !value) {
                this.showFieldError(fieldId, validation.required);
                isValid = false;
                continue;
            }

            if (value && validation.validator && !validation.validator(value)) {
                this.showFieldError(fieldId, validation.message);
                isValid = false;
            }
        }

        return isValid;
    }
}

// Route protection utility
function requireAuth(redirectTo = '/login') {
    if (!AuthService.isLoggedIn()) {
        AuthService.showMessage('Please login to access this page', 'warning');
        setTimeout(() => {
            window.location.href = redirectTo;
        }, 1500);
        return false;
    }
    return true;
}

function requireGuest(redirectTo = '/dashboard') {
    if (AuthService.isLoggedIn()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

function requireAdmin() {
    if (!AuthService.isLoggedIn()) {
        AuthService.showMessage('Please login to access this page', 'warning');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        return false;
    }
    
    if (!AuthService.isAdmin()) {
        AuthService.showMessage('Admin access required', 'error');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1500);
        return false;
    }
    
    return true;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateNavigation();
    
    // Check token validity periodically (optional)
    if (AuthService.isLoggedIn()) {
        // Verify token every 30 minutes
        setInterval(async () => {
            try {
                const result = await AuthService.verifyToken();
                if (!result.valid) {
                    console.log('Token expired, logging out...');
                    AuthService.logout();
                }
            } catch (error) {
                console.error('Token verification error:', error);
            }
        }, 30 * 60 * 1000); // 30 minutes
    }
});

// Export for use in other files
window.AuthService = AuthService;
window.FormValidator = FormValidator;
window.updateNavigation = updateNavigation;
window.requireAuth = requireAuth;
window.requireGuest = requireGuest;
window.requireAdmin = requireAdmin;