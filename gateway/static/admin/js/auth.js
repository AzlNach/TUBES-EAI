// Tambahkan method ini ke object AdminAuth yang sudah ada

const AdminAuth = {
    // ...existing methods...

    // ✅ FIXED: Use seatLayout instead of seat_layout
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
                        seatLayout
                    }
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.cinemas) {
            // Transform camelCase response to snake_case for frontend compatibility
            const cinemas = result.data.cinemas.map(cinema => ({
                ...cinema,
                auditoriums: cinema.auditoriums ? cinema.auditoriums.map(auditorium => ({
                    id: auditorium.id,
                    name: auditorium.name,
                    seat_layout: auditorium.seatLayout  // Transform to snake_case
                })) : []
            }));
            return cinemas;
        }
        throw new Error('Failed to fetch cinemas');
    },

    async createCinema(cinemaData) {
        const mutation = `
            mutation CreateCinema($name: String!, $city: String!, $capacity: Int!) {
                createCinema(name: $name, city: $city, capacity: $capacity) {
                    success
                    message
                    cinema {
                        id
                        name
                        city
                        capacity
                    }
                }
            }
        `;
        
        const result = await this.graphqlRequest(mutation, cinemaData, true);
        if (result && result.data && result.data.createCinema) {
            return result.data.createCinema;
        }
        throw new Error('Failed to create cinema');
    },

    async updateCinema(cinemaId, cinemaData) {
        const mutation = `
            mutation UpdateCinema($id: Int!, $name: String!, $city: String!, $capacity: Int!) {
                updateCinema(id: $id, name: $name, city: $city, capacity: $capacity) {
                    success
                    message
                    cinema {
                        id
                        name
                        city
                        capacity
                    }
                }
            }
        `;
        
        const variables = { id: cinemaId, ...cinemaData };
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.updateCinema) {
            return result.data.updateCinema;
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
            return result.data.deleteCinema;
        }
        throw new Error('Failed to delete cinema');
    },

    // ✅ FIXED: Transform seat_layout string to JSON object before sending
    async createAuditorium(auditoriumData) {
        const mutation = `
            mutation CreateAuditorium($cinemaId: Int!, $name: String!, $seatLayout: JSONString!) {
                createAuditorium(cinemaId: $cinemaId, name: $name, seatLayout: $seatLayout) {
                    success
                    message
                    auditorium {
                        id
                        cinemaId
                        name
                        seatLayout
                        cinema {
                            id
                            name
                            city
                        }
                    }
                }
            }
        `;
        
        // ✅ FIXED: Convert seat_layout string to proper JSON format
        let seatLayoutValue = auditoriumData.seat_layout;
        
        if (typeof seatLayoutValue === 'string') {
            // Convert string to JSON object that backend expects
            const layoutConfig = {
                "Standard": { rows: 10, seats_per_row: 10 },
                "Premium": { rows: 8, seats_per_row: 12 },
                "VIP": { rows: 6, seats_per_row: 8 },
                "IMAX": { rows: 12, seats_per_row: 15 }
            };
            
            const config = layoutConfig[seatLayoutValue] || layoutConfig["Standard"];
            
            const seatLayoutJson = {
                layout_type: seatLayoutValue,
                rows: config.rows,
                seats_per_row: config.seats_per_row,
                seats: []
            };
            
            // Generate seat numbers
            for (let row = 0; row < config.rows; row++) {
                const rowLetter = String.fromCharCode(65 + row); // A, B, C, etc.
                for (let seat = 1; seat <= config.seats_per_row; seat++) {
                    seatLayoutJson.seats.push(`${rowLetter}${seat}`);
                }
            }
            
            seatLayoutValue = JSON.stringify(seatLayoutJson);
        }
        
        const variables = {
            cinemaId: parseInt(auditoriumData.cinema_id),
            name: auditoriumData.name.trim(),
            seatLayout: seatLayoutValue
        };
        
        console.log('Creating auditorium with variables:', variables);
        
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.createAuditorium) {
            return result.data.createAuditorium;
        }
        throw new Error('Failed to create auditorium');
    },

    // ✅ FIXED: Update auditorium with same logic
    async updateAuditorium(auditoriumId, auditoriumData) {
        const mutation = `
            mutation UpdateAuditorium($id: Int!, $cinemaId: Int, $name: String, $seatLayout: JSONString) {
                updateAuditorium(id: $id, cinemaId: $cinemaId, name: $name, seatLayout: $seatLayout) {
                    success
                    message
                    auditorium {
                        id
                        cinemaId
                        name
                        seatLayout
                        cinema {
                            id
                            name
                            city
                        }
                    }
                }
            }
        `;

        // ✅ FIXED: Convert seat_layout string to proper JSON format
        let seatLayoutValue = auditoriumData.seat_layout;
        
        if (typeof seatLayoutValue === 'string') {
            const layoutConfig = {
                "Standard": { rows: 10, seats_per_row: 10 },
                "Premium": { rows: 8, seats_per_row: 12 },
                "VIP": { rows: 6, seats_per_row: 8 },
                "IMAX": { rows: 12, seats_per_row: 15 }
            };
            
            const config = layoutConfig[seatLayoutValue] || layoutConfig["Standard"];
            
            const seatLayoutJson = {
                layout_type: seatLayoutValue,
                rows: config.rows,
                seats_per_row: config.seats_per_row,
                seats: []
            };
            
            // Generate seat numbers
            for (let row = 0; row < config.rows; row++) {
                const rowLetter = String.fromCharCode(65 + row);
                for (let seat = 1; seat <= config.seats_per_row; seat++) {
                    seatLayoutJson.seats.push(`${rowLetter}${seat}`);
                }
            }
            
            seatLayoutValue = JSON.stringify(seatLayoutJson);
        }
        
        const variables = {
            id: auditoriumId,
            cinemaId: auditoriumData.cinema_id,
            name: auditoriumData.name,
            seatLayout: seatLayoutValue
        };
        
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.updateAuditorium) {
            return result.data.updateAuditorium;
        }
        throw new Error('Failed to update auditorium');
    },

    async deleteAuditorium(auditoriumId) {
        const mutation = `
            mutation DeleteAuditorium($id: Int!) {
                deleteAuditorium(id: $id) {
                    success
                    message
                }
            }
        `;
        
        const result = await this.graphqlRequest(mutation, { id: auditoriumId }, true);
        if (result && result.data && result.data.deleteAuditorium) {
            return result.data.deleteAuditorium;
        }
        throw new Error('Failed to delete auditorium');
    },

    // ✅ FIXED: Use camelCase for GraphQL mutations
    async createShowtime(showtimeData) {
        const mutation = `
            mutation CreateShowtime($movieId: Int!, $auditoriumId: Int!, $startTime: String!, $price: Float!) {
                createShowtime(movieId: $movieId, auditoriumId: $auditoriumId, startTime: $startTime, price: $price) {
                    success
                    message
                    showtime {
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
            }
        `;
        
        // ✅ FIXED: Convert snake_case to camelCase for GraphQL
        const variables = {
            movieId: showtimeData.movie_id,
            auditoriumId: showtimeData.auditorium_id,
            startTime: showtimeData.start_time,
            price: showtimeData.price
        };
        
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.createShowtime) {
            return result.data.createShowtime;
        }
        throw new Error('Failed to create showtime');
    },

    async updateShowtime(showtimeId, showtimeData) {
        const mutation = `
            mutation UpdateShowtime($id: Int!, $movieId: Int, $auditoriumId: Int, $startTime: String, $price: Float) {
                updateShowtime(id: $id, movieId: $movieId, auditoriumId: $auditoriumId, startTime: $startTime, price: $price) {
                    success
                    message
                    showtime {
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
            }
        `;
        
        // ✅ FIXED: Convert snake_case to camelCase for GraphQL
        const variables = {
            id: showtimeId,
            movieId: showtimeData.movie_id,
            auditoriumId: showtimeData.auditorium_id,
            startTime: showtimeData.start_time,
            price: showtimeData.price
        };
        
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.updateShowtime) {
            return result.data.updateShowtime;
        }
        throw new Error('Failed to update showtime');
    },

    async deleteShowtime(showtimeId) {
        const mutation = `
            mutation DeleteShowtime($id: Int!) {
                deleteShowtime(id: $id) {
                    success
                    message
                }
            }
        `;
        
        const result = await this.graphqlRequest(mutation, { id: showtimeId }, true);
        if (result && result.data && result.data.deleteShowtime) {
            return result.data.deleteShowtime;
        }
        throw new Error('Failed to delete showtime');
    },

    // Get movies for showtime creation
    async getMovies() {
        const query = `
            query GetMovies {
                movies {
                    id
                    title
                    genre
                    duration
                    description
                    releaseDate
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.movies) {
            return result.data.movies;
        }
        throw new Error('Failed to fetch movies');
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

    // ✅ FIX: Use correct query parameter name
    async getAuditoriums(cinemaId = null) {
        const query = cinemaId ? `
            query GetAuditoriumsByCinema($cinemaId: Int!) {
                auditoriums(cinemaId: $cinemaId) {
                    id
                    cinemaId
                    name
                    seatLayout
                    cinema {
                        id
                        name
                        city
                    }
                }
            }
        ` : `
            query GetAllAuditoriums {
                auditoriums {
                    id
                    cinemaId
                    name
                    seatLayout
                    cinema {
                        id
                        name
                        city
                    }
                }
            }
        `;
        
        const variables = cinemaId ? { cinemaId } : {};
        const result = await this.graphqlRequest(query, variables, true);
        
        if (result && result.data) {
            const auditoriums = result.data.auditoriums || [];
            // ✅ TRANSFORM: Convert camelCase response to snake_case for frontend compatibility
            return auditoriums.map(auditorium => ({
                id: auditorium.id,
                cinema_id: auditorium.cinemaId,  // Transform to snake_case
                name: auditorium.name,
                seat_layout: auditorium.seatLayout,  // Transform to snake_case
                cinema: auditorium.cinema
            }));
        }
        throw new Error('Failed to fetch auditoriums');
    },

    // ✅ FIX: Use seatLayout instead of seat_layout
    async getShowtimes(movieId = null, auditoriumId = null) {
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
                        description
                        releaseDate
                        posterUrl
                        rating
                    }
                    auditorium {
                        id
                        name
                        seatLayout
                        cinema {
                            id
                            name
                            city
                        }
                    }
                }
            }
        `;
        
        const variables = {};
        if (movieId) variables.movieId = movieId;
        if (auditoriumId) variables.auditoriumId = auditoriumId;
        
        const result = await this.graphqlRequest(query, variables, true);
        
        if (result && result.data && result.data.showtimes) {
            // Transform camelCase response to snake_case for frontend compatibility
            return result.data.showtimes.map(showtime => ({
                id: showtime.id,
                movie_id: showtime.movieId,
                auditorium_id: showtime.auditoriumId,
                start_time: showtime.startTime,
                price: showtime.price,
                movie: showtime.movie,
                auditorium: {
                    ...showtime.auditorium,
                    seat_layout: showtime.auditorium.seatLayout
                }
            }));
        }
        throw new Error('Failed to fetch showtimes');
    },

    // Get all payments (admin only)
    async getPayments() {
        const query = `
            query GetAllPayments {
                allPayments {
                    id
                    userId
                    bookingId
                    amount
                    paymentMethod
                    status
                    createdAt
                    updatedAt
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.allPayments) {
            return result.data.allPayments;
        }
        throw new Error('Failed to fetch payments');
    },

    // Get all bookings (admin only)
    async getBookings() {
        const query = `
            query GetAllBookings {
                allBookings {
                    id
                    userId
                    showtimeId
                    status
                    totalPrice
                    bookingDate
                    seatNumbers
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.allBookings) {
            return result.data.allBookings;
        }
        throw new Error('Failed to fetch bookings');
    },

    // Get payment statistics (admin only)
    async getPaymentStats() {
        const query = `
            query GetPaymentStats {
                paymentStats {
                    totalPayments
                    totalAmount
                    paidCount
                    pendingCount
                    cancelledCount
                    todayPayments
                    thisMonthPayments
                    averageAmount
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.paymentStats) {
            return result.data.paymentStats;
        }
        throw new Error('Failed to fetch payment statistics');
    },

    // Get booking statistics (admin only)
    async getBookingStats() {
        const query = `
            query GetBookingStats {
                bookingStats {
                    totalBookings
                    confirmedCount
                    pendingCount
                    cancelledCount
                    todayBookings
                    thisMonthBookings
                    totalRevenue
                    averageBookingValue
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.bookingStats) {
            return result.data.bookingStats;
        }
        throw new Error('Failed to fetch booking statistics');
    },

    // Get specific payment by ID (admin only)
    async getPayment(paymentId) {
        const query = `
            query GetPayment($id: Int!) {
                payment(id: $id) {
                    id
                    bookingId
                    amount
                    paymentMethod
                    status
                    createdAt
                    updatedAt
                    paymentProofImage
                    booking {
                        id
                        userId
                        showtimeId
                        status
                        totalPrice
                        bookingDate
                        seatNumbers
                        user {
                            id
                            username
                            email
                        }
                        showtime {
                            id
                            startTime
                            price
                            movie {
                                id
                                title
                                genre
                                duration
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
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, { id: paymentId }, true);
        if (result && result.data && result.data.payment) {
            return result.data.payment;
        }
        throw new Error('Failed to fetch payment');
    },

    // Get specific booking by ID (admin only)
    async getBooking(bookingId) {
        const query = `
            query GetBooking($id: Int!) {
                booking(id: $id) {
                    id
                    userId
                    showtimeId
                    status
                    totalPrice
                    bookingDate
                    seatNumbers
                    user {
                        id
                        username
                        email
                        role
                    }
                    showtime {
                        id
                        startTime
                        price
                        movie {
                            id
                            title
                            genre
                            duration
                            description
                            posterUrl
                            rating
                        }
                        auditorium {
                            id
                            name
                            seatLayout
                            cinema {
                                id
                                name
                                city
                                capacity
                            }
                        }
                    }
                    payments {
                        id
                        amount
                        paymentMethod
                        status
                        createdAt
                        paymentProofImage
                    }
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, { id: bookingId }, true);
        if (result && result.data && result.data.booking) {
            return result.data.booking;
        }
        throw new Error('Failed to fetch booking');
    },

    // ✅ TAMBAHKAN: Coupon management methods
    async getCoupons() {
        const query = `
            query GetAllCoupons {
                coupons {
                    id
                    code
                    name
                    discountPercentage
                    validUntil
                    isActive
                    stock
                    createdAt
                    updatedAt
                }
            }
        `;
        
        const result = await this.graphqlRequest(query, {}, true);
        if (result && result.data && result.data.coupons) {
            return result.data.coupons;
        }
        throw new Error('Failed to fetch coupons');
    },

    // ✅ FIX: Update createCoupon method - hapus usedCount dari response
    async createCoupon(couponData) {
        const mutation = `
            mutation CreateCoupon($code: String!, $name: String!, $discount_percentage: Float!, $valid_until: String!, $stock: Int!) {
                createCoupon(code: $code, name: $name, discountPercentage: $discount_percentage, validUntil: $valid_until, stock: $stock) {
                    success
                    message
                    coupon {
                        id
                        code
                        name
                        discountPercentage
                        validUntil
                        isActive
                        stock
                        createdAt
                        updatedAt
                    }
                }
            }
        `;
        
        const variables = {
            code: couponData.code,
            name: couponData.name,
            discount_percentage: couponData.discount_percentage,
            valid_until: couponData.valid_until,
            stock: couponData.stock
        };
        
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.createCoupon) {
            return result.data.createCoupon;
        }
        throw new Error('Failed to create coupon');
    },

    async updateCoupon(couponId, couponData) {
        const mutation = `
            mutation UpdateCoupon($id: Int!, $code: String, $name: String, $discount_percentage: Float, $valid_until: String, $stock: Int, $is_active: Boolean) {
                updateCoupon(id: $id, code: $code, name: $name, discountPercentage: $discount_percentage, validUntil: $valid_until, stock: $stock, isActive: $is_active) {
                    success
                    message
                    coupon {
                        id
                        code
                        name
                        discountPercentage
                        validUntil
                        isActive
                        stock
                        createdAt
                        updatedAt
                    }
                }
            }
        `;
        
        const variables = {
            id: couponId,
            ...couponData
        };
        
        const result = await this.graphqlRequest(mutation, variables, true);
        if (result && result.data && result.data.updateCoupon) {
            return result.data.updateCoupon;
        }
        throw new Error('Failed to update coupon');
    },

    async deleteCoupon(couponId) {
        const mutation = `
            mutation DeleteCoupon($id: Int!) {
                deleteCoupon(id: $id) {
                    success
                    message
                }
            }
        `;
        
        const result = await this.graphqlRequest(mutation, { id: couponId }, true);
        if (result && result.data && result.data.deleteCoupon) {
            return result.data.deleteCoupon;
        }
        throw new Error('Failed to delete coupon');
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

            const responseText = await response.text();
            
            // ✅ FIX: Better empty response handling
            if (!responseText || responseText.trim() === '') {
                throw new Error(`Server returned empty response. Status: ${response.status}`);
            }

            // ✅ FIX: Check if response is HTML (error page)
            if (responseText.trim().startsWith('<')) {
                throw new Error(`Server error (${response.status}). Please check if all services are running.`);
            }

            // ✅ FIX: Handle non-200 status codes
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}. ${responseText.substring(0, 100)}`);
            }

            // ✅ FIX: Safe JSON parsing
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error(`Invalid response format. Please check server logs.`);
            }
            
            // ✅ FIX: Handle GraphQL errors
            if (result.errors && result.errors.length > 0) {
                const errorMessages = result.errors.map(error => error.message || 'Unknown error').join('; ');
                throw new Error(`GraphQL error: ${errorMessages}`);
            }

            return result;
        } catch (error) {
            // ✅ FIX: Simplified error handling
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Cannot connect to server. Please check if the server is running.');
            }
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
    },

    // ✅ TAMBAH: Check if required services are running
    async checkServiceHealth() {
        try {
            console.log('=== CHECKING SERVICE HEALTH ===');
            
            // Test basic server connectivity
            const healthResponse = await fetch('/health', { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('Health check status:', healthResponse.status);
            
            // Test GraphQL endpoint basic response
            const graphqlTest = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: '{ __typename }',
                    variables: {}
                })
            });
            
            console.log('GraphQL basic test status:', graphqlTest.status);
            
            return graphqlTest.status === 200;
        } catch (error) {
            console.error('Service health check failed:', error);
            return false;
        }
    },

    // ✅ TAMBAHKAN: Check AdminAuth methods availability
    checkAdminAuthMethods() {
        console.log('=== CHECKING ADMINAUTH METHODS ===');
        
        const requiredMethods = [
            'getCinemas', 'createCinema', 'updateCinema', 'deleteCinema',
            'getAuditoriums', 'createAuditorium', 'updateAuditorium', 'deleteAuditorium',
            'getShowtimes', 'createShowtime', 'updateShowtime', 'deleteShowtime',
            'getMovies', 'createMovie', 'updateMovie', 'deleteMovie',
            'getCoupons', 'createCoupon', 'updateCoupon', 'deleteCoupon',
            'getUsers', 'getBookings', 'getPayments'
        ];
        
        const missingMethods = [];
        
        requiredMethods.forEach(method => {
            if (typeof this[method] !== 'function') {
                missingMethods.push(method);
                console.error(`❌ Missing method: AdminAuth.${method}`);
            } else {
                console.log(`✅ Available method: AdminAuth.${method}`);
            }
        });
        
        if (missingMethods.length > 0) {
            console.error('❌ Missing AdminAuth methods:', missingMethods);
            return false;
        }
        
        console.log('✅ All AdminAuth methods are available');
        return true;
    },

    // ✅ PERBAIKI: Load all data dengan health check
    async loadAllData() {
        try {
            console.log('=== LOAD ALL DATA START ===');
            
            // Check service health first
            const servicesHealthy = await this.checkServiceHealth();
            if (!servicesHealthy) {
                throw new Error('Backend services are not responding properly');
            }
            
            // Check if all required methods exist
            if (!this.checkAdminAuthMethods()) {
                throw new Error('Required AdminAuth methods are missing');
            }
            
            await Promise.all([
                this.loadCinemas(),
                this.loadMovies()
            ]);
            
            this.populateFilters();
            console.log('✅ All initial data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            this.showErrorMessage(`Failed to load initial data: ${error.message}. Please check if the server is running and try refreshing the page.`);
        }
    }
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== ADMIN AUTH PAGE INITIALIZATION ===');
    
    // ✅ Check which page we're on
    const currentPath = window.location.pathname;
    console.log('Current path:', currentPath);
    
    // ✅ Only run cinemas initialization if we're on cinemas page
    if (currentPath.includes('/admin/cinemas')) {
        console.log('=== ADMIN CINEMAS PAGE INITIALIZATION ===');
        initializeCinemasPage();
    } else if (currentPath.includes('/admin/coupons')) {
        console.log('=== ADMIN COUPONS PAGE INITIALIZATION ===');
        // Coupon page initialization is handled by coupons.js
    } else if (currentPath.includes('/admin/movies')) {
        console.log('=== ADMIN MOVIES PAGE INITIALIZATION ===');
        // Movies page initialization is handled by movies.js
    }
    
    // ✅ Common initialization for all admin pages
    if (currentPath.includes('/admin') && !currentPath.includes('/admin/login')) {
        // Check admin authentication
        if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
            console.error('❌ Admin authentication failed');
            window.location.href = '/admin/login';
            return;
        }
        console.log('✅ Admin authentication passed');
    }
});

// ✅ FIX: Separate cinemas initialization function
function initializeCinemasPage() {
    try {
        if (typeof cacheElements === 'function') {
            cacheElements();
        }
        if (typeof setupEventListeners === 'function') {
            setupEventListeners();
        }
        
        // Add delay before loading data
        setTimeout(async () => {
            try {
                if (typeof loadAllData === 'function') {
                    await loadAllData();
                }
            } catch (error) {
                console.error('❌ Failed to load cinemas data:', error);
            }
        }, 200);
        
        console.log('✅ Cinemas page initialization completed');
    } catch (error) {
        console.error('❌ Error during cinemas initialization:', error);
    }
}

// Make logout function available globally
window.logout = function() {
    AdminAuth.logout();
};

// Also make AdminAuth available globally
window.AdminAuth = AdminAuth;

// ✅ TAMBAH: Debug commands for console
window.debugAdmin = {
    testConnection: testServerConnection,
    checkHealth: checkServiceHealth,
    testGraphQL: () => AdminAuth.graphqlRequest('{ __typename }', {}, true),
    testAuth: () => console.log('Token:', localStorage.getItem('cinema_auth_token')),
    clearAuth: () => {
        localStorage.removeItem('cinema_auth_token');
        localStorage.removeItem('cinema_user_data');
        localStorage.removeItem('admin_session');
    },
    reloadData: loadAllData
};

console.log('Admin authentication module loaded');
console.log('🔧 Debug commands available: window.debugAdmin');

// ✅ FIX: Comment out atau hapus baris yang memanggil testServerConnection dan ganti dengan:

// Ganti baris ini:
// await testServerConnection();

// Dengan:
console.log('Skipping server connection test for now');

// ✅ ATAU tambahkan function dummy testServerConnection
async function testServerConnection() {
    console.log('Server connection test - placeholder');
    return true;
}

// ✅ FIX: Tambahkan editCurrentCoupon function yang hilang
function editCurrentCoupon() {
    console.log('📝 Edit current coupon triggered');
    
    const couponId = elements.editCouponBtn?.dataset?.couponId;
    if (couponId) {
        // Close detail modal first
        const detailModal = bootstrap.Modal.getInstance(elements.couponDetailModal);
        if (detailModal) {
            detailModal.hide();
        }
        
        // Open edit modal
        editCoupon(parseInt(couponId));
    } else {
        showErrorMessage('No coupon selected for editing');
    }
}

// ✅ FIX: Update viewCoupon function untuk handle usedCount dengan fallback
function viewCoupon(couponId) {
    console.log('👁️ Viewing coupon:', couponId);
    
    const coupon = allCoupons.find(c => c.id === couponId);
    if (!coupon) {
        showErrorMessage('Coupon not found!');
        return;
    }
    
    const modal = new bootstrap.Modal(elements.couponDetailModal);
    
    // ✅ FIX: Handle usedCount dengan fallback ke 0
    const usedCount = coupon.usedCount || 0;
    const remainingStock = Math.max(0, coupon.stock - usedCount);
    const expiryDate = coupon.validUntil ? new Date(coupon.validUntil).toLocaleString() : 'No expiry';
    
    elements.couponDetailContent.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Coupon Information</h6>
                <table class="table table-sm">
                    <tr><td><strong>Code:</strong></td><td><span class="coupon-code-badge">${coupon.code}</span></td></tr>
                    <tr><td><strong>Name:</strong></td><td>${coupon.name}</td></tr>
                    <tr><td><strong>Discount:</strong></td><td><span class="discount-badge">${coupon.discountPercentage}%</span></td></tr>
                    <tr><td><strong>Status:</strong></td><td><span class="badge bg-${coupon.isActive ? 'success' : 'secondary'}">${coupon.isActive ? 'Active' : 'Inactive'}</span></td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Usage Statistics</h6>
                <table class="table table-sm">
                    <tr><td><strong>Total Stock:</strong></td><td>${coupon.stock}</td></tr>
                    <tr><td><strong>Used:</strong></td><td>${usedCount}</td></tr>
                    <tr><td><strong>Remaining:</strong></td><td>${remainingStock}</td></tr>
                    <tr><td><strong>Valid Until:</strong></td><td>${expiryDate}</td></tr>
                    <tr><td><strong>Created:</strong></td><td>${coupon.createdAt ? new Date(coupon.createdAt).toLocaleString() : 'N/A'}</td></tr>
                    <tr><td><strong>Updated:</strong></td><td>${coupon.updatedAt ? new Date(coupon.updatedAt).toLocaleString() : 'N/A'}</td></tr>
                </table>
            </div>
        </div>
        
        <div class="mt-3">
            <h6>Coupon Preview</h6>
            <div class="coupon-preview-large">
                <div class="d-flex justify-content-between align-items-center p-3 border rounded" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div>
                        <h4 class="mb-0">${coupon.code}</h4>
                        <p class="mb-0 opacity-75">${coupon.name}</p>
                    </div>
                    <div class="text-end">
                        <h2 class="mb-0">${coupon.discountPercentage}%</h2>
                        <small class="opacity-75">OFF</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // ✅ FIX: Set dataset for action buttons
    if (elements.toggleCouponStatusBtn) {
        elements.toggleCouponStatusBtn.dataset.couponId = coupon.id;
        elements.toggleCouponStatusBtn.innerHTML = `
            <i class="fas fa-${coupon.isActive ? 'ban' : 'check'} me-2"></i>
            ${coupon.isActive ? 'Deactivate' : 'Activate'}
        `;
    }
    
    if (elements.editCouponBtn) {
        elements.editCouponBtn.dataset.couponId = coupon.id;
    }
    
    modal.show();
}

// ✅ FIX: Update createCouponRow function untuk handle usedCount
function createCouponRow(coupon) {
    const row = document.createElement('tr');
    
    const validUntil = coupon.validUntil ? 
        new Date(coupon.validUntil).toLocaleDateString() : 'No expiry';
    
    const statusClass = coupon.isActive ? 'success' : 'secondary';
    const statusText = coupon.isActive ? 'Active' : 'Inactive';
    
    // ✅ FIX: Handle usedCount dengan fallback
    const usedCount = coupon.usedCount || 0;
    const remainingStock = Math.max(0, coupon.stock - usedCount);
    const stockClass = remainingStock > 10 ? 'success' : remainingStock > 0 ? 'warning' : 'danger';
    
    row.innerHTML = `
        <td>
            <input type="checkbox" class="coupon-checkbox" value="${coupon.id}">
        </td>
        <td>
            <span class="coupon-code-badge">${coupon.code}</span>
        </td>
        <td>${coupon.name}</td>
        <td>
            <span class="discount-badge">${coupon.discountPercentage}%</span>
        </td>
        <td>
            <span class="badge bg-${stockClass}">${remainingStock}/${coupon.stock}</span>
        </td>
        <td>
            <span class="text-muted">${usedCount}</span>
        </td>
        <td>${validUntil}</td>
        <td>
            <span class="badge bg-${statusClass}">${statusText}</span>
        </td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-info" onclick="viewCoupon(${coupon.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn btn-outline-primary" onclick="editCoupon(${coupon.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-outline-${coupon.isActive ? 'warning' : 'success'}" 
                        onclick="toggleCouponStatus(${coupon.id})" 
                        title="${coupon.isActive ? 'Deactivate' : 'Activate'}">
                    <i class="fas fa-${coupon.isActive ? 'ban' : 'check'}"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// ✅ FIX: Update updateStats function untuk handle usedCount
function updateStats(coupons) {
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter(c => c.isActive).length;
    
    // ✅ FIX: Handle usedCount dengan fallback
    const usedCoupons = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    const avgDiscountValue = coupons.length > 0 ? 
        (coupons.reduce((sum, c) => sum + c.discountPercentage, 0) / coupons.length).toFixed(1) : 0;
    
    if (elements.totalCouponsCount) {
        animateNumber(elements.totalCouponsCount, totalCoupons);
    }
    
    if (elements.activeCouponsCount) {
        animateNumber(elements.activeCouponsCount, activeCoupons);
    }
    
    if (elements.usedCouponsCount) {
        animateNumber(elements.usedCouponsCount, usedCoupons);
    }
    
    if (elements.avgDiscount) {
        elements.avgDiscount.textContent = `${avgDiscountValue}%`;
    }
}