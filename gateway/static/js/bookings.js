/**
 * Bookings Page JavaScript
 * Konsisten dengan schema.py GraphQL types dan booking-service schema
 * 
 * Schema mappings yang HARUS diikuti dari gateway/schema.py:
 * - BookingType: { id, user_id, showtime_id, status, total_price, booking_date, tickets }
 * - TicketType: { id, bookingId, seatNumber }
 * - PaymentType: { id, userId, bookingId, amount, paymentMethod, status, paymentProofImage, createdAt }
 * - Query: { my_bookings, my_payments }
 */

// KONSISTEN DENGAN SCHEMA.PY - Field names sesuai gateway schema
const BOOKING_FIELDS = {
    id: 'id',
    userId: 'user_id',
    showtimeId: 'showtime_id',
    status: 'status',
    totalPrice: 'total_price',
    bookingDate: 'booking_date',
    tickets: 'tickets'
};

const PAYMENT_FIELDS = {
    id: 'id',
    userId: 'userId',
    bookingId: 'bookingId',
    amount: 'amount',
    paymentMethod: 'paymentMethod',
    status: 'status',
    paymentProofImage: 'paymentProofImage',
    createdAt: 'createdAt'
};

// GraphQL Queries sesuai gateway/schema.py - AUTHENTICATED ACCESS REQUIRED
const BOOKING_QUERIES = {
    GET_MY_BOOKINGS: `
        query GetMyBookings {
            myBookings {
                id
                userId
                showtimeId
                status
                totalPrice
                bookingDate
                tickets {
                    id
                    bookingId
                    seatNumber
                }
            }
        }
    `,
    // REMOVED: GET_BOOKING_TICKETS query since it doesn't exist in schema
    GET_MY_PAYMENTS: `
        query GetMyPayments {
            myPayments {
                id
                userId
                bookingId
                amount
                paymentMethod
                status
                paymentProofImage
                createdAt
                booking {
                    id
                    status
                    showtime {
                        id
                        startTime
                        movie {
                            id
                            title
                            genre
                            posterUrl
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
                    tickets {
                        id
                        seatNumber
                    }
                }
            }
        }
    `,
    GET_SHOWTIMES_FOR_ENRICHMENT: `
        query GetShowtimes {
            showtimes {
                id
                movieId
                auditoriumId
                startTime
                price
                movie {
                    id
                    title
                    genre
                    posterUrl
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
    `
};

const BOOKING_MUTATIONS = {
    CREATE_PAYMENT: `
        mutation CreatePayment($bookingId: Int!, $paymentMethod: String!, $paymentProofImage: String) {
            createPayment(bookingId: $bookingId, paymentMethod: $paymentMethod, paymentProofImage: $paymentProofImage) {
                payment {
                    id
                    userId
                    bookingId
                    amount
                    paymentMethod
                    status
                    paymentProofImage
                    createdAt
                    booking {
                        id
                        status
                        tickets {
                            id
                            seatNumber
                        }
                    }
                }
                success
                message
            }
        }
    `,
    DELETE_BOOKING: `
        mutation DeleteBooking($id: Int!) {
            deleteBooking(id: $id) {
                success
                message
            }
        }
    `
};

// Global state variables
let allBookings = [];
let enrichedBookings = [];
let filteredBookings = [];
let allShowtimes = [];
let currentPage = 1;
const bookingsPerPage = 12;
let currentView = 'cards'; // 'cards' or 'table'
let currentFilters = {
    status: '',
    dateRange: '',
    movieSearch: '',
    sort: 'date-desc',
    startDate: '',
    endDate: ''
};
let isLoggedIn = false;

// DOM Elements cache
let elements = {};

// DOM ready initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Bookings page initializing...');
    
    // Cache DOM elements
    cacheElements();
    
    // Initialize authentication state
    isLoggedIn = AuthService.isLoggedIn();
    updateNavigation();
    
    // Check if user is logged in
    if (!isLoggedIn) {
        console.log('User not logged in, redirecting to login...');
        window.location.href = '/login?returnUrl=/bookings';
        return;
    }
    
    // Initialize page
    initializeBookingsPage();
    
    console.log('Bookings page initialized successfully');
});

