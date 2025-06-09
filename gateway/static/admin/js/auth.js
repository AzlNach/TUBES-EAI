/**
 * Admin Authentication Service
 * Handles admin login, token management, and authorization
 */

class AdminAuthService {
    constructor() {
        this.baseURL = '/graphql';
        this.tokenKey = 'admin_token';
        this.userKey = 'admin_user';
        this.init();
    }

    init() {
        // Check if user is logged in and is admin
        if (this.isLoggedIn() && !this.isAdmin()) {
            this.logout();
            window.location.href = '/admin/login';
        }
        
        // Redirect to login if not authenticated and not on login page
        if (!this.isLoggedIn() && !window.location.pathname.includes('/admin/login')) {
            window.location.href = '/admin/login';
        }
    }

    // GraphQL request with admin authentication
    async graphqlRequest(query, variables = {}, requireAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (requireAuth) {
            const token = this.getToken();
            if (!token) {
                throw new Error('No authentication token found');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            const result = await response.json();

            if (result.errors) {
                console.error('GraphQL errors:', result.errors);
                
                // Check for authentication errors
                const authError = result.errors.find(error => 
                    error.message.includes('Authentication') || 
                    error.message.includes('Unauthorized') ||
                    error.message.includes('Admin access required')
                );

                if (authError) {
                    this.logout();
                    window.location.href = '/admin/login';
                    return null;
                }

                throw new Error(result.errors[0].message);
            }

            return result;
        } catch (error) {
            console.error('Admin GraphQL request failed:', error);
            throw error;
        }
    }

    // Admin login
    async login(email, password) {
        const loginQuery = `
            mutation AdminLogin($email: String!, $password: String!) {
                login(email: $email, password: $password) {
                    success
                    token
                    user {
                        id
                        username
                        email
                        role
                    }
                    message
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(loginQuery, { email, password }, false);
            
            if (result.data.login.success) {
                const { token, user } = result.data.login;
                
                // Check if user is admin
                if (user.role !== 'admin') {
                    throw new Error('Admin access required');
                }
                
                this.setToken(token);
                this.setUser(user);
                
                return {
                    success: true,
                    user: user
                };
            } else {
                throw new Error(result.data.login.message || 'Login failed');
            }
        } catch (error) {
            console.error('Admin login error:', error);
            throw error;
        }
    }

    // Logout
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        window.location.href = '/admin/login';
    }

    // Token management
    setToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    // User management
    setUser(user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    getUser() {
        const user = localStorage.getItem(this.userKey);
        return user ? JSON.parse(user) : null;
    }

    // Authentication checks
    isLoggedIn() {
        const token = this.getToken();
        const user = this.getUser();
        return !!(token && user);
    }

    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    }

    // Get admin movies (with full access)
    async getMovies() {
        const query = `
            query GetAdminMovies {
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

        try {
            const result = await this.graphqlRequest(query);
            return result.data.movies || [];
        } catch (error) {
            console.error('Error fetching admin movies:', error);
            throw error;
        }
    }

    // Get admin cinemas (with full access)
    async getCinemas() {
        const query = `
            query GetAdminCinemas {
                cinemas {
                    id
                    name
                    city
                    capacity
                    auditoriums {
                        id
                        name
                        seat_layout
                    }
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(query);
            return result.data.cinemas || [];
        } catch (error) {
            console.error('Error fetching admin cinemas:', error);
            throw error;
        }
    }

        // Tambahkan method ini ke AdminAuthService class
    
    // Delete cinema
    async deleteCinema(id) {
        const mutation = `
            mutation DeleteCinema($id: Int!) {
                deleteCinema(id: $id) {
                    success
                    message
                }
            }
        `;
    
        try {
            const result = await this.graphqlRequest(mutation, { id });
            return result.data.deleteCinema;
        } catch (error) {
            console.error('Error deleting cinema:', error);
            throw error;
        }
    }
    
    // Update cinema
    async updateCinema(id, cinemaData) {
        const mutation = `
            mutation UpdateCinema(
                $id: Int!
                $name: String
                $city: String
                $capacity: Int
            ) {
                updateCinema(
                    id: $id
                    name: $name
                    city: $city
                    capacity: $capacity
                ) {
                    cinema {
                        id
                        name
                        city
                        capacity
                    }
                    success
                    message
                }
            }
        `;
    
        try {
            const result = await this.graphqlRequest(mutation, { id, ...cinemaData });
            return result.data.updateCinema;
        } catch (error) {
            console.error('Error updating cinema:', error);
            throw error;
        }
    }
    
    // Update booking status
    async updateBookingStatus(bookingId, status) {
        const mutation = `
            mutation UpdateBooking(
                $id: Int!
                $status: String!
            ) {
                updateBooking(
                    id: $id
                    status: $status
                ) {
                    booking {
                        id
                        status
                    }
                    success
                    message
                }
            }
        `;
    
        try {
            const result = await this.graphqlRequest(mutation, { 
                id: bookingId, 
                status: status 
            });
            return result.data.updateBooking;
        } catch (error) {
            console.error('Error updating booking:', error);
            throw error;
        }
    }

    // Get admin users
    async getUsers() {
        const query = `
            query GetUsers {
                users {
                    id
                    username
                    email
                    role
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(query);
            return result.data.users || [];
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    // Get admin bookings
    async getBookings() {
        const query = `
            query GetAllBookings {
                allBookings {
                    id
                    user_id
                    movie_id
                    auditorium_id
                    showtime_id
                    seat_numbers
                    total_price
                    status
                    booking_time
                    movie {
                        title
                    }
                    auditorium {
                        name
                        cinema {
                            name
                        }
                    }
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(query);
            return result.data.allBookings || [];
        } catch (error) {
            console.error('Error fetching bookings:', error);
            throw error;
        }
    }

    // Create movie
    async createMovie(movieData) {
        const mutation = `
            mutation CreateMovie(
                $title: String!
                $genre: String!
                $duration: Int!
                $description: String
                $releaseDate: String
                $posterUrl: String
                $rating: Float
            ) {
                createMovie(
                    title: $title
                    genre: $genre
                    duration: $duration
                    description: $description
                    releaseDate: $releaseDate
                    posterUrl: $posterUrl
                    rating: $rating
                ) {
                    movie {
                        id
                        title
                        genre
                        duration
                        description
                        releaseDate
                        posterUrl
                        rating
                    }
                    success
                    message
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(mutation, movieData);
            return result.data.createMovie;
        } catch (error) {
            console.error('Error creating movie:', error);
            throw error;
        }
    }

    // Update movie
    async updateMovie(id, movieData) {
        const mutation = `
            mutation UpdateMovie(
                $id: Int!
                $title: String
                $genre: String
                $duration: Int
                $description: String
                $releaseDate: String
                $posterUrl: String
                $rating: Float
            ) {
                updateMovie(
                    id: $id
                    title: $title
                    genre: $genre
                    duration: $duration
                    description: $description
                    releaseDate: $releaseDate
                    posterUrl: $posterUrl
                    rating: $rating
                ) {
                    movie {
                        id
                        title
                        genre
                        duration
                        description
                        releaseDate
                        posterUrl
                        rating
                    }
                    success
                    message
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(mutation, { id, ...movieData });
            return result.data.updateMovie;
        } catch (error) {
            console.error('Error updating movie:', error);
            throw error;
        }
    }

    // Delete movie
    async deleteMovie(id) {
        const mutation = `
            mutation DeleteMovie($id: Int!) {
                deleteMovie(id: $id) {
                    success
                    message
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(mutation, { id });
            return result.data.deleteMovie;
        } catch (error) {
            console.error('Error deleting movie:', error);
            throw error;
        }
    }

    // Create cinema
    async createCinema(cinemaData) {
        const mutation = `
            mutation CreateCinema(
                $name: String!
                $city: String!
                $capacity: Int!
            ) {
                createCinema(
                    name: $name
                    city: $city
                    capacity: $capacity
                ) {
                    cinema {
                        id
                        name
                        city
                        capacity
                    }
                    success
                    message
                }
            }
        `;

        try {
            const result = await this.graphqlRequest(mutation, cinemaData);
            return result.data.createCinema;
        } catch (error) {
            console.error('Error creating cinema:', error);
            throw error;
        }
    }

    // Show admin message
    showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        // Add to page
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove after hide
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
}

// Initialize admin auth service
const AdminAuth = new AdminAuthService();

// Global functions
window.logout = () => AdminAuth.logout();

// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const closeBtn = document.getElementById('closeSidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('show');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !toggleBtn?.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });

    // Update admin name in UI
    const user = AdminAuth.getUser();
    if (user) {
        const adminNameElements = document.querySelectorAll('.admin-name');
        adminNameElements.forEach(el => {
            el.textContent = user.username || 'Admin';
        });
    }
});