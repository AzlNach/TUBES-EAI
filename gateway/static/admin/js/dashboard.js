

// Global variables
let dashboardData = {
    movies: [],
    cinemas: [],
    users: [],
    bookings: []
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

function initializeDashboard() {
    // Check admin authentication
    if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
        window.location.href = '/admin/login';
        return;
    }
    
    loadDashboardData();
    setupEventListeners();
}

function setupEventListeners() {
    // Refresh button if exists
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboardData);
    }
}

// Load all dashboard data
async function loadDashboardData() {
    try {
        showLoadingState();
        
        // Load data in parallel
        const [movies, cinemas, users, bookings] = await Promise.all([
            AdminAuth.getMovies().catch(() => []),
            AdminAuth.getCinemas().catch(() => []),
            AdminAuth.getUsers().catch(() => []),
            AdminAuth.getBookings().catch(() => [])
        ]);
        
        dashboardData = { movies, cinemas, users, bookings };
        
        updateStatistics();
        updateBadges();
        loadRecentActivity();
        
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        hideLoadingState();
        AdminAuth.showMessage('Failed to load dashboard data', 'error');
    }
}

// Update main statistics
function updateStatistics() {
    // Movies count
    const totalMovies = dashboardData.movies.length;
    animateNumber('total-movies', totalMovies);
    
    // Cinemas count
    const totalCinemas = dashboardData.cinemas.length;
    animateNumber('total-cinemas', totalCinemas);
    
    // Users count
    const totalUsers = dashboardData.users.length;
    animateNumber('total-users', totalUsers);
    
    // Bookings count
    const totalBookings = dashboardData.bookings.length;
    animateNumber('total-bookings', totalBookings);
    
    // Revenue (mock calculation)
    const totalRevenue = dashboardData.bookings
        .filter(b => b.status === 'PAID')
        .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);
    animateNumber('total-revenue', totalRevenue, 2000, '$');
}

// Update sidebar badges
function updateBadges() {
    // Movies badge
    const moviesBadge = document.getElementById('movies-count');
    if (moviesBadge) {
        moviesBadge.textContent = dashboardData.movies.length;
    }
    
    // Cinemas badge
    const cinemasBadge = document.getElementById('cinemas-count');
    if (cinemasBadge) {
        cinemasBadge.textContent = dashboardData.cinemas.length;
    }
    
    // Users badge
    const usersBadge = document.getElementById('users-count');
    if (usersBadge) {
        usersBadge.textContent = dashboardData.users.length;
    }
    
    // Bookings badge
    const bookingsBadge = document.getElementById('bookings-count');
    if (bookingsBadge) {
        const pendingBookings = dashboardData.bookings.filter(b => b.status === 'PENDING').length;
        bookingsBadge.textContent = pendingBookings;
    }
}

// Load recent activity
function loadRecentActivity() {
    const activityContainer = document.getElementById('recent-activity');
    if (!activityContainer) return;
    
    // Generate mock recent activity based on real data
    const activities = [];
    
    // Recent bookings
    const recentBookings = dashboardData.bookings
        .sort((a, b) => new Date(b.booking_time) - new Date(a.booking_time))
        .slice(0, 3);
    
    recentBookings.forEach(booking => {
        activities.push({
            type: 'booking',
            message: `New booking for "${booking.movie?.title || 'Unknown Movie'}"`,
            time: booking.booking_time,
            icon: 'fa-ticket-alt',
            color: 'text-success'
        });
    });
    
    // Recent users (last 3)
    const recentUsers = dashboardData.users
        .slice(-3)
        .reverse();
    
    recentUsers.forEach(user => {
        activities.push({
            type: 'user',
            message: `New user registered: ${user.username}`,
            time: new Date().toISOString(), // Mock time
            icon: 'fa-user-plus',
            color: 'text-info'
        });
    });
    
    // Sort by time and take top 5
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const topActivities = activities.slice(0, 5);
    
    if (topActivities.length === 0) {
        activityContainer.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-info-circle mb-2"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    activityContainer.innerHTML = topActivities.map(activity => `
        <div class="activity-item d-flex align-items-center mb-3">
            <div class="activity-icon me-3">
                <i class="fas ${activity.icon} ${activity.color}"></i>
            </div>
            <div class="activity-content flex-grow-1">
                <p class="mb-1">${activity.message}</p>
                <small class="text-muted">${formatTimeAgo(activity.time)}</small>
            </div>
        </div>
    `).join('');
}

// Animate number counting
function animateNumber(elementId, targetNumber, duration = 1500, prefix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startNumber = 0;
    const increment = targetNumber / (duration / 16);
    let currentNumber = startNumber;
    
    const timer = setInterval(() => {
        currentNumber += increment;
        if (currentNumber >= targetNumber) {
            currentNumber = targetNumber;
            clearInterval(timer);
        }
        
        const displayNumber = Math.floor(currentNumber);
        element.textContent = prefix + (prefix === '$' ? displayNumber.toFixed(2) : displayNumber);
    }, 16);
}

// Format time ago
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Loading states
function showLoadingState() {
    // Add loading spinners to stat cards
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(el => {
        el.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
    });
}

function hideLoadingState() {
    // Loading will be replaced by animated numbers
}

console.log('Admin dashboard loaded');