// Global variables
let allBookings = [];
let filteredBookings = [];
let currentPage = 1;
const bookingsPerPage = 10;

// DOM Elements
let elements = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // Check admin authentication
    if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
        window.location.href = '/admin/login';
        return;
    }
    
    cacheElements();
    setupEventListeners();
    loadBookings();
}

function cacheElements() {
    elements = {
        // ✅ FIX: Update element IDs sesuai HTML
        loadingContainer: document.getElementById('loading-container'),
        bookingsTableContainer: document.getElementById('bookings-table-container'),
        bookingsTableBody: document.getElementById('bookings-table-body'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'), 
        errorMessage: document.getElementById('error-message'),
        
        // Filters
        statusFilter: document.getElementById('status-filter'),
        dateFilter: document.getElementById('date-filter'),
        searchInput: document.getElementById('search-input'),
        clearSearch: document.getElementById('clear-search'),
        
        // Stats
        totalBookingsCount: document.getElementById('total-bookings-count'),
        paidBookingsCount: document.getElementById('paid-bookings-count'),
        pendingBookingsCount: document.getElementById('pending-bookings-count'),
        cancelledBookingsCount: document.getElementById('cancelled-bookings-count'),
        
        // Pagination
        paginationContainer: document.getElementById('bookings-pagination')
    };
}

function setupEventListeners() {
    // Search and filters
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    if (elements.clearSearch) {
        elements.clearSearch.addEventListener('click', clearSearch);
    }
    
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', applyFilters);
    }
    
    if (elements.dateFilter) {
        elements.dateFilter.addEventListener('change', applyFilters);
    }
}