// Cache frequently used DOM elements
function cacheElements() {
    elements = {
        // Containers
        loadingContainer: document.getElementById('loading-container'),
        bookingsCards: document.getElementById('bookings-cards'),
        bookingsTable: document.getElementById('bookings-table'),
        bookingsTableBody: document.getElementById('bookings-table-body'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        paginationContainer: document.getElementById('pagination-container'),
        
        // Filters
        statusFilter: document.getElementById('status-filter'),
        dateRangeFilter: document.getElementById('date-range-filter'),
        movieSearch: document.getElementById('movie-search'),
        sortFilter: document.getElementById('sort-filter'),
        startDate: document.getElementById('start-date'),
        endDate: document.getElementById('end-date'),
        customDateRange: document.getElementById('custom-date-range'),
        clearSearchBtn: document.getElementById('clear-search'),
        applyFiltersBtn: document.getElementById('apply-filters'),
        clearFiltersBtn: document.getElementById('clear-filters'),
        
        // View controls
        cardViewBtn: document.getElementById('card-view'),
        tableViewBtn: document.getElementById('table-view'),
        
        // Pagination
        paginationInfo: document.getElementById('pagination-info'),
        paginationControls: document.getElementById('pagination-controls'),
        showingStart: document.getElementById('showing-start'),
        showingEnd: document.getElementById('showing-end'),
        totalBookings: document.getElementById('total-bookings'),
        
        // Count and stats
        bookingCount: document.getElementById('booking-count'),
        
        // Modals
        bookingDetailModal: document.getElementById('bookingDetailModal'),
        modalBookingDetailContent: document.getElementById('modal-booking-detail-content'),
        downloadTicketBtn: document.getElementById('download-ticket-btn'),
        completePaymentBookingBtn: document.getElementById('complete-payment-booking-btn'),
        cancelBookingBtn: document.getElementById('cancel-booking-btn'),
        
        paymentCompletionModal: document.getElementById('paymentCompletionModal'),
        modalPaymentCompletionContent: document.getElementById('modal-payment-completion-content'),
        submitPaymentBtn: document.getElementById('submit-payment-btn'),
        
        cancelBookingModal: document.getElementById('cancelBookingModal'),
        bookingCancelDetails: document.getElementById('booking-cancel-details'),
        cancellationReason: document.getElementById('cancellation-reason'),
        confirmCancelBookingBtn: document.getElementById('confirm-cancel-booking-btn'),
        
        // Error handling
        errorMessage: document.getElementById('error-message'),
        retryLoadBtn: document.getElementById('retry-load')
    };
}

// Initialize the bookings page
function initializeBookingsPage() {
    try {
        console.log('Initializing bookings page...');
        
        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        loadBookingsData();
        
        console.log('Bookings page initialization completed');
        
    } catch (error) {
        console.error('Error initializing bookings page:', error);
        showErrorState('Failed to initialize page. Please refresh and try again.');
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Filter event listeners
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', handleFilterChange);
    }
    
    if (elements.dateRangeFilter) {
        elements.dateRangeFilter.addEventListener('change', handleDateRangeChange);
    }
    
    if (elements.movieSearch) {
        elements.movieSearch.addEventListener('input', debounce(handleSearchInput, 300));
    }
    
    if (elements.sortFilter) {
        elements.sortFilter.addEventListener('change', handleFilterChange);
    }
    
    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    if (elements.applyFiltersBtn) {
        elements.applyFiltersBtn.addEventListener('click', applyFilters);
    }
    
    if (elements.clearFiltersBtn) {
        elements.clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // View toggle event listeners
    if (elements.cardViewBtn) {
        elements.cardViewBtn.addEventListener('click', () => switchView('cards'));
    }
    
    if (elements.tableViewBtn) {
        elements.tableViewBtn.addEventListener('click', () => switchView('table'));
    }
    
    // Retry button
    if (elements.retryLoadBtn) {
        elements.retryLoadBtn.addEventListener('click', loadBookingsData);
    }
    
    // Modal event listeners will be set up dynamically
}

// Load bookings data from API
async function loadBookingsData() {
    try {
        showLoadingState();
        
        console.log('Loading bookings data from GraphQL API...');
        
        // Load bookings and showtimes in parallel
        const [bookingsResult, showtimesResult] = await Promise.all([
            AuthService.graphqlRequest(BOOKING_QUERIES.GET_MY_BOOKINGS, {}, true),
            AuthService.graphqlRequest(BOOKING_QUERIES.GET_SHOWTIMES_FOR_ENRICHMENT, {}, false) // Public access for showtimes
        ]);
        
        console.log('Bookings result:', bookingsResult);
        console.log('Showtimes result:', showtimesResult);
        
        // Handle bookings data - PERBAIKAN: Check for both errors and data
        if (bookingsResult.errors) {
            console.error('GraphQL errors:', bookingsResult.errors);
            throw new Error(bookingsResult.errors[0].message);
        }
        
        // PERBAIKAN: Handle case when data is null or undefined
        if (!bookingsResult.data) {
            throw new Error('No data received from booking service');
        }
        
        const bookings = bookingsResult.data?.myBookings || [];
        
        // Handle showtimes data - PERBAIKAN: More resilient error handling
        let showtimes = [];
        if (showtimesResult.errors) {
            console.warn('Showtimes error (using fallback):', showtimesResult.errors);
            // Don't throw error for showtimes, use empty array as fallback
        } else if (showtimesResult.data) {
            showtimes = showtimesResult.data.showtimes || [];
        }
        
        allShowtimes = showtimes;
        
        console.log('Raw bookings loaded:', bookings.length);
        console.log('Showtimes loaded for enrichment:', showtimes.length);
        
        if (bookings && bookings.length > 0) {
            allBookings = bookings;
            
            // FIXED: Remove the separate ticket loading since tickets are already included
            console.log('Bookings loaded with tickets:', bookings.map(b => ({
                id: b.id,
                ticketCount: b.tickets ? b.tickets.length : 0,
                tickets: b.tickets
            })));
            
            // Enrich bookings with showtime data
            enrichedBookings = enrichBookingsWithShowtimeData(allBookings, allShowtimes);
            
            // Update booking count
            updateBookingCount(enrichedBookings.length);
            
            // Apply initial filters and render
            applyFilters();
            
        } else {
            console.warn('No bookings data received');
            allBookings = [];
            enrichedBookings = [];
            // PERBAIKAN: Update count to 0 and show empty state
            updateBookingCount(0);
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading bookings:', error);
        
        // PERBAIKAN: More detailed error logging
        if (error.name === 'NetworkError' || error.message.includes('fetch')) {
            showErrorState('Network connection error. Please check your internet connection and try again.');
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
            showErrorState('Authentication error. Please login again.');
            setTimeout(() => {
                window.location.href = '/login?returnUrl=/bookings';
            }, 2000);
        } else {
            showErrorState(`Failed to load bookings: ${error.message}`);
        }
    }
}

// FIXED: Add function to load tickets data for bookings
async function loadTicketsForBookings(bookings) {
    try {
        // Load tickets for each booking from booking service
        for (let booking of bookings) {
            const ticketsQuery = `
                query GetBookingTickets {
                    bookingTickets(bookingId: ${booking.id}) {
                        id
                        bookingId
                        seatNumber
                    }
                }
            `;
            
            try {
                const ticketsResult = await AuthService.graphqlRequest(ticketsQuery, {}, true);
                
                if (ticketsResult.data && ticketsResult.data.bookingTickets) {
                    booking.tickets = ticketsResult.data.bookingTickets;
                    console.log(`Loaded ${booking.tickets.length} tickets for booking ${booking.id}:`, booking.tickets);
                } else {
                    console.warn(`No tickets found for booking ${booking.id}`);
                    booking.tickets = [];
                }
            } catch (ticketError) {
                console.warn(`Failed to load tickets for booking ${booking.id}:`, ticketError);
                booking.tickets = [];
            }
        }
    } catch (error) {
        console.error('Error loading tickets for bookings:', error);
    }
}

// Enrich bookings with showtime data
function enrichBookingsWithShowtimeData(bookings, showtimes) {
    console.log('Enriching bookings with showtime data...');
    console.log('Bookings to enrich:', bookings);
    console.log('Available showtimes:', showtimes);
    
    return bookings.map(booking => {
        // Handle the camelCase field names from GraphQL
        const showtimeId = booking.showtimeId || booking.showtime_id;
        
        // Find matching showtime
        const showtime = showtimes.find(s => s.id === showtimeId);
        
        if (showtime) {
            return {
                ...booking,
                // Map camelCase fields for consistency
                user_id: booking.userId,
                showtime_id: booking.showtimeId,
                total_price: booking.totalPrice,
                booking_date: booking.bookingDate,
                // Ensure tickets have correct field mapping
                tickets: booking.tickets ? booking.tickets.map(ticket => ({
                    id: ticket.id,
                    bookingId: ticket.bookingId,
                    seatNumber: ticket.seatNumber,
                    // Also provide snake_case versions for backward compatibility
                    booking_id: ticket.bookingId,
                    seat_number: ticket.seatNumber
                })) : [],
                showtime: {
                    id: showtime.id,
                    startTime: showtime.startTime,
                    price: showtime.price,
                    movie: showtime.movie,
                    auditorium: showtime.auditorium
                }
            };
        } else {
            console.warn(`No showtime found for booking ${booking.id} with showtime_id ${showtimeId}`);
            // Fallback for missing showtime data
            return {
                ...booking,
                // Map camelCase fields for consistency
                user_id: booking.userId,
                showtime_id: booking.showtimeId,
                total_price: booking.totalPrice,
                booking_date: booking.bookingDate,
                tickets: booking.tickets ? booking.tickets.map(ticket => ({
                    id: ticket.id,
                    bookingId: ticket.bookingId,
                    seatNumber: ticket.seatNumber,
                    // Also provide snake_case versions for backward compatibility
                    booking_id: ticket.bookingId,
                    seat_number: ticket.seatNumber
                })) : [],
                showtime: {
                    id: showtimeId,
                    startTime: null,
                    price: 0,
                    movie: {
                        id: null,
                        title: 'Movie information unavailable',
                        genre: 'Unknown',
                        posterUrl: null
                    },
                    auditorium: {
                        id: null,
                        name: 'Theater information unavailable',
                        cinema: {
                            id: null,
                            name: 'Cinema information unavailable',
                            city: 'Unknown'
                        }
                    }
                }
            };
        }
    });
}

// Show loading state
function showLoadingState() {
    elements.loadingContainer.style.display = 'block';
    elements.bookingsCards.style.display = 'none';
    elements.bookingsTable.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Show error state
function showErrorState(message = 'An error occurred') {
    elements.loadingContainer.style.display = 'none';
    elements.bookingsCards.style.display = 'none';
    elements.bookingsTable.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'block';
    elements.paginationContainer.style.display = 'none';
    
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
}

// Show empty state
function showEmptyState() {
    elements.loadingContainer.style.display = 'none';
    elements.bookingsCards.style.display = 'none';
    elements.bookingsTable.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Update booking count badge
function updateBookingCount(count) {
    if (elements.bookingCount) {
        elements.bookingCount.innerHTML = `<i class="fas fa-ticket-alt me-1"></i>${count} Booking${count !== 1 ? 's' : ''}`;
    }
}

// Handle filter changes
function handleFilterChange() {
    currentPage = 1; // Reset to first page when filters change
    applyFilters();
}

// Handle date range change
function handleDateRangeChange() {
    const dateRange = elements.dateRangeFilter.value;
    
    if (dateRange === 'custom') {
        elements.customDateRange.style.display = 'block';
    } else {
        elements.customDateRange.style.display = 'none';
        // Clear custom date inputs
        elements.startDate.value = '';
        elements.endDate.value = '';
    }
    
    handleFilterChange();
}

// Handle search input with debouncing
function handleSearchInput() {
    currentPage = 1; // Reset to first page when searching
    applyFilters();
}

// Clear search
function clearSearch() {
    elements.movieSearch.value = '';
    elements.clearSearchBtn.style.display = 'none';
    handleFilterChange();
}

// Apply all filters
function applyFilters() {
    // Update current filters
    currentFilters.status = elements.statusFilter.value;
    currentFilters.dateRange = elements.dateRangeFilter.value;
    currentFilters.movieSearch = elements.movieSearch.value.toLowerCase().trim();
    currentFilters.sort = elements.sortFilter.value;
    
    // Handle custom date range
    if (currentFilters.dateRange === 'custom') {
        currentFilters.startDate = elements.startDate.value;
        currentFilters.endDate = elements.endDate.value;
    }
    
    // Show/hide clear search button
    if (elements.movieSearch.value.trim()) {
        elements.clearSearchBtn.style.display = 'block';
    } else {
        elements.clearSearchBtn.style.display = 'none';
    }
    
    // Filter bookings
    filteredBookings = filterBookings(enrichedBookings, currentFilters);
    
    // Sort bookings
    filteredBookings = sortBookings(filteredBookings, currentFilters.sort);
    
    // Render bookings
    renderBookings();
}

// Filter bookings based on criteria
function filterBookings(bookings, filters) {
    return bookings.filter(booking => {
        // Status filter
        if (filters.status && booking.status !== filters.status) {
            return false;
        }
        
        // Movie search filter
        if (filters.movieSearch) {
            const movieTitle = booking.showtime?.movie?.title?.toLowerCase() || '';
            if (!movieTitle.includes(filters.movieSearch)) {
                return false;
            }
        }
        
        // Date range filter
        if (filters.dateRange && booking.booking_date) {
            const bookingDate = new Date(booking.booking_date);
            const now = new Date();
            
            switch (filters.dateRange) {
                case 'today':
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    if (bookingDate < today || bookingDate >= tomorrow) {
                        return false;
                    }
                    break;
                    
                case 'this-week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    if (bookingDate < weekStart) {
                        return false;
                    }
                    break;
                    
                case 'this-month':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (bookingDate < monthStart) {
                        return false;
                    }
                    break;
                    
                case 'last-month':
                    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (bookingDate < lastMonthStart || bookingDate >= lastMonthEnd) {
                        return false;
                    }
                    break;
                    
                case 'custom':
                    if (filters.startDate && filters.endDate) {
                        const start = new Date(filters.startDate);
                        const end = new Date(filters.endDate);
                        end.setHours(23, 59, 59, 999); // Include full end date
                        if (bookingDate < start || bookingDate > end) {
                            return false;
                        }
                    }
                    break;
            }
        }
        
        return true;
    });
}

// Sort bookings based on criteria
function sortBookings(bookings, sortBy) {
    return [...bookings].sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.booking_date) - new Date(a.booking_date);
            case 'date-asc':
                return new Date(a.booking_date) - new Date(b.booking_date);
            case 'movie':
                const titleA = a.showtime?.movie?.title || '';
                const titleB = b.showtime?.movie?.title || '';
                return titleA.localeCompare(titleB);
            case 'status':
                return a.status.localeCompare(b.status);
            case 'amount':
                return (b.total_price || 0) - (a.total_price || 0);
            default:
                return 0;
        }
    });
}

// Clear all filters
function clearAllFilters() {
    elements.statusFilter.value = '';
    elements.dateRangeFilter.value = '';
    elements.movieSearch.value = '';
    elements.sortFilter.value = 'date-desc';
    elements.startDate.value = '';
    elements.endDate.value = '';
    elements.customDateRange.style.display = 'none';
    elements.clearSearchBtn.style.display = 'none';
    
    currentPage = 1;
    applyFilters();
}

// Render bookings based on current view and pagination
function renderBookings() {
    if (filteredBookings.length === 0) {
        showEmptyState();
        return;
    }
    
    // Calculate pagination
    const totalBookings = filteredBookings.length;
    const totalPages = Math.ceil(totalBookings / bookingsPerPage);
    const startIndex = (currentPage - 1) * bookingsPerPage;
    const endIndex = Math.min(startIndex + bookingsPerPage, totalBookings);
    const paginatedBookings = filteredBookings.slice(startIndex, endIndex);
    
    // Show appropriate view
    if (currentView === 'cards') {
        renderCardsView(paginatedBookings);
    } else {
        renderTableView(paginatedBookings);
    }
    
    // Update pagination
    updatePagination(startIndex + 1, endIndex, totalBookings, totalPages);
}

// Render cards view
function renderCardsView(bookings) {
    elements.loadingContainer.style.display = 'none';
    elements.bookingsCards.style.display = 'flex';
    elements.bookingsTable.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    
    elements.bookingsCards.innerHTML = '';
    
    bookings.forEach((booking, index) => {
        const bookingCard = createBookingCard(booking, index);
        elements.bookingsCards.appendChild(bookingCard);
    });
}

// Render table view
function renderTableView(bookings) {
    elements.loadingContainer.style.display = 'none';
    elements.bookingsCards.style.display = 'none';
    elements.bookingsTable.style.display = 'block';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    
    elements.bookingsTableBody.innerHTML = '';
    
    bookings.forEach((booking, index) => {
        const bookingRow = createBookingTableRow(booking, index);
        elements.bookingsTableBody.appendChild(bookingRow);
    });
}

