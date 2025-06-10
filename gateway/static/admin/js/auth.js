// Tambahkan method ini ke object AdminAuth yang sudah ada

const AdminAuth = {
    // ... existing methods ...

    // Cinema CRUD operations
    async getCinemas() {
        const query = `
            query GetCinemas {
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
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.cinemas) {
            return result.data.cinemas;
        }
        throw new Error('Failed to fetch cinemas');
    },

    async createCinema(cinemaData) {
        const mutation = `
            mutation CreateCinema($name: String!, $city: String!, $capacity: Int!) {
                createCinema(name: $name, city: $city, capacity: $capacity) {
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
        
        const result = await this.graphqlRequest(mutation, cinemaData, true);
        if (result && result.data && result.data.createCinema) {
            if (result.data.createCinema.success) {
                return { success: true, data: result.data.createCinema.cinema };
            } else {
                throw new Error(result.data.createCinema.message);
            }
        }
        throw new Error('Failed to create cinema');
    },

    async updateCinema(cinemaId, cinemaData) {
        const mutation = `
            mutation UpdateCinema($id: Int!, $name: String, $city: String, $capacity: Int) {
                updateCinema(id: $id, name: $name, city: $city, capacity: $capacity) {
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
        
        const variables = { id: cinemaId, ...cinemaData };
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.updateCinema) {
            if (result.data.updateCinema.success) {
                return { success: true, data: result.data.updateCinema.cinema };
            } else {
                throw new Error(result.data.updateCinema.message);
            }
        }
        throw new Error('Failed to update cinema');
    },

    async deleteCinema(cinemaId) {
        const mutation = `
            mutation DeleteCinema($id: Int!) {
                deleteCinema(id: $id) {
                    success
                    message
                }
            }
        `;
        
        const result = await this.graphqlRequest(mutation, { id: cinemaId }, true);
        if (result && result.data && result.data.deleteCinema) {
            if (result.data.deleteCinema.success) {
                return { success: true };
            } else {
                throw new Error(result.data.deleteCinema.message);
            }
        }
        throw new Error('Failed to delete cinema');
    },

    // Logout function for admin
    logout() {
        try {
            console.log('Admin logout initiated...');
            
            // Clear all authentication data
            localStorage.removeItem('cinema_auth_token');
            localStorage.removeItem('cinema_user_data');
            localStorage.removeItem('admin_session');
            localStorage.removeItem('rememberMe');
            
            // Clear any session storage
            sessionStorage.clear();
            
            // Show logout message
            this.showMessage('Logged out successfully', 'success');
            
            // Redirect to admin login page after a brief delay
            setTimeout(() => {
                window.location.href = '/admin/login';
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if there's an error
            window.location.href = '/admin/login';
        }
    },

    // Check if user is logged in
    isLoggedIn() {
        const token = localStorage.getItem('cinema_auth_token');
        const userData = localStorage.getItem('cinema_user_data');
        return !!(token && userData);
    },

    // Check if current user is admin
    isAdmin() {
        try {
            const userData = localStorage.getItem('cinema_user_data');
            if (userData) {
                const user = JSON.parse(userData);
                return user.role === 'ADMIN';
            }
            return false;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    },

    // Get current user data
    getCurrentUser() {
        try {
            const userData = localStorage.getItem('cinema_user_data');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    // Admin login function
    async login(email, password) {
        const query = `
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
            const result = await this.graphqlRequest(query, { email, password });
            
            if (result && result.data && result.data.login) {
                const loginData = result.data.login;
                
                if (loginData.success && loginData.user.role === 'ADMIN') {
                    // Store auth data
                    localStorage.setItem('cinema_auth_token', loginData.token);
                    localStorage.setItem('cinema_user_data', JSON.stringify(loginData.user));
                    localStorage.setItem('admin_session', 'true');
                    
                    return loginData;
                } else if (loginData.user.role !== 'ADMIN') {
                    throw new Error('Access denied. Admin privileges required.');
                } else {
                    throw new Error(loginData.message || 'Login failed');
                }
            }
            
            throw new Error('Invalid response from server');
            
        } catch (error) {
            console.error('Admin login error:', error);
            throw error;
        }
    },

    // Get all users (admin only)
    async getUsers() {
        const query = `
            query GetAllUsers {
                users {
                    id
                    username
                    email
                    role
                    createdAt
                }
            }
        `;
        
        try {
            const result = await this.graphqlRequest(query, {}, true);
            if (result && result.data && result.data.users) {
                return result.data.users;
            }
            throw new Error('No users data received');
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    },

    // Helper method untuk GraphQL requests
    async graphqlRequest(query, variables = {}, requireAuth = false) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (requireAuth) {
            const token = localStorage.getItem('cinema_auth_token');
            if (!token) {
                throw new Error('Authentication required');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch('/graphql', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                throw new Error(result.errors[0].message);
            }

            return result;
        } catch (error) {
            console.error('GraphQL request failed:', error);
            throw error;
        }
    },

    // Show message helper
    showMessage(message, type = 'info') {
        // Create or update message element
        let messageElement = document.getElementById('admin-message');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'admin-message';
            messageElement.className = 'alert alert-dismissible fade show position-fixed';
            messageElement.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
            document.body.appendChild(messageElement);
        }

        // Map type to Bootstrap classes
        const typeClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';

        messageElement.className = `alert ${typeClass} alert-dismissible fade show position-fixed`;
        messageElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Auto hide after 5 seconds
        setTimeout(() => {
            if (messageElement && messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }
};

// Make logout function available globally
window.logout = function() {
    AdminAuth.logout();
};

// Also make AdminAuth available globally
window.AdminAuth = AdminAuth;

console.log('Admin authentication module loaded');