// Load bookings from API
async function loadBookings() {
    try {
        showLoadingState();
        
        console.log('Loading bookings for admin...');
        const bookings = await AdminAuth.getBookings();
        
        if (bookings && bookings.length > 0) {
            allBookings = bookings;
            updateStats(bookings);
            applyFilters();
        } else {
            allBookings = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading bookings:', error);
        showErrorState('Failed to load bookings. Please try again.');
    }
}

// Update statistics
function updateStats(bookings) {
    const totalBookings = bookings.length;
    const paidBookings = bookings.filter(booking => booking.status === 'PAID').length;
    const pendingBookings = bookings.filter(booking => booking.status === 'PENDING').length;
    const cancelledBookings = bookings.filter(booking => booking.status === 'CANCELLED').length;
    
    if (elements.totalBookingsCount) {
        animateNumber(elements.totalBookingsCount, totalBookings);
    }
    
    if (elements.paidBookingsCount) {
        animateNumber(elements.paidBookingsCount, paidBookings);
    }
    
    if (elements.pendingBookingsCount) {
        animateNumber(elements.pendingBookingsCount, pendingBookings);
    }
    
    if (elements.cancelledBookingsCount) {
        animateNumber(elements.cancelledBookingsCount, cancelledBookings);
    }
}

// Apply filters and render
function applyFilters() {
    const searchTerm = elements.searchInput?.value.toLowerCase() || '';
    const selectedStatus = elements.statusFilter?.value || '';
    const selectedDate = elements.dateFilter?.value || '';
    
    filteredBookings = allBookings.filter(booking => {
        const matchesSearch = !searchTerm || 
            booking.id.toString().includes(searchTerm) ||
            booking.userId.toString().includes(searchTerm) ||
            booking.showtimeId.toString().includes(searchTerm);
            
        const matchesStatus = !selectedStatus || booking.status === selectedStatus;
        
        const matchesDate = !selectedDate || 
            booking.bookingDate?.startsWith(selectedDate);
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    renderBookings(filteredBookings);
}

// Render bookings table
function renderBookings(bookings) {
    if (!bookings || bookings.length === 0) {
        showEmptyState();
        return;
    }
    
    hideAllStates();
    elements.bookingsTableContainer.style.display = 'block';
    
    elements.bookingsTableBody.innerHTML = '';
    
    // Pagination
    const startIndex = (currentPage - 1) * bookingsPerPage;
    const endIndex = startIndex + bookingsPerPage;
    const paginatedBookings = bookings.slice(startIndex, endIndex);
    
    paginatedBookings.forEach(booking => {
        const row = createBookingRow(booking);
        elements.bookingsTableBody.appendChild(row);
    });
    
    updatePagination(bookings.length);
}

// Create booking table row
function createBookingRow(booking) {
    const row = document.createElement('tr');
    
    // ✅ FIX: Gunakan field names yang benar dari response
    const bookingDate = booking.bookingDate ? 
        new Date(booking.bookingDate).toLocaleDateString() : 'N/A';
    
    const statusClass = {
        'PAID': 'success',
        'PENDING': 'warning', 
        'CANCELLED': 'danger'
    }[booking.status] || 'secondary';
    
    row.innerHTML = `
        <td>#${booking.id}</td>
        <td>User ID: ${booking.userId || 'N/A'}</td>
        <td>Showtime ID: ${booking.showtimeId || 'N/A'}</td>
        <td>Seats: ${booking.seatNumbers || 'N/A'}</td>
        <td>$${booking.totalPrice || '0.00'}</td>
        <td><span class="badge bg-${statusClass}">${booking.status}</span></td>
        <td>${bookingDate}</td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-info" onclick="viewBooking(${booking.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Update pagination
function updatePagination(totalBookings) {
    if (!elements.paginationContainer) return;
    
    const totalPages = Math.ceil(totalBookings / bookingsPerPage);
    
    if (totalPages <= 1) {
        elements.paginationContainer.style.display = 'none';
        return;
    }
    
    elements.paginationContainer.style.display = 'block';
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
        </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    
    // Next button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
        </li>
    `;
    
    elements.paginationContainer.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredBookings.length / bookingsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderBookings(filteredBookings);
}

// Handle search
function handleSearch() {
    currentPage = 1;
    applyFilters();
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
    currentPage = 1;
    applyFilters();
}

// View booking details
function viewBooking(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (booking) {
        const details = `
Booking Details:

ID: ${booking.id}
User ID: ${booking.userId || 'N/A'}
Showtime ID: ${booking.showtimeId || 'N/A'}
Seats: ${booking.seatNumbers || 'N/A'}
Total Price: $${booking.totalPrice || '0.00'}
Status: ${booking.status}
Booking Date: ${booking.bookingDate ? new Date(booking.bookingDate).toLocaleString() : 'N/A'}
        `;
        alert(details);
    }
}

// Update booking status
function updateBookingStatus(bookingId, newStatus) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (booking && confirm(`Are you sure you want to mark booking #${bookingId} as ${newStatus}?`)) {
        AdminAuth.showMessage(`Booking status update functionality not implemented yet`, 'warning');
        // TODO: Implement actual status update API call
    }
}

// Refresh bookings
function refreshBookings() {
    AdminAuth.showMessage('Refreshing bookings...', 'info');
    loadBookings();
}

// Animate number counting
function animateNumber(element, targetNumber, duration = 1000) {
    const startNumber = 0;
    const increment = targetNumber / (duration / 16);
    let currentNumber = startNumber;
    
    const timer = setInterval(() => {
        currentNumber += increment;
        if (currentNumber >= targetNumber) {
            currentNumber = targetNumber;
            clearInterval(timer);
        }
        element.textContent = Math.floor(currentNumber);
    }, 16);
}

// State management functions
function showLoadingState() {
    hideAllStates();
    elements.loadingContainer.style.display = 'block';
}

function showEmptyState() {
    hideAllStates();
    elements.emptyState.style.display = 'block';
}

function showErrorState(message) {
    hideAllStates();
    elements.errorMessage.textContent = message;
    elements.errorState.style.display = 'block';
}

function hideAllStates() {
    elements.loadingContainer.style.display = 'none';
    elements.bookingsTableContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
}

// Utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global functions for inline handlers
window.viewBooking = viewBooking;
window.updateBookingStatus = updateBookingStatus;
window.refreshBookings = refreshBookings;
window.changePage = changePage;

console.log('Admin bookings management loaded');