// Create booking card for cards view
function createBookingCard(booking, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 mb-4';
    
    // Format dates
    const bookingDate = booking.booking_date ? new Date(booking.booking_date) : null;
    const bookingDateDisplay = bookingDate ? bookingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : 'N/A';
    
    const showtimeDate = booking.showtime?.startTime ? new Date(booking.showtime.startTime) : null;
    const showtimeDateDisplay = showtimeDate ? showtimeDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }) : 'TBD';
    const showtimeTimeDisplay = showtimeDate ? showtimeDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'TBD';
    
    // Status styling
    const statusBadge = getStatusBadge(booking.status);
    
    // FIXED: Better poster URL with proper fallback
    const posterUrl = booking.showtime?.movie?.posterUrl || 
                     booking.showtime?.movie?.poster_url || 
                     'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4=';
    
    // FIXED: Get seats data properly from tickets
    const seats = booking.tickets || [];
    console.log('Booking seats data:', seats); // Debug log
    
    // Extract seat numbers with fallback
    let seatNumbers = 'No seats';
    if (seats.length > 0) {
        const seatNumbersArray = seats.map(ticket => {
            // Handle both camelCase and snake_case
            return ticket.seatNumber || ticket.seat_number || 'Unknown';
        }).filter(seat => seat !== 'Unknown');
        
        if (seatNumbersArray.length > 0) {
            seatNumbers = seatNumbersArray.join(', ');
        }
    }
    
    console.log('Final seat numbers for booking', booking.id, ':', seatNumbers); // Debug log
    
    // Action buttons based on status
    const actionButtons = getActionButtons(booking);
    
    col.innerHTML = `
        <div class="card booking-card h-100" data-booking-id="${booking.id}">
            <div class="booking-poster-container">
                <img src="${posterUrl}" class="booking-poster" alt="${booking.showtime?.movie?.title || 'Movie'}"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4='">
                <div class="booking-status-overlay">
                    ${statusBadge}
                </div>
            </div>
            <div class="card-body">
                <h5 class="card-title">${booking.showtime?.movie?.title || 'Movie Unavailable'}</h5>
                <div class="booking-meta mb-3">
                    <div class="meta-item">
                        <i class="fas fa-calendar text-primary"></i>
                        <span>Booking #${booking.id}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-clock text-primary"></i>
                        <span>${showtimeDateDisplay} at ${showtimeTimeDisplay}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-building text-primary"></i>
                        <span>${booking.showtime?.auditorium?.cinema?.name || 'Cinema N/A'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-chair text-primary"></i>
                        <span>${seatNumbers}</span>
                    </div>
                </div>
                <div class="booking-details">
                    <div class="row">
                        <div class="col-6">
                            <small class="text-muted">Total Amount</small>
                            <div class="booking-amount">$${(booking.total_price || 0).toFixed(2)}</div>
                        </div>
                        <div class="col-6 text-end">
                            <small class="text-muted">Booked On</small>
                            <div class="booking-date">${bookingDateDisplay}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-primary btn-sm flex-fill" onclick="showBookingDetail(${booking.id})">
                        <i class="fas fa-eye me-1"></i>Details
                    </button>
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// Create booking table row for table view
function createBookingTableRow(booking, index) {
    const row = document.createElement('tr');
    row.className = 'booking-row';
    row.dataset.bookingId = booking.id;
    
    // Format dates
    const bookingDate = booking.booking_date ? new Date(booking.booking_date) : null;
    const bookingDateDisplay = bookingDate ? bookingDate.toLocaleDateString('en-US') : 'N/A';
    
    const showtimeDate = booking.showtime?.startTime ? new Date(booking.showtime.startTime) : null;
    const showtimeDateDisplay = showtimeDate ? showtimeDate.toLocaleDateString('en-US') : 'TBD';
    const showtimeTimeDisplay = showtimeDate ? showtimeDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'TBD';
    
    // Status styling
    const statusBadge = getStatusBadge(booking.status);
    
    // FIXED: Get seats data properly from tickets
    const seats = booking.tickets || [];
    let seatNumbers = 'No seats';
    if (seats.length > 0) {
        const seatNumbersArray = seats.map(ticket => {
            return ticket.seatNumber || ticket.seat_number || 'Unknown';
        }).filter(seat => seat !== 'Unknown');
        
        if (seatNumbersArray.length > 0) {
            seatNumbers = seatNumbersArray.join(', ');
        }
    }
    
    // Action buttons based on status
    const actionButtons = getActionButtonsCompact(booking);
    
    // FIXED: Better poster URL fallback
    const posterUrl = booking.showtime?.movie?.posterUrl || 
                     booking.showtime?.movie?.poster_url || 
                     'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NDc0OGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5OQTM+';
    
    row.innerHTML = `
        <td>#${booking.id}</td>
        <td>
            <div class="d-flex align-items-center">
                <img src="${posterUrl}" 
                     class="table-movie-poster me-2" alt="${booking.showtime?.movie?.title || 'Movie'}"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NDc0OGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5OQTZ0ZXh0Pjwvc3ZnPg=='">
                <div>
                    <div class="fw-semibold">${booking.showtime?.movie?.title || 'Movie Unavailable'}</div>
                    <small class="text-muted">${booking.showtime?.movie?.genre || 'Unknown'}</small>
                </div>
            </div>
        </td>
        <td>
            <div>${showtimeDateDisplay}</div>
            <small class="text-muted">${showtimeTimeDisplay}</small>
        </td>
        <td>
            <div>${booking.showtime?.auditorium?.cinema?.name || 'Cinema N/A'}</div>
            <small class="text-muted">${booking.showtime?.auditorium?.name || 'Theater N/A'}</small>
        </td>
        <td>
            <span class="seats-display">${seatNumbers}</span>
        </td>
        <td class="fw-semibold">$${(booking.total_price || 0).toFixed(2)}</td>
        <td>${statusBadge}</td>
        <td>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary" onclick="showBookingDetail(${booking.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                ${actionButtons}
            </div>
        </td>
    `;
    
    return row;
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        'PENDING': '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>Pending Payment</span>',
        'PAID': '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Paid</span>',
        'CONFIRMED': '<span class="badge bg-primary"><i class="fas fa-ticket-alt me-1"></i>Confirmed</span>',
        'CANCELLED': '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Cancelled</span>',
        'EXPIRED': '<span class="badge bg-secondary"><i class="fas fa-clock me-1"></i>Expired</span>'
    };
    
    return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
}

// Get action buttons based on booking status
function getActionButtons(booking) {
    switch (booking.status) {
        case 'PENDING':
            return `
                <button class="btn btn-success btn-sm flex-fill" onclick="completePayment(${booking.id})">
                    <i class="fas fa-credit-card me-1"></i>Pay Now
                </button>
                <button class="btn btn-danger btn-sm" onclick="cancelBooking(${booking.id})" title="Cancel Booking">
                    <i class="fas fa-times"></i>
                </button>
            `;
        case 'PAID':
        case 'CONFIRMED':
            return `
                <button class="btn btn-info btn-sm flex-fill" onclick="downloadTicket(${booking.id})">
                    <i class="fas fa-download me-1"></i>Download Ticket
                </button>
                <small class="text-success mt-1"><i class="fas fa-check me-1"></i>Payment Complete - Cannot Cancel</small>
            `;
        case 'CANCELLED':
            return `<small class="text-muted">Booking Cancelled</small>`;
        case 'EXPIRED':
            return `<small class="text-muted">Booking Expired</small>`;
        default:
            return '';
    }
}

// Get compact action buttons for table view
function getActionButtonsCompact(booking) {
    switch (booking.status) {
        case 'PENDING':
            return `
                <button class="btn btn-success" onclick="completePayment(${booking.id})" title="Complete Payment">
                    <i class="fas fa-credit-card"></i>
                </button>
                <button class="btn btn-danger" onclick="cancelBooking(${booking.id})" title="Cancel Booking">
                    <i class="fas fa-times"></i>
                </button>
            `;
        case 'PAID':
        case 'CONFIRMED':
            return `
                <button class="btn btn-info" onclick="downloadTicket(${booking.id})" title="Download Ticket">
                    <i class="fas fa-download"></i>
                </button>
            `;
        default:
            return '';
    }
}

// Switch between cards and table view
function switchView(view) {
    currentView = view;
    
    // Update button states
    elements.cardViewBtn.classList.toggle('active', view === 'cards');
    elements.tableViewBtn.classList.toggle('active', view === 'table');
    
    // Re-render with current data
    renderBookings();
}

// Update pagination display and controls
function updatePagination(start, end, total, totalPages) {
    // Update pagination info
    elements.showingStart.textContent = start;
    elements.showingEnd.textContent = end;
    elements.totalBookings.textContent = total;
    
    // Generate pagination controls
    generatePaginationControls(totalPages);
    
    // Show pagination container
    elements.paginationContainer.style.display = totalPages > 1 ? 'block' : 'none';
}

// Generate pagination controls
function generatePaginationControls(totalPages) {
    elements.paginationControls.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${currentPage - 1})" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
        </a>
    `;
    elements.paginationControls.appendChild(prevLi);
    
    // Page numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    // Adjust if we're near the beginning or end
    if (endPage - startPage < 4) {
        if (startPage === 1) {
            endPage = Math.min(totalPages, startPage + 4);
        } else {
            startPage = Math.max(1, endPage - 4);
        }
    }
    
    // First page if not in range
    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        firstLi.innerHTML = `<a class="page-link" href="#" onclick="changePage(1)">1</a>`;
        elements.paginationControls.appendChild(firstLi);
        
        if (startPage > 2) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            dotsLi.innerHTML = `<span class="page-link">...</span>`;
            elements.paginationControls.appendChild(dotsLi);
        }
    }
    
    // Page numbers in range
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#" onclick="changePage(${i})">${i}</a>`;
        elements.paginationControls.appendChild(pageLi);
    }
    
    // Last page if not in range
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            dotsLi.innerHTML = `<span class="page-link">...</span>`;
            elements.paginationControls.appendChild(dotsLi);
        }
        
        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        lastLi.innerHTML = `<a class="page-link" href="#" onclick="changePage(${totalPages})">${totalPages}</a>`;
        elements.paginationControls.appendChild(lastLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" onclick="changePage(${currentPage + 1})" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
        </a>
    `;
    elements.paginationControls.appendChild(nextLi);
}

// Change page
function changePage(page) {
    if (page < 1 || page > Math.ceil(filteredBookings.length / bookingsPerPage)) return;
    
    currentPage = page;
    renderBookings();
    
    // Scroll to top of bookings section
    document.querySelector('.bookings-section').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// Show booking detail modal
async function showBookingDetail(bookingId) {
    try {
        console.log('Loading booking detail for ID:', bookingId);
        
        // Find booking in current data
        const booking = enrichedBookings.find(b => b.id === bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }
        
        // Show modal
        const modal = new bootstrap.Modal(elements.bookingDetailModal);
        modal.show();
        
        // Render booking details
        renderBookingDetailModal(booking);
        
        // Setup modal button listeners
        setupBookingDetailListeners(booking);
        
    } catch (error) {
        console.error('Error loading booking detail:', error);
        AuthService.showMessage('Error loading booking details. Please try again.', 'error');
    }
}

// Render booking detail in modal
function renderBookingDetailModal(booking) {
    // Format dates
    const bookingDate = booking.booking_date ? new Date(booking.booking_date) : null;
    const bookingDateDisplay = bookingDate ? bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'N/A';
    
    const showtimeDate = booking.showtime?.startTime ? new Date(booking.showtime.startTime) : null;
    const showtimeDateDisplay = showtimeDate ? showtimeDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'TBD';
    const showtimeTimeDisplay = showtimeDate ? showtimeDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'TBD';
    
    // Status styling
    const statusBadge = getStatusBadge(booking.status);
    
    // FIXED: Better poster URL fallback
    const posterUrl = booking.showtime?.movie?.posterUrl || 
                     booking.showtime?.movie?.poster_url || 
                     'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4=';
    
    // FIXED: Get seats data properly from tickets
    const seats = booking.tickets || [];
    console.log('Modal booking seats data:', seats); // Debug log
    
    let seatNumbers = [];
    if (seats.length > 0) {
        seatNumbers = seats.map(ticket => {
            return ticket.seatNumber || ticket.seat_number || 'Unknown';
        }).filter(seat => seat !== 'Unknown');
    }
    
    console.log('Modal final seat numbers for booking', booking.id, ':', seatNumbers); // Debug log
    
    elements.modalBookingDetailContent.innerHTML = `
        <div class="booking-detail-content">
            <div class="row">
                <div class="col-md-4 text-center mb-4">
                    <img src="${posterUrl}" class="booking-detail-poster mb-3" alt="${booking.showtime?.movie?.title || 'Movie'}"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTJlOGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBvc3RlcjwvdGV4dD48L3N2Zz4='">
                    <div class="booking-status-large">
                        ${statusBadge}
                    </div>
                </div>
                <div class="col-md-8">
                    <h4 class="booking-detail-title">${booking.showtime?.movie?.title || 'Movie Unavailable'}</h4>
                    <div class="booking-detail-meta mb-4">
                        <div class="meta-row">
                            <span class="meta-label">Genre:</span>
                            <span class="meta-value">${booking.showtime?.movie?.genre || 'Unknown'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Duration:</span>
                            <span class="meta-value">${booking.showtime?.movie?.duration || 'N/A'} minutes</span>
                        </div>
                    </div>
                    
                    <div class="booking-info-sections">
                        <div class="info-section">
                            <h6 class="section-title">
                                <i class="fas fa-ticket-alt me-2"></i>Booking Information
                            </h6>
                            <div class="info-content">
                                <div class="info-row">
                                    <span class="info-label">Booking ID:</span>
                                    <span class="info-value">#${booking.id}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Booking Date:</span>
                                    <span class="info-value">${bookingDateDisplay}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Total Amount:</span>
                                    <span class="info-value booking-amount-large">$${(booking.total_price || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="info-section">
                            <h6 class="section-title">
                                <i class="fas fa-calendar-alt me-2"></i>Showtime Details
                            </h6>
                            <div class="info-content">
                                <div class="info-row">
                                    <span class="info-label">Date & Time:</span>
                                    <span class="info-value">${showtimeDateDisplay} at ${showtimeTimeDisplay}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Cinema:</span>
                                    <span class="info-value">${booking.showtime?.auditorium?.cinema?.name || 'Cinema N/A'}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Theater:</span>
                                    <span class="info-value">${booking.showtime?.auditorium?.name || 'Theater N/A'}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Location:</span>
                                    <span class="info-value">${booking.showtime?.auditorium?.cinema?.city || 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="info-section">
                            <h6 class="section-title">
                                <i class="fas fa-chair me-2"></i>Seat Information
                            </h6>
                            <div class="info-content">
                                <div class="info-row">
                                    <span class="info-label">Number of Seats:</span>
                                    <span class="info-value">${seatNumbers.length} seat(s)</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Seat Numbers:</span>
                                    <div class="info-value">
                                        <div class="seats-display-large">
                                            ${seatNumbers.length > 0 ? 
                                              seatNumbers.map(seat => `<span class="seat-badge-large">${seat}</span>`).join('') : 
                                              '<span class="seat-badge-large">No seats assigned</span>'
                                            }
                                        </div>
                                    </div>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Price per Seat:</span>
                                    <span class="info-value">$${booking.showtime?.price ? booking.showtime.price.toFixed(2) : '0.00'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Show/hide action buttons based on status
    elements.downloadTicketBtn.style.display = ['PAID', 'CONFIRMED'].includes(booking.status) ? 'inline-block' : 'none';
    elements.completePaymentBookingBtn.style.display = booking.status === 'PENDING' ? 'inline-block' : 'none';
    elements.cancelBookingBtn.style.display = booking.status === 'PENDING' ? 'inline-block' : 'none';

    if (booking.status !== 'PENDING') {
        elements.cancelBookingBtn.innerHTML = '<i class="fas fa-ban me-2"></i>Cannot Cancel (Paid)';
        elements.cancelBookingBtn.disabled = true;
        elements.cancelBookingBtn.classList.add('btn-secondary');
        elements.cancelBookingBtn.classList.remove('btn-danger');
    } else {
        elements.cancelBookingBtn.innerHTML = '<i class="fas fa-times me-2"></i>Cancel Booking';
        elements.cancelBookingBtn.disabled = false;
        elements.cancelBookingBtn.classList.add('btn-danger');
        elements.cancelBookingBtn.classList.remove('btn-secondary');
    }
}

// Setup booking detail modal listeners
function setupBookingDetailListeners(booking) {
    // Download ticket button
    elements.downloadTicketBtn.onclick = function() {
        downloadTicket(booking.id);
    };
    
    // Complete payment button
    elements.completePaymentBookingBtn.onclick = function() {
        const modal = bootstrap.Modal.getInstance(elements.bookingDetailModal);
        modal.hide();
        completePayment(booking.id);
    };
    
    // Cancel booking button - only show for PENDING bookings
    elements.cancelBookingBtn.onclick = function() {
        if (booking.status !== 'PENDING') {
            AuthService.showMessage('Only pending bookings can be cancelled. Once payment is made, cancellation is not allowed.', 'warning');
            return;
        }
        
        const modal = bootstrap.Modal.getInstance(elements.bookingDetailModal);
        modal.hide();
        cancelBooking(booking.id);
    };
}


// Complete payment for a booking
async function completePayment(bookingId) {
    try {
        console.log('Starting payment completion for booking:', bookingId);
        
        // Find booking
        const booking = enrichedBookings.find(b => b.id === bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }
        
        if (booking.status !== 'PENDING') {
            throw new Error('Only pending bookings can be paid for');
        }
        
        // Show payment completion modal
        showPaymentCompletionModal(booking);
        
    } catch (error) {
        console.error('Error starting payment completion:', error);
        AuthService.showMessage(`Error: ${error.message}`, 'error');
    }
}

// Show payment completion modal
function showPaymentCompletionModal(booking) {
    // Calculate seat count and total
    const seatCount = booking.tickets ? booking.tickets.length : 0;
    const totalAmount = booking.total_price || 0;
    const pricePerSeat = booking.showtime?.price || 0;
    
    // Seats display
    const seatNumbers = booking.tickets ? booking.tickets.map(t => t.seatNumber).join(', ') : 'N/A';
    
    elements.modalPaymentCompletionContent.innerHTML = `
        <div class="payment-completion-content">
            <div class="payment-summary mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-receipt me-2"></i>Payment Summary
                </h6>
                <div class="summary-card">
                    <div class="row">
                        <div class="col-md-8">
                            <div class="summary-details">
                                <div class="detail-row">
                                    <span class="label">Booking ID:</span>
                                    <span class="value">#${booking.id}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Movie:</span>
                                    <span class="value">${booking.showtime?.movie?.title || 'Movie N/A'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Seats:</span>
                                    <span class="value">${seatNumbers}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Seat Count:</span>
                                    <span class="value">${seatCount} seat(s)</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Price per Seat:</span>
                                    <span class="value">$${pricePerSeat.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="total-display">
                                <div class="total-label">Total Amount</div>
                                <div class="total-value">$${totalAmount.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="payment-methods mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-credit-card me-2"></i>Payment Method
                </h6>
                <div class="payment-options">
                    <div class="form-check payment-option">
                        <input class="form-check-input" type="radio" name="paymentMethod" id="creditCardBooking" value="CREDIT_CARD" checked>
                        <label class="form-check-label" for="creditCardBooking">
                            <i class="fas fa-credit-card me-2"></i>Credit Card
                        </label>
                    </div>
                    <div class="form-check payment-option">
                        <input class="form-check-input" type="radio" name="paymentMethod" id="debitCardBooking" value="DEBIT_CARD">
                        <label class="form-check-label" for="debitCardBooking">
                            <i class="fas fa-money-check-alt me-2"></i>Debit Card
                        </label>
                    </div>
                    <div class="form-check payment-option">
                        <input class="form-check-input" type="radio" name="paymentMethod" id="digitalWalletBooking" value="DIGITAL_WALLET">
                        <label class="form-check-label" for="digitalWalletBooking">
                            <i class="fas fa-mobile-alt me-2"></i>Digital Wallet
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="payment-proof mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-upload me-2"></i>Payment Proof (Optional)
                </h6>
                <div class="mb-3">
                    <input type="file" class="form-control" id="paymentProofFileBooking" accept="image/*">
                    <div class="form-text">Upload payment receipt or proof (JPG, PNG, max 5MB)</div>
                </div>
            </div>
            
            <div class="payment-terms">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="agreeTermsBooking" required>
                    <label class="form-check-label" for="agreeTermsBooking">
                        I confirm that this payment is for Booking #${booking.id} and agree to the <a href="/terms" target="_blank">Terms and Conditions</a>
                    </label>
                </div>
            </div>
        </div>
    `;
    
    // Store current booking for payment
    window.currentPaymentBooking = booking;
    
    // Show modal
    const modal = new bootstrap.Modal(elements.paymentCompletionModal);
    modal.show();
    
    // Setup payment submission
    setupPaymentCompletionListeners();
}

// Setup payment completion listeners
function setupPaymentCompletionListeners() {
    elements.submitPaymentBtn.onclick = async function() {
        await processBookingPayment();
    };
}

// Process booking payment
async function processBookingPayment() {
    try {
        const booking = window.currentPaymentBooking;
        if (!booking) {
            throw new Error('No booking data available');
        }
        
        // Validate terms agreement
        const agreeTerms = document.getElementById('agreeTermsBooking');
        if (!agreeTerms.checked) {
            throw new Error('Please confirm the payment details and agree to the terms');
        }
        
        // Get selected payment method
        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selectedPaymentMethod) {
            throw new Error('Please select a payment method');
        }
        
        // Get payment proof file (optional)
        const paymentProofFile = document.getElementById('paymentProofFileBooking');
        let paymentProofImage = null;
        
        if (paymentProofFile.files.length > 0) {
            // Convert file to base64
            paymentProofImage = await fileToBase64(paymentProofFile.files[0]);
        }
        
        // Show loading state
        elements.submitPaymentBtn.disabled = true;
        elements.submitPaymentBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Processing Payment...
        `;
        
        // Use final amount (after coupon discount) for payment
        const amountToPay = finalAmountBooking || booking.total_price || 0;
        
        console.log('Payment Details:', {
            bookingId: booking.id,
            originalAmount: originalAmountBooking,
            discountAmount: discountAmountBooking,
            finalAmount: amountToPay,
            appliedCoupon: appliedCouponBooking,
            paymentMethod: selectedPaymentMethod.value
        });
        
        // Create payment via GraphQL mutation
        const paymentResult = await createPaymentForBooking(
            booking.id,
            selectedPaymentMethod.value,
            paymentProofImage,
            amountToPay  // Pass the discounted amount
        );
        
        if (paymentResult.success) {
            // IMPORTANT: Mark coupon as used after successful payment
            if (appliedCouponBooking && appliedCouponBooking.code) {
                try {
                    console.log(`Marking coupon ${appliedCouponBooking.code} as used...`);
                    
                    const markUsedResult = await AuthService.graphqlRequest(`
                        mutation {
                            markCouponUsed(code: "${appliedCouponBooking.code}") {
                                success
                                message
                            }
                        }
                    `, {}, true);
                    
                    if (markUsedResult.data?.markCouponUsed?.success) {
                        console.log(`✅ Coupon ${appliedCouponBooking.code} marked as used successfully`);
                    } else {
                        console.warn(`⚠️ Failed to mark coupon as used: ${markUsedResult.data?.markCouponUsed?.message}`);
                    }
                } catch (couponError) {
                    console.error('Error marking coupon as used:', couponError);
                    // Don't fail the payment if coupon marking fails
                }
            }
            
            // Close payment modal
            const paymentModal = bootstrap.Modal.getInstance(elements.paymentCompletionModal);
            paymentModal.hide();
            
            // Show success message with coupon info
            let successMessage = 'Payment successful! Your booking has been confirmed.';
            if (appliedCouponBooking) {
                successMessage += ` Coupon "${appliedCouponBooking.code}" applied with $${discountAmountBooking.toFixed(2)} discount.`;
            }
            
            AuthService.showMessage(successMessage, 'success');
            
            // Reload bookings data to show updated status
            setTimeout(() => {
                loadBookingsData();
            }, 1000);
            
        } else {
            throw new Error(paymentResult.message || 'Payment failed');
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        AuthService.showMessage(`Payment failed: ${error.message}`, 'error');
        
        // Reset button
        elements.submitPaymentBtn.disabled = false;
        elements.submitPaymentBtn.innerHTML = `
            <i class="fas fa-lock me-2"></i>Submit Payment
        `;
    }
}

async function createPaymentForBooking(bookingId, paymentMethod, paymentProofImage = null, customAmount = null) {
    try {
        const mutation = `
            mutation CreatePayment($bookingId: Int!, $paymentMethod: String!, $paymentProofImage: String) {
                createPayment(
                    bookingId: $bookingId, 
                    paymentMethod: $paymentMethod, 
                    paymentProofImage: $paymentProofImage
                ) {
                    payment {
                        id
                        userId
                        bookingId
                        amount
                        paymentMethod
                        status
                        paymentProofImage
                        createdAt
                        booking {
                            id
                            status
                            tickets {
                                id
                                seatNumber
                            }
                        }
                    }
                    success
                    message
                }
            }
        `;
        
        const variables = {
            bookingId: parseInt(bookingId),
            paymentMethod: paymentMethod,
            paymentProofImage: paymentProofImage
        };
        
        console.log('Creating payment with variables:', variables);
        console.log('Expected amount after discount:', customAmount);
        
        const result = await AuthService.graphqlRequest(mutation, variables, true);
        
        if (result.errors) {
            console.error('Payment creation errors:', result.errors);
            return {
                success: false,
                message: result.errors[0]?.message || 'Payment creation failed'
            };
        }
        
        if (result.data?.createPayment) {
            console.log('Payment created successfully:', result.data.createPayment);
            return {
                success: result.data.createPayment.success,
                payment: result.data.createPayment.payment,
                message: result.data.createPayment.message || 'Payment completed successfully'
            };
        } else {
            return {
                success: false,
                message: 'No payment data received'
            };
        }
        
    } catch (error) {
        console.error('Error creating payment:', error);
        return {
            success: false,
            message: error.message || 'Payment creation failed'
        };
    }
}

// Cancel booking
async function cancelBooking(bookingId) {
    try {
        console.log('Starting cancellation for booking:', bookingId);
        
        // Find booking
        const booking = enrichedBookings.find(b => b.id === bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }
        
        // UPDATED: Only allow cancellation for PENDING bookings
        if (booking.status !== 'PENDING') {
            throw new Error('Only pending bookings can be cancelled. Once payment is made, tickets cannot be cancelled.');
        }
        
        // Show cancellation confirmation modal
        showCancellationModal(booking);
        
    } catch (error) {
        console.error('Error starting cancellation:', error);
        AuthService.showMessage(`Error: ${error.message}`, 'error');
    }
}


// Show cancellation modal
function showCancellationModal(booking) {
    // Format booking details
    const showtimeDate = booking.showtime?.startTime ? new Date(booking.showtime.startTime) : null;
    const showtimeDateDisplay = showtimeDate ? showtimeDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'TBD';
    const showtimeTimeDisplay = showtimeDate ? showtimeDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'TBD';
    
    const seatNumbers = booking.tickets ? booking.tickets.map(t => t.seatNumber).join(', ') : 'N/A';
    
    elements.bookingCancelDetails.innerHTML = `
        <div class="cancel-booking-summary">
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Important:</strong> Bookings can only be cancelled before payment. Once payment is made, cancellation is not allowed. All associated tickets will be permanently deleted and seats will be made available for other customers.
            </div>
            <div class="summary-item">
                <strong>Booking ID:</strong> #${booking.id}
            </div>
            <div class="summary-item">
                <strong>Status:</strong> ${booking.status}
            </div>
            <div class="summary-item">
                <strong>Movie:</strong> ${booking.showtime?.movie?.title || 'Movie N/A'}
            </div>
            <div class="summary-item">
                <strong>Date & Time:</strong> ${showtimeDateDisplay} at ${showtimeTimeDisplay}
            </div>
            <div class="summary-item">
                <strong>Cinema:</strong> ${booking.showtime?.auditorium?.cinema?.name || 'Cinema N/A'}
            </div>
            <div class="summary-item">
                <strong>Seats:</strong> ${seatNumbers}
            </div>
            <div class="summary-item">
                <strong>Generated Tickets:</strong> ${booking.tickets ? booking.tickets.length : 0} ticket(s) will be deleted
            </div>
            <div class="summary-item">
                <strong>Amount:</strong> $${(booking.total_price || 0).toFixed(2)}
            </div>
            <div class="alert alert-info mt-3">
                <i class="fas fa-info-circle me-2"></i>
                After cancellation, the seats will become <strong>AVAILABLE</strong> again for other customers to book.
            </div>
        </div>
    `;
    
    // Store current booking for cancellation
    window.currentCancelBooking = booking;
    
    // Show modal
    const modal = new bootstrap.Modal(elements.cancelBookingModal);
    modal.show();
    
    // Setup cancellation confirmation
    elements.confirmCancelBookingBtn.onclick = async function() {
        await processCancellation();
    };
}

// Process cancellation
async function processCancellation() {
    try {
        const booking = window.currentCancelBooking;
        if (!booking) {
            throw new Error('No booking data available');
        }
        
        const reason = elements.cancellationReason.value.trim();
        
        // Show loading state
        elements.confirmCancelBookingBtn.disabled = true;
        elements.confirmCancelBookingBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Cancelling...
        `;
        
        // Delete booking via GraphQL mutation
        const cancelResult = await AuthService.graphqlRequest(
            BOOKING_MUTATIONS.DELETE_BOOKING,
            { id: booking.id },
            true
        );
        
        if (cancelResult.errors) {
            throw new Error(cancelResult.errors[0].message);
        }
        
        const cancelData = cancelResult.data.deleteBooking;
        if (!cancelData.success) {
            throw new Error(cancelData.message || 'Cancellation failed');
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(elements.cancelBookingModal);
        modal.hide();
        
        // Show success message
        AuthService.showMessage('Booking cancelled successfully. Any payments will be processed for refund.', 'success');
        
        // Reload bookings data
        setTimeout(() => {
            loadBookingsData();
        }, 1000);
        
    } catch (error) {
        console.error('Cancellation error:', error);
        AuthService.showMessage(`Cancellation failed: ${error.message}`, 'error');
        
        // Reset button
        elements.confirmCancelBookingBtn.disabled = false;
        elements.confirmCancelBookingBtn.innerHTML = `
            <i class="fas fa-times me-2"></i>Yes, Cancel Booking
        `;
    }
}
// Download ticket for confirmed bookings
async function downloadTicket(bookingId) {
    try {
        console.log('Starting ticket download for booking:', bookingId);
        
        // Find booking
        const booking = enrichedBookings.find(b => b.id === bookingId);
        if (!booking) {
            AuthService.showMessage('Booking not found', 'error');
            return;
        }
        
        // UPDATED: Only allow download for PAID or CONFIRMED bookings
        if (!['PAID', 'CONFIRMED'].includes(booking.status)) {
            AuthService.showMessage('Tickets can only be downloaded after payment is completed', 'warning');
            return;
        }
        
        // Check if tickets exist (they should always exist now)
        if (!booking.tickets || booking.tickets.length === 0) {
            AuthService.showMessage('No tickets found for this booking. Please contact support.', 'error');
            return;
        }
        
        // Generate ticket content
        const ticketContent = generateTicketContent(booking);
        
        // Create and download ticket
        downloadTicketAsPDF(ticketContent, `ticket-${booking.id}.html`);
        
        AuthService.showMessage('Ticket downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error downloading ticket:', error);
        AuthService.showMessage('Failed to download ticket. Please try again.', 'error');
    }
}

// Generate ticket content HTML
function generateTicketContent(booking) {
    const showtimeDate = booking.showtime?.startTime ? new Date(booking.showtime.startTime) : null;
    const showtimeDateDisplay = showtimeDate ? showtimeDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'TBD';
    const showtimeTimeDisplay = showtimeDate ? showtimeDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }) : 'TBD';
    
    const bookingDate = booking.booking_date ? new Date(booking.booking_date) : null;
    const bookingDateDisplay = bookingDate ? bookingDate.toLocaleDateString('en-US') : 'N/A';
    
    const seatNumbers = booking.tickets ? booking.tickets.map(t => t.seatNumber).join(', ') : 'N/A';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Movie Ticket - Booking #${booking.id}</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .ticket {
            background: white;
            border: 2px dashed #333;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .ticket-header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .cinema-logo {
            font-size: 24px;
            font-weight: bold;
            color: #ff4d4d;
        }
        .ticket-title {
            font-size: 18px;
            margin: 10px 0;
            color: #333;
        }
        .ticket-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .ticket-section {
            margin-bottom: 15px;
        }
        .section-title {
            font-weight: bold;
            color: #555;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .info-label {
            font-weight: bold;
            color: #666;
        }
        .info-value {
            color: #333;
        }
        .seats-section {
            grid-column: 1 / -1;
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .seat-numbers {
            font-size: 18px;
            font-weight: bold;
            color: #ff4d4d;
            margin: 10px 0;
        }
        .ticket-footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #333;
            font-size: 12px;
            color: #666;
        }
        .barcode {
            text-align: center;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            background: #000;
            color: white;
            padding: 10px;
            border-radius: 3px;
        }
        @media print {
            body { background: white; }
            .ticket { border: 2px solid #333; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="ticket">
        <div class="ticket-header">
            <div class="cinema-logo">🎬 CINEMA BOOKING SYSTEM</div>
            <div class="ticket-title">MOVIE TICKET</div>
            <div style="font-size: 12px; color: #666;">Booking ID: #${booking.id}</div>
        </div>
        
        <div class="ticket-content">
            <div class="ticket-section">
                <div class="section-title">MOVIE DETAILS</div>
                <div class="info-row">
                    <span class="info-label">Title:</span>
                    <span class="info-value">${booking.showtime?.movie?.title || 'Movie N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Genre:</span>
                    <span class="info-value">${booking.showtime?.movie?.genre || 'Unknown'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span class="info-value">${booking.showtime?.movie?.duration || 'N/A'} min</span>
                </div>
            </div>
            
            <div class="ticket-section">
                <div class="section-title">CINEMA DETAILS</div>
                <div class="info-row">
                    <span class="info-label">Cinema:</span>
                    <span class="info-value">${booking.showtime?.auditorium?.cinema?.name || 'Cinema N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Theater:</span>
                    <span class="info-value">${booking.showtime?.auditorium?.name || 'Theater N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Location:</span>
                    <span class="info-value">${booking.showtime?.auditorium?.cinema?.city || 'Unknown'}</span>
                </div>
            </div>
            
            <div class="ticket-section">
                <div class="section-title">SHOWTIME</div>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${showtimeDateDisplay}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Time:</span>
                    <span class="info-value">${showtimeTimeDisplay}</span>
                </div>
            </div>
            
            <div class="ticket-section">
                <div class="section-title">BOOKING INFO</div>
                <div class="info-row">
                    <span class="info-label">Booked:</span>
                    <span class="info-value">${bookingDateDisplay}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value">${booking.status}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total:</span>
                    <span class="info-value">$${(booking.total_price || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>
        
        <div class="seats-section">
            <div class="section-title">SEAT NUMBERS</div>
            <div class="seat-numbers">${seatNumbers}</div>
            <div style="font-size: 12px; color: #666;">Please arrive 15 minutes before showtime</div>
        </div>
        
        <div class="barcode">
            ||||| |||| | |||| ||||| || ||| |||||| |||| | BOOKING-${booking.id} ||||| |||| | |||| ||||| || ||| ||||||
        </div>
        
        <div class="ticket-footer">
            <div>Thank you for choosing our cinema!</div>
            <div>This ticket is valid only for the specified showtime and seats.</div>
            <div>Generated on ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}</div>
        </div>
    </div>
</body>
</html>
    `;
}

// Download ticket as HTML file
function downloadTicketAsPDF(content, filename) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            reject(new Error('File size too large. Maximum 5MB allowed.'));
            return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Handle login requirement
function handleLoginRequired(event, contentType) {
    if (event) event.preventDefault();
    
    AuthService.showMessage(`Please login to access ${contentType}`, 'info');
    
    // Show a modal or redirect to login after a short delay
    setTimeout(() => {
        const confirmLogin = confirm(`You need to login to view ${contentType}. Go to login page now?`);
        if (confirmLogin) {
            window.location.href = '/login?returnUrl=/bookings';
        }
    }, 1000);
}

// Utility function for debouncing
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

// NEW: Global variables for coupon in bookings
let appliedCouponBooking = null;
let originalAmountBooking = 0;
let discountAmountBooking = 0;
let finalAmountBooking = 0;

// Show payment completion modal
function showPaymentCompletionModal(booking) {
    appliedCouponBooking = null;
    originalAmountBooking = 0;
    discountAmountBooking = 0;
    finalAmountBooking = 0;
    // Calculate seat count and total
    const seatCount = booking.tickets ? booking.tickets.length : 0;
    const totalAmount = booking.total_price || 0;
    const pricePerSeat = booking.showtime?.price || 0;
    
    // Seats display
    const seatNumbers = booking.tickets ? booking.tickets.map(t => t.seatNumber).join(', ') : 'N/A';
    
    elements.modalPaymentCompletionContent.innerHTML = `
        <div class="payment-completion-content">
            <div class="payment-summary mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-receipt me-2"></i>Payment Summary
                </h6>
                <div class="summary-card">
                    <div class="row">
                        <div class="col-md-8">
                            <div class="summary-details">
                                <div class="detail-row">
                                    <span class="label">Booking ID:</span>
                                    <span class="value">#${booking.id}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Movie:</span>
                                    <span class="value">${booking.showtime?.movie?.title || 'Movie N/A'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Seats:</span>
                                    <span class="value">${seatNumbers}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Seat Count:</span>
                                    <span class="value">${seatCount} seat(s)</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Price per Seat:</span>
                                    <span class="value">$${pricePerSeat.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 text-end">
                            <div class="total-display">
                                <div class="total-label">Original Amount</div>
                                <div class="total-value" id="original-amount-booking">$${totalAmount.toFixed(2)}</div>
                                <div class="discount-info" id="discount-info-booking" style="display: none;">
                                    <div class="discount-label">Discount</div>
                                    <div class="discount-value" id="discount-value-booking">$0.00</div>
                                </div>
                                <div class="final-total-label">Final Total</div>
                                <div class="final-total-value" id="final-total-booking">$${totalAmount.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- NEW: Coupon Redemption Section for Bookings -->
            <div class="coupon-section mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-tags me-2"></i>Apply Coupon (Optional)
                </h6>
                <div class="coupon-input-group">
                    <div class="row">
                        <div class="col-md-8">
                            <input type="text" class="form-control" id="couponCodeBooking" 
                                   placeholder="Enter coupon code (e.g., LOYALTY1_3_ABC123)" 
                                   maxlength="50">
                            <div class="form-text">Have a coupon? Enter the code above to get discount</div>
                        </div>
                        <div class="col-md-4">
                            <button type="button" class="btn btn-outline-primary w-100" id="applyCouponBtnBooking">
                                <i class="fas fa-tag me-2"></i>Apply Coupon
                            </button>
                        </div>
                    </div>
                    <div class="coupon-status mt-2" id="couponStatusBooking" style="display: none;"></div>
                </div>
            </div>
            
            <div class="payment-methods mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-credit-card me-2"></i>Payment Method
                </h6>
                <div class="payment-options">
                    <div class="form-check payment-option">
                        <input class="form-check-input" type="radio" name="paymentMethod" id="creditCardBooking" value="CREDIT_CARD" checked>
                        <label class="form-check-label" for="creditCardBooking">
                            <i class="fas fa-credit-card me-2"></i>Credit Card
                        </label>
                    </div>
                    <div class="form-check payment-option">
                        <input class="form-check-input" type="radio" name="paymentMethod" id="debitCardBooking" value="DEBIT_CARD">
                        <label class="form-check-label" for="debitCardBooking">
                            <i class="fas fa-money-check-alt me-2"></i>Debit Card
                        </label>
                    </div>
                    <div class="form-check payment-option">
                        <input class="form-check-input" type="radio" name="paymentMethod" id="digitalWalletBooking" value="DIGITAL_WALLET">
                        <label class="form-check-label" for="digitalWalletBooking">
                            <i class="fas fa-mobile-alt me-2"></i>Digital Wallet
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="payment-proof mb-4">
                <h6 class="mb-3">
                    <i class="fas fa-upload me-2"></i>Payment Proof (Optional)
                </h6>
                <div class="mb-3">
                    <input type="file" class="form-control" id="paymentProofFileBooking" accept="image/*">
                    <div class="form-text">Upload payment receipt or proof (JPG, PNG, max 5MB)</div>
                </div>
            </div>
            
            <div class="payment-terms">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="agreeTermsBooking" required>
                    <label class="form-check-label" for="agreeTermsBooking">
                        I confirm that this payment is for Booking #${booking.id} and agree to the <a href="/terms" target="_blank">Terms and Conditions</a>
                    </label>
                </div>
            </div>
        </div>
    `;
    
    // Store current booking for payment
    window.currentPaymentBooking = booking;
    
    // Show modal
    const modal = new bootstrap.Modal(elements.paymentCompletionModal);
    modal.show();
    
    // Setup payment submission and coupon listeners
    setupPaymentCompletionListeners();
    setupCouponListenersBooking(booking); // NEW: Setup coupon listeners
}

// NEW: Setup coupon application listeners for bookings
function setupCouponListenersBooking(booking) {
    const applyCouponBtn = document.getElementById('applyCouponBtnBooking');
    const couponCodeInput = document.getElementById('couponCodeBooking');
    const couponStatus = document.getElementById('couponStatusBooking');
    
    // Initialize amounts
    originalAmountBooking = booking.total_price || 0;
    finalAmountBooking = originalAmountBooking;
    
    if (applyCouponBtn) {
        applyCouponBtn.onclick = async function() {
            await applyCouponBooking();
        };
    }
    
    // Allow applying coupon with Enter key
    if (couponCodeInput) {
        couponCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyCouponBooking();
            }
        });
    }
}

// NEW: Apply coupon function for bookings
async function applyCouponBooking() {
    const couponCodeInput = document.getElementById('couponCodeBooking');
    const applyCouponBtn = document.getElementById('applyCouponBtnBooking');
    const couponStatus = document.getElementById('couponStatusBooking');
    
    if (!couponCodeInput || !applyCouponBtn || !couponStatus) {
        console.error('Coupon elements not found');
        return;
    }
    
    const couponCode = couponCodeInput.value.trim();
    
    if (!couponCode) {
        showCouponStatusBooking('Please enter a coupon code', 'error');
        return;
    }
    
    try {
        // Show loading state
        applyCouponBtn.disabled = true;
        applyCouponBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Applying...
        `;
        
        // Call GraphQL mutation to use coupon
        const result = await AuthService.graphqlRequest(`
            mutation {
                useCoupon(code: "${couponCode}", bookingAmount: ${originalAmountBooking}) {
                    success
                    message
                    discountAmount
                }
            }
        `, {}, true);
        
        if (result.data?.useCoupon?.success) {
            // Successfully applied coupon
            appliedCouponBooking = {
                code: couponCode,
                discountAmount: result.data.useCoupon.discountAmount,
                message: result.data.useCoupon.message
            };
            
            discountAmountBooking = result.data.useCoupon.discountAmount;
            finalAmountBooking = originalAmountBooking - discountAmountBooking;
            
            // Update UI
            updatePaymentAmountsBooking();
            showCouponStatusBooking(result.data.useCoupon.message, 'success');
            
            // Disable input and button after successful application
            couponCodeInput.disabled = true;
            applyCouponBtn.innerHTML = `<i class="fas fa-check me-2"></i>Applied`;
            applyCouponBtn.classList.remove('btn-outline-primary');
            applyCouponBtn.classList.add('btn-success');
            
            // Add remove coupon button
            addRemoveCouponButtonBooking();
            
        } else {
            // Failed to apply coupon
            showCouponStatusBooking(result.data?.useCoupon?.message || 'Failed to apply coupon', 'error');
        }
        
    } catch (error) {
        console.error('Error applying coupon:', error);
        showCouponStatusBooking('Error applying coupon. Please try again.', 'error');
    } finally {
        // Reset button if not successful
        if (!appliedCouponBooking) {
            applyCouponBtn.disabled = false;
            applyCouponBtn.innerHTML = `<i class="fas fa-tag me-2"></i>Apply Coupon`;
        }
    }
}

// NEW: Update payment amounts in UI for bookings
function updatePaymentAmountsBooking() {
    const originalAmountEl = document.getElementById('original-amount-booking');
    const discountInfoEl = document.getElementById('discount-info-booking');
    const discountValueEl = document.getElementById('discount-value-booking');
    const finalTotalEl = document.getElementById('final-total-booking');
    
    if (originalAmountEl) {
        originalAmountEl.textContent = `$${originalAmountBooking.toFixed(2)}`;
    }
    
    if (discountAmountBooking > 0) {
        if (discountInfoEl) {
            discountInfoEl.style.display = 'block';
        }
        if (discountValueEl) {
            discountValueEl.textContent = `-$${discountAmountBooking.toFixed(2)}`;
        }
    } else {
        if (discountInfoEl) {
            discountInfoEl.style.display = 'none';
        }
    }
    
    if (finalTotalEl) {
        finalTotalEl.textContent = `$${finalAmountBooking.toFixed(2)}`;
        // Update current payment booking data
        if (window.currentPaymentBooking) {
            window.currentPaymentBooking.finalAmount = finalAmountBooking;
            window.currentPaymentBooking.appliedCoupon = appliedCouponBooking;
        }
    }
}

// NEW: Show coupon status message for bookings
function showCouponStatusBooking(message, type) {
    const couponStatus = document.getElementById('couponStatusBooking');
    if (!couponStatus) return;
    
    couponStatus.style.display = 'block';
    couponStatus.className = `coupon-status mt-2 alert alert-${type === 'success' ? 'success' : 'danger'}`;
    couponStatus.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
        ${message}
    `;
    
    // Auto-hide error messages after 5 seconds
    if (type === 'error') {
        setTimeout(() => {
            couponStatus.style.display = 'none';
        }, 5000);
    }
}

// NEW: Add remove coupon button for bookings
function addRemoveCouponButtonBooking() {
    const couponInputGroup = document.querySelector('#paymentCompletionModal .coupon-input-group .row .col-md-4');
    if (couponInputGroup) {
        couponInputGroup.innerHTML += `
            <button type="button" class="btn btn-outline-danger w-100 mt-2" id="removeCouponBtnBooking">
                <i class="fas fa-times me-2"></i>Remove Coupon
            </button>
        `;
        
        // Setup remove coupon listener
        const removeCouponBtn = document.getElementById('removeCouponBtnBooking');
        if (removeCouponBtn) {
            removeCouponBtn.onclick = function() {
                removeCouponBooking();
            };
        }
    }
}

// NEW: Remove applied coupon for bookings
function removeCouponBooking() {
    const couponCodeInput = document.getElementById('couponCodeBooking');
    const applyCouponBtn = document.getElementById('applyCouponBtnBooking');
    const couponStatus = document.getElementById('couponStatusBooking');
    const removeCouponBtn = document.getElementById('removeCouponBtnBooking');
    
    // Reset coupon data
    appliedCouponBooking = null;
    discountAmountBooking = 0;
    finalAmountBooking = originalAmountBooking;
    
    // Reset UI
    if (couponCodeInput) {
        couponCodeInput.value = '';
        couponCodeInput.disabled = false;
    }
    
    if (applyCouponBtn) {
        applyCouponBtn.disabled = false;
        applyCouponBtn.innerHTML = `<i class="fas fa-tag me-2"></i>Apply Coupon`;
        applyCouponBtn.classList.remove('btn-success');
        applyCouponBtn.classList.add('btn-outline-primary');
    }
    
    if (removeCouponBtn) {
        removeCouponBtn.remove();
    }
    
    if (couponStatus) {
        couponStatus.style.display = 'none';
    }
    
    // Update amounts
    updatePaymentAmountsBooking();
}

// Global functions for inline event handlers
window.showBookingDetail = showBookingDetail;
window.completePayment = completePayment;
window.cancelBooking = cancelBooking;
window.downloadTicket = downloadTicket;
window.changePage = changePage;
window.handleLoginRequired = handleLoginRequired;

// Export for testing and debugging
window.BookingsPage = {
    BOOKING_FIELDS,
    BOOKING_QUERIES,
    BOOKING_MUTATIONS,
    loadBookingsData,
    renderBookings,
    createBookingCard,
    createBookingTableRow,
    showBookingDetail,
    completePayment,
    cancelBooking,
    downloadTicket,
    applyFilters,
    clearAllFilters,
    switchView,
    changePage
};

console.log('Bookings.js loaded successfully with full schema consistency');
