/**
 * Showtimes Page JavaScript
 * Konsisten dengan schema.py GraphQL types dan cinema-service schema
 * 
 * Schema mappings yang HARUS diikuti dari gateway/schema.py:
 * - ShowtimeType: { id, movie_id, auditorium_id, start_time, price, movie, auditorium }
 * - MovieType: { id, title, genre, duration, description, releaseDate, posterUrl, rating }
 * - AuditoriumType: { id, cinema_id, name, seat_layout, cinema }
 * - Query: { showtimes, seatStatuses(showtimeId) }
 */

// KONSISTEN DENGAN SCHEMA.PY - Field names sesuai gateway schema
const SHOWTIME_FIELDS = {
    id: 'id',
    movieId: 'movieId',
    auditoriumId: 'auditoriumId', 
    startTime: 'startTime',
    price: 'price',
    movie: 'movie',
    auditorium: 'auditorium'
};

// GraphQL Queries sesuai gateway/schema.py - PUBLIC ACCESS
const SHOWTIME_QUERIES = {
    GET_SHOWTIMES: `
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
    `,
    GET_SEAT_STATUSES: `
        query GetSeatStatuses($showtimeId: Int!) {
            seatStatuses(showtimeId: $showtimeId) {
                id
                showtimeId
                seatNumber
                status
                bookingId
                updatedAt
            }
        }
    `,
    GET_AUDITORIUM_LAYOUT: `
        query GetAuditoriumLayout($auditoriumId: Int!) {
            auditorium(id: $auditoriumId) {
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
    `,
    GET_MOVIES: `
        query GetMovies {
            publicMovies {
                id
                title
                genre
                duration
                posterUrl
                rating
                description
            }
        }
    `,
    GET_CINEMAS: `
        query GetCinemas {
            publicCinemas {
                id
                name
                city
                capacity
            }
        }
    `
};


// Global state variables
let allShowtimes = [];
let filteredShowtimes = [];
let allMovies = [];
let allCinemas = [];
let currentPage = 1;
const showtimesPerPage = 12;
let currentView = 'grid'; // 'grid' or 'timeline'
let currentFilters = {
    movie: '',
    cinema: '',
    date: '',
    time: '',
    search: '',
    sort: 'time'
};
let isLoggedIn = false;
let selectedSeats = [];
let currentShowtimeId = null;
let currentShowtimePrice = 0;

// DOM Elements cache
let elements = {};

// DOM ready initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Showtimes page initializing...');
    
    // Cache DOM elements
    cacheElements();
    
    // Initialize authentication state
    isLoggedIn = AuthService.isLoggedIn();
    updateNavigation();
    
    // Initialize page
    initializeShowtimesPage();
    
    console.log('Showtimes page initialized successfully');
});

// Cache frequently used DOM elements
function cacheElements() {
    elements = {
        // Containers
        loadingContainer: document.getElementById('loading-container'),
        showtimesGrid: document.getElementById('showtimes-grid'),
        showtimesTimeline: document.getElementById('showtimes-timeline'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        paginationContainer: document.getElementById('pagination-container'),
        dateNavigation: document.getElementById('date-navigation'),
        
        // Filters
        movieFilter: document.getElementById('movie-filter'),
        cinemaFilter: document.getElementById('cinema-filter'),
        dateFilter: document.getElementById('date-filter'),
        timeFilter: document.getElementById('time-filter'),
        sortFilter: document.getElementById('sort-filter'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search'),
        applyFiltersBtn: document.getElementById('apply-filters'),
        clearFiltersBtn: document.getElementById('clear-filters'),
        todayFilterBtn: document.getElementById('today-filter'),
        resetFiltersBtn: document.getElementById('reset-filters'),
        
        // View controls
        gridViewBtn: document.getElementById('grid-view'),
        timelineViewBtn: document.getElementById('timeline-view'),
        
        // Pagination
        paginationInfo: document.getElementById('pagination-info'),
        paginationControls: document.getElementById('pagination-controls'),
        showingStart: document.getElementById('showing-start'),
        showingEnd: document.getElementById('showing-end'),
        totalShowtimes: document.getElementById('total-showtimes'),
        
        // Count and date navigation
        showtimeCount: document.getElementById('showtime-count'),
        dateButtons: document.getElementById('date-buttons'),
        
        // Modals
        showtimeDetailModal: document.getElementById('showtimeDetailModal'),
        modalShowtimeContent: document.getElementById('modal-showtime-content'),
        bookSeatsBtn: document.getElementById('book-seats-btn'),
        
        seatSelectionModal: document.getElementById('seatSelectionModal'),
        modalSeatContent: document.getElementById('modal-seat-content'),
        selectedSeatsDisplay: document.getElementById('selected-seats-display'),
        totalPriceDisplay: document.getElementById('total-price-display'),
        proceedBookingBtn: document.getElementById('proceed-booking-btn'),
        
        // Error handling
        errorMessage: document.getElementById('error-message'),
        retryLoadBtn: document.getElementById('retry-load'),

        // Booking confirmation modal
        bookingConfirmationModal: document.getElementById('bookingConfirmationModal'),
        modalBookingContent: document.getElementById('modal-booking-content'),
        proceedPaymentBtn: document.getElementById('proceed-payment-btn'),
        viewBookingsBtn: document.getElementById('view-bookings-btn'),
        
        // Payment modal
        paymentModal: document.getElementById('paymentModal'),
        modalPaymentContent: document.getElementById('modal-payment-content'),
        completePaymentBtn: document.getElementById('complete-payment-btn'),
    };
}

// Initialize the showtimes page
function initializeShowtimesPage() {
    try {
        console.log('Initializing showtimes page...');
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup view controls
        setupViewControls();
        
        // Setup filters
        setupFilters();
        
        // Setup date picker
        setupDatePicker();
        
        // Check URL parameters for pre-filtering
        handleUrlParameters();
        
        // Load initial data with connection check
        loadInitialData();
        
    } catch (error) {
        console.error('Error initializing showtimes page:', error);
        showErrorState(`Failed to initialize page: ${error.message}`);
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Filter controls
    elements.movieFilter.addEventListener('change', handleFilterChange);
    elements.cinemaFilter.addEventListener('change', handleFilterChange);
    elements.dateFilter.addEventListener('change', handleFilterChange);
    elements.timeFilter.addEventListener('change', handleFilterChange);
    elements.sortFilter.addEventListener('change', handleFilterChange);
    elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    elements.applyFiltersBtn.addEventListener('click', applyFilters);
    elements.clearFiltersBtn.addEventListener('click', clearAllFilters);
    elements.todayFilterBtn.addEventListener('click', setTodayFilter);
    elements.resetFiltersBtn.addEventListener('click', clearAllFilters);
    
    // View controls
    elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    elements.timelineViewBtn.addEventListener('click', () => switchView('timeline'));
    
    // Modal controls
    elements.bookSeatsBtn.addEventListener('click', handleBookSeats);
    elements.proceedBookingBtn.addEventListener('click', handleProceedBooking);
    
    // New modal event listeners will be set up dynamically in their respective functions


    // Error handling
    elements.retryLoadBtn.addEventListener('click', loadInitialData);
    
    // Search input enter key
    elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
}

// Load initial data (movies, cinemas, showtimes)
async function loadInitialData() {
    try {
        showLoadingState();
        
        console.log('Loading initial data for showtimes page...');
        
        // Load movies and cinemas for filters (parallel loading)
        const [movies, cinemas] = await Promise.all([
            loadMoviesForFilter(),
            loadCinemasForFilter()
        ]);
        
        console.log('Movies loaded:', movies.length);
        console.log('Cinemas loaded:', cinemas.length);
        
        // Populate filter dropdowns
        populateMovieOptions(movies);
        populateCinemaOptions(cinemas);
        
        // FIXED: Use getShowtimesForDisplay method
        console.log('Fetching showtimes...');
        const showtimes = await AuthService.getShowtimesForDisplay();
        
        console.log('Raw showtimes response:', showtimes);
        console.log('Showtimes length:', showtimes ? showtimes.length : 0);
        console.log('First showtime sample:', showtimes && showtimes[0] ? showtimes[0] : 'None');
        
        if (showtimes && showtimes.length > 0) {
            allShowtimes = showtimes;
            updateShowtimeCount(allShowtimes.length);
            console.log('allShowtimes set with length:', allShowtimes.length);
            applyFilters();
        } else {
            console.warn('No showtimes received - checking details:');
            console.log('- showtimes variable:', showtimes);
            console.log('- showtimes type:', typeof showtimes);
            console.log('- showtimes array check:', Array.isArray(showtimes));
            allShowtimes = [];
            showEmptyState();
        }
        
        // Setup date navigation
        setupDateNavigation();
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        showErrorState(`Failed to load showtimes data: ${error.message}`);
    }
}

// Load movies for filter dropdown
async function loadMoviesForFilter() {
    try {
        const movies = await AuthService.getMoviesForDisplay();
        allMovies = movies || [];
        console.log('Movies for filter loaded:', allMovies.length);
        return allMovies;
    } catch (error) {
        console.error('Error loading movies for filter:', error);
        return [];
    }
}

// Load cinemas for filter dropdown
async function loadCinemasForFilter() {
    try {
        const cinemas = await AuthService.getCinemasForDisplay();
        allCinemas = cinemas || [];
        console.log('Cinemas for filter loaded:', allCinemas.length);
        return allCinemas;
    } catch (error) {
        console.error('Error loading cinemas for filter:', error);
        return [];
    }
}

// Load showtimes from API - PUBLIC ACCESS
async function loadShowtimes(movieId = null, auditoriumId = null) {
    try {
        console.log('Loading showtimes from GraphQL API...');
        
        // FIXED: Use snake_case parameter names to match schema
        const variables = {};
        if (movieId) variables.movieId = parseInt(movieId);
        if (auditoriumId) variables.auditoriumId = parseInt(auditoriumId);
        
        console.log('Showtimes query variables:', variables);
        
        const result = await AuthService.graphqlRequest(SHOWTIME_QUERIES.GET_SHOWTIMES, variables, false);
        
        console.log('Raw showtimes result:', result);
        
        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            throw new Error(result.errors[0].message);
        }
        
        const showtimes = result.data?.showtimes || [];
        
        console.log('Showtimes loaded successfully:', showtimes.length, 'showtimes');
        
        if (showtimes.length > 0) {
            allShowtimes = showtimes;
            
            // Update showtime count
            updateShowtimeCount(allShowtimes.length);
            
            // Apply initial filters and render
            applyFilters();
            
        } else {
            console.warn('No showtimes data received');
            allShowtimes = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading showtimes:', error);
        console.error('Error details:', error.message);
        showErrorState(`Failed to load showtimes: ${error.message}`);
    }
}

// Show loading state
function showLoadingState() {
    elements.loadingContainer.style.display = 'block';
    elements.showtimesGrid.style.display = 'none';
    elements.showtimesTimeline.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
    elements.dateNavigation.style.display = 'none';
}

// Show error state
function showErrorState(message = 'An error occurred') {
    elements.loadingContainer.style.display = 'none';
    elements.showtimesGrid.style.display = 'none';
    elements.showtimesTimeline.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'block';
    elements.paginationContainer.style.display = 'none';
    elements.dateNavigation.style.display = 'none';
    
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
}

// Show empty state
function showEmptyState() {
    elements.loadingContainer.style.display = 'none';
    elements.showtimesGrid.style.display = 'none';
    elements.showtimesTimeline.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
    elements.dateNavigation.style.display = 'none';
}

// Update showtime count badge
function updateShowtimeCount(count) {
    elements.showtimeCount.innerHTML = `<i class="fas fa-clock me-1"></i>${count} Showtimes`;
}

// Handle filter changes
function handleFilterChange() {
    currentFilters.movie = elements.movieFilter.value;
    currentFilters.cinema = elements.cinemaFilter.value;
    currentFilters.date = elements.dateFilter.value;
    currentFilters.time = elements.timeFilter.value;
    currentFilters.sort = elements.sortFilter.value;
    
    // Auto-apply filters on change
    applyFilters();
}

// Handle search input with debouncing
function handleSearchInput() {
    currentFilters.search = elements.searchInput.value.trim();
    applyFilters();
}

// Clear search
function clearSearch() {
    elements.searchInput.value = '';
    currentFilters.search = '';
    applyFilters();
}

// Set today filter
function setTodayFilter() {
    const today = new Date().toISOString().split('T')[0];
    elements.dateFilter.value = today;
    currentFilters.date = today;
    applyFilters();
}

// Apply all filters
function applyFilters() {
    try {
        // Start with all showtimes
        let filtered = [...allShowtimes];
        
        console.log('Starting filter with showtimes:', filtered.length);
        
        // Apply movie filter
        if (currentFilters.movie) {
            filtered = filtered.filter(showtime => {
                const movieId = showtime.movie?.id || showtime.movieId;
                return movieId == currentFilters.movie;
            });
            console.log('After movie filter:', filtered.length);
        }
        
        // Apply cinema filter
        if (currentFilters.cinema) {
            filtered = filtered.filter(showtime => {
                const cinemaId = showtime.auditorium?.cinema?.id;
                return cinemaId == currentFilters.cinema;
            });
            console.log('After cinema filter:', filtered.length);
        }
        
        // FIXED: Enhanced date filtering with better datetime parsing
        if (currentFilters.date) {
            filtered = filtered.filter(showtime => {
                if (!showtime.startTime) return false;
                
                try {
                    let dateTimeStr = showtime.startTime;
                    if (typeof dateTimeStr === 'string') {
                        dateTimeStr = dateTimeStr.replace(/['"]/g, '');
                    }
                    
                    const showtimeDate = new Date(dateTimeStr);
                    if (isNaN(showtimeDate.getTime())) return false;
                    
                    const filterDate = new Date(currentFilters.date);
                    return showtimeDate.toISOString().split('T')[0] === filterDate.toISOString().split('T')[0];
                } catch (error) {
                    console.error('Error parsing date for filtering:', error);
                    return false;
                }
            });
            console.log('After date filter:', filtered.length);
        }
        
        // FIXED: Enhanced time filtering with better datetime parsing
        if (currentFilters.time) {
            filtered = filtered.filter(showtime => {
                if (!showtime.startTime) return false;
                
                try {
                    let dateTimeStr = showtime.startTime;
                    if (typeof dateTimeStr === 'string') {
                        dateTimeStr = dateTimeStr.replace(/['"]/g, '');
                    }
                    
                    const showtimeDate = new Date(dateTimeStr);
                    if (isNaN(showtimeDate.getTime())) return false;
                    
                    const showtimeHour = showtimeDate.getHours();
                    
                    switch (currentFilters.time) {
                        case 'morning':
                            return showtimeHour >= 6 && showtimeHour < 12;
                        case 'afternoon':
                            return showtimeHour >= 12 && showtimeHour < 18;
                        case 'evening':
                            return showtimeHour >= 18 && showtimeHour <= 23;
                        default:
                            return true;
                    }
                } catch (error) {
                    console.error('Error parsing time for filtering:', error);
                    return false;
                }
            });
            console.log('After time filter:', filtered.length);
        }
        
        // Apply search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            filtered = filtered.filter(showtime => 
                (showtime.movie && showtime.movie.title && showtime.movie.title.toLowerCase().includes(searchTerm)) ||
                (showtime.auditorium && showtime.auditorium.cinema && showtime.auditorium.cinema.name && 
                 showtime.auditorium.cinema.name.toLowerCase().includes(searchTerm)) ||
                (showtime.auditorium && showtime.auditorium.name && showtime.auditorium.name.toLowerCase().includes(searchTerm))
            );
            console.log('After search filter:', filtered.length);
        }
        
        // Apply sorting
        filtered = sortShowtimes(filtered, currentFilters.sort);
        
        filteredShowtimes = filtered;
        currentPage = 1; // Reset to first page
        
        console.log('Filters applied successfully:', {
            total: allShowtimes.length,
            filtered: filteredShowtimes.length,
            filters: currentFilters
        });
        
        renderShowtimes();
        
    } catch (error) {
        console.error('Error applying filters:', error);
        showErrorState('Error filtering showtimes');
    }
}

// Sort showtimes based on criteria
function sortShowtimes(showtimes, sortBy) {
    const sorted = [...showtimes];
    
    switch (sortBy) {
        case 'time':
            return sorted.sort((a, b) => 
                new Date(a.startTime || 0) - new Date(b.startTime || 0)
            );
        case 'movie':
            return sorted.sort((a, b) => 
                (a.movie?.title || '').localeCompare(b.movie?.title || '')
            );
        case 'cinema':
            return sorted.sort((a, b) => 
                (a.auditorium?.cinema?.name || '').localeCompare(b.auditorium?.cinema?.name || '')
            );
        case 'price':
            return sorted.sort((a, b) => 
                (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0)
            );
        default:
            return sorted;
    }
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {
        movie: '',
        cinema: '',
        date: '',
        time: '',
        search: '',
        sort: 'time'
    };
    
    // Reset form controls
    elements.movieFilter.value = '';
    elements.cinemaFilter.value = '';
    elements.dateFilter.value = '';
    elements.timeFilter.value = '';
    elements.sortFilter.value = 'time';
    elements.searchInput.value = '';
    
    // Apply filters
    applyFilters();
}

// Render showtimes based on current view and pagination
function renderShowtimes() {
    if (filteredShowtimes.length === 0) {
        showEmptyState();
        return;
    }
    
    // Hide loading and error states
    elements.loadingContainer.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    
    // Show date navigation if we have showtimes
    elements.dateNavigation.style.display = 'block';
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredShowtimes.length / showtimesPerPage);
    const startIndex = (currentPage - 1) * showtimesPerPage;
    const endIndex = Math.min(startIndex + showtimesPerPage, filteredShowtimes.length);
    const currentShowtimes = filteredShowtimes.slice(startIndex, endIndex);
    
    // Render based on current view
    if (currentView === 'grid') {
        renderGridView(currentShowtimes);
    } else {
        renderTimelineView(currentShowtimes);
    }
    
    // Update pagination
    updatePagination(startIndex + 1, endIndex, filteredShowtimes.length, totalPages);
}

// Render grid view
function renderGridView(showtimes) {
    elements.showtimesGrid.style.display = 'flex';
    elements.showtimesTimeline.style.display = 'none';
    elements.paginationContainer.style.display = 'block';
    
    elements.showtimesGrid.innerHTML = '';
    
    showtimes.forEach((showtime, index) => {
        const showtimeCard = createShowtimeCard(showtime, index);
        elements.showtimesGrid.appendChild(showtimeCard);
    });
    
    // Add animation classes
    setTimeout(() => {
        elements.showtimesGrid.querySelectorAll('.showtime-card').forEach((card, index) => {
            card.classList.add('animate-fade-in-up');
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }, 50);
}

// Render timeline view
function renderTimelineView(showtimes) {
    elements.showtimesGrid.style.display = 'none';
    elements.showtimesTimeline.style.display = 'block';
    elements.paginationContainer.style.display = 'block';
    
    elements.showtimesTimeline.innerHTML = '';
    
    // Group showtimes by date
    const groupedShowtimes = groupShowtimesByDate(showtimes);
    
    Object.keys(groupedShowtimes).sort().forEach(date => {
        const timelineSection = createTimelineSection(date, groupedShowtimes[date]);
        elements.showtimesTimeline.appendChild(timelineSection);
    });
}

// Group showtimes by date
function groupShowtimesByDate(showtimes) {
    const grouped = {};
    
    showtimes.forEach(showtime => {
        if (showtime.startTime) {
            const date = new Date(showtime.startTime).toISOString().split('T')[0];
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(showtime);
        }
    });
    
    return grouped;
}

// Create showtime card for grid view
function createShowtimeCard(showtime, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 col-sm-6 mb-4';
    
    // FIXED: Enhanced datetime parsing to handle different formats
    let startTime = null;
    if (showtime.startTime) {
        try {
            // Handle string datetime from backend
            let dateTimeStr = showtime.startTime;
            
            // Remove quotes if present
            if (typeof dateTimeStr === 'string') {
                dateTimeStr = dateTimeStr.replace(/['"]/g, '');
            }
            
            startTime = new Date(dateTimeStr);
            
            // Validate the date
            if (isNaN(startTime.getTime())) {
                console.warn('Invalid datetime for showtime:', showtime.id, dateTimeStr);
                startTime = null;
            }
        } catch (error) {
            console.error('Error parsing datetime for showtime:', showtime.id, error);
            startTime = null;
        }
    }
    
    const timeDisplay = startTime ? startTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }) : 'TBD';
    const dateDisplay = startTime ? startTime.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    }) : 'TBD';
    
    // Rest of the function remains the same...
    const posterUrl = showtime.movie?.posterUrl || 'https://via.placeholder.com/300x200/e2e8f0/64748b?text=No+Poster';
    const buttonOnClick = `onclick="showShowtimeDetail(${showtime.id})"`;
    
    col.innerHTML = `
        <div class="card showtime-card h-100" data-showtime-id="${showtime.id}">
            <div class="showtime-image-container position-relative">
                <img src="${posterUrl}" class="showtime-image" alt="${showtime.movie?.title || 'Movie'}">
                <div class="showtime-time-badge">
                    <span class="badge bg-primary">
                        <i class="fas fa-clock me-1"></i>${timeDisplay}
                    </span>
                </div>
                <div class="showtime-price-badge">
                    <span class="price-tag">
                        $${showtime.price ? parseFloat(showtime.price).toFixed(2) : '0.00'}
                    </span>
                </div>
            </div>
            <div class="card-body">
                <h5 class="card-title">${showtime.movie?.title || 'Unknown Movie'}</h5>
                <div class="showtime-meta mb-2">
                    <span class="cinema-badge">
                        <i class="fas fa-building me-1"></i>${showtime.auditorium?.cinema?.name || 'Unknown Cinema'}
                    </span>
                    <span class="auditorium-badge">
                        <i class="fas fa-door-open me-1"></i>${showtime.auditorium?.name || 'Unknown Hall'}
                    </span>
                </div>
                <div class="showtime-details">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>${dateDisplay}
                        </small>
                        <div class="genre-info">
                            ${showtime.movie?.genre ? `<span class="genre-tag">${showtime.movie.genre}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-view w-100" ${buttonOnClick}>
                    <i class="fas fa-ticket-alt me-2"></i>
                    ${isLoggedIn ? 'Book Tickets' : 'View Details'}
                </button>
            </div>
        </div>
    `;
    
    return col;
}


// Create timeline section for timeline view
function createTimelineSection(date, showtimes) {
    const section = document.createElement('div');
    section.className = 'col-12 mb-4';
    
    const dateDisplay = new Date(date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    section.innerHTML = `
        <div class="timeline-section">
            <div class="timeline-date-header">
                <h4 class="mb-3">
                    <i class="fas fa-calendar-day me-2"></i>${dateDisplay}
                    <span class="badge bg-secondary ms-2">${showtimes.length} shows</span>
                </h4>
            </div>
            <div class="timeline-showtimes">
                ${showtimes.map(showtime => createTimelineItem(showtime)).join('')}
            </div>
        </div>
    `;
    
    return section;
}

// Create timeline item for timeline view
function createTimelineItem(showtime) {
    const startTime = showtime.startTime ? new Date(showtime.startTime) : null;
    const timeDisplay = startTime ? startTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }) : 'TBD';
    
    const posterUrl = showtime.movie?.posterUrl || 'https://via.placeholder.com/100x150/e2e8f0/64748b?text=No+Poster';
    const buttonOnClick = `onclick="showShowtimeDetail(${showtime.id})"`;
    
    return `
        <div class="timeline-item mb-3">
            <div class="card">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-2 col-sm-3">
                            <img src="${posterUrl}" class="img-fluid rounded timeline-poster" alt="${showtime.movie?.title || 'Movie'}">
                        </div>
                        <div class="col-md-6 col-sm-6">
                            <h5 class="mb-2">${showtime.movie?.title || 'Unknown Movie'}</h5>
                            <p class="text-muted mb-2">
                                <i class="fas fa-building me-1"></i>${showtime.auditorium?.cinema?.name || 'Unknown Cinema'} - 
                                <i class="fas fa-door-open me-1"></i>${showtime.auditorium?.name || 'Unknown Hall'}
                            </p>
                            <div class="movie-info">
                                ${showtime.movie?.genre ? `<span class="badge bg-light text-dark me-2">${showtime.movie.genre}</span>` : ''}
                                ${showtime.movie?.duration ? `<span class="text-muted"><i class="fas fa-clock me-1"></i>${showtime.movie.duration} min</span>` : ''}
                            </div>
                        </div>
                        <div class="col-md-2 col-sm-2 text-center">
                            <div class="showtime-time-large">
                                <span class="time-display">${timeDisplay}</span>
                            </div>
                        </div>
                        <div class="col-md-2 col-sm-1 text-end">
                            <div class="price-display mb-2">
                                <span class="price-amount">$${showtime.price ? parseFloat(showtime.price).toFixed(2) : '0.00'}</span>
                            </div>
                            <button class="btn btn-primary btn-sm" ${buttonOnClick}>
                                <i class="fas fa-ticket-alt me-1"></i>Book
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Setup view controls
function setupViewControls() {
    elements.gridViewBtn.classList.add('active');
    elements.timelineViewBtn.classList.remove('active');
}

// Switch between grid and timeline view
function switchView(view) {
    currentView = view;
    
    if (view === 'grid') {
        elements.gridViewBtn.classList.add('active');
        elements.timelineViewBtn.classList.remove('active');
    } else {
        elements.gridViewBtn.classList.remove('active');
        elements.timelineViewBtn.classList.add('active');
    }
    
    renderShowtimes();
}

// Setup filters functionality
function setupFilters() {
    // Populate filter options will be called after data is loaded
}

// Setup date picker
function setupDatePicker() {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    elements.dateFilter.setAttribute('min', today);
    
    // Set maximum date to 30 days from now
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    elements.dateFilter.setAttribute('max', maxDate.toISOString().split('T')[0]);
}

// Setup date navigation buttons
function setupDateNavigation() {
    const container = elements.dateButtons;
    container.innerHTML = '';
    
    // Generate 7 days starting from today
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        const button = document.createElement('button');
        button.className = 'btn btn-outline-primary date-nav-btn';
        button.dataset.date = date.toISOString().split('T')[0];
        
        const dayName = i === 0 ? 'Today' : 
                       i === 1 ? 'Tomorrow' : 
                       date.toLocaleDateString('en-US', { weekday: 'short' });
        
        const dayDate = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        
        button.innerHTML = `
            <div class="date-nav-content">
                <div class="day-name">${dayName}</div>
                <div class="day-date">${dayDate}</div>
                <div class="month-name">${month}</div>
            </div>
        `;
        
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            container.querySelectorAll('.date-nav-btn').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Set date filter
            elements.dateFilter.value = this.dataset.date;
            currentFilters.date = this.dataset.date;
            applyFilters();
        });
        
        container.appendChild(button);
    }
}

// Populate movie filter options
function populateMovieOptions(movies) {
    const currentValue = elements.movieFilter.value;
    elements.movieFilter.innerHTML = '<option value="">All Movies</option>';
    
    movies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = movie.title;
        elements.movieFilter.appendChild(option);
    });
    
    elements.movieFilter.value = currentValue;
}

// Populate cinema filter options
function populateCinemaOptions(cinemas) {
    const currentValue = elements.cinemaFilter.value;
    elements.cinemaFilter.innerHTML = '<option value="">All Cinemas</option>';
    
    cinemas.forEach(cinema => {
        const option = document.createElement('option');
        option.value = cinema.id;
        option.textContent = `${cinema.name} - ${cinema.city}`;
        elements.cinemaFilter.appendChild(option);
    });
    
    elements.cinemaFilter.value = currentValue;
}

// Handle URL parameters for pre-filtering
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('movieId')) {
        elements.movieFilter.value = urlParams.get('movieId');
        currentFilters.movie = urlParams.get('movieId');
    }
    
    if (urlParams.get('cinemaId')) {
        elements.cinemaFilter.value = urlParams.get('cinemaId');
        currentFilters.cinema = urlParams.get('cinemaId');
    }
    
    if (urlParams.get('date')) {
        elements.dateFilter.value = urlParams.get('date');
        currentFilters.date = urlParams.get('date');
    }
}

// Update pagination display and controls
function updatePagination(start, end, total, totalPages) {
    elements.showingStart.textContent = start;
    elements.showingEnd.textContent = end;
    elements.totalShowtimes.textContent = total;
    
    generatePaginationControls(totalPages);
    elements.paginationContainer.style.display = totalPages > 1 ? 'block' : 'none';
}

// Generate pagination controls (reuse from movies/cinemas)
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
    
    // Page numbers logic (same as movies/cinemas)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
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
    const totalPages = Math.ceil(filteredShowtimes.length / showtimesPerPage);
    
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    renderShowtimes();
    
    // Scroll to top of showtimes section
    elements.showtimesGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show showtime detail modal - PUBLIC ACCESS
async function showShowtimeDetail(showtimeId) {
    try {
        console.log('Loading showtime detail for ID:', showtimeId);
        
        // Show loading in modal
        if (elements.modalShowtimeContent) {
            elements.modalShowtimeContent.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading showtime details...</span>
                    </div>
                    <p>Loading showtime details...</p>
                </div>
            `;
        }
        
        // Show modal
        const modal = new bootstrap.Modal(elements.showtimeDetailModal);
        modal.show();
        
        // Get showtime details from local data
        const showtime = allShowtimes.find(s => s.id == showtimeId);
        if (showtime) {
            renderShowtimeDetailModal(showtime);
            if (elements.bookSeatsBtn) {
                elements.bookSeatsBtn.dataset.showtimeId = showtimeId;
            }
        } else {
            elements.modalShowtimeContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Showtime details not found.
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading showtime detail:', error);
        if (elements.modalShowtimeContent) {
            elements.modalShowtimeContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading showtime details. Please try again.
                </div>
            `;
        }
    }
}

// Render showtime detail in modal
function renderShowtimeDetailModal(showtime) {
    const startTime = showtime.startTime ? new Date(showtime.startTime) : null;
    const timeDisplay = startTime ? startTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }) : 'TBD';
    const dateDisplay = startTime ? startTime.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : 'TBD';
    
    const posterUrl = showtime.movie?.posterUrl || 'https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster';
    
    elements.modalShowtimeContent.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <img src="${posterUrl}" class="img-fluid rounded mb-3" alt="${showtime.movie?.title || 'Movie'}">
            </div>
            <div class="col-md-8">
                <h4 class="mb-3 text-dark">${showtime.movie?.title || 'Unknown Movie'}</h4>
                
                <div class="showtime-info">
                    <div class="row mb-3">
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-calendar me-2"></i>Date:</strong>
                            <span class="ms-2 text-dark">${dateDisplay}</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-clock me-2"></i>Time:</strong>
                            <span class="ms-2 text-dark">${timeDisplay}</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-building me-2"></i>Cinema:</strong>
                            <span class="ms-2 text-dark">${showtime.auditorium?.cinema?.name || 'Unknown Cinema'}</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-door-open me-2"></i>Hall:</strong>
                            <span class="ms-2 text-dark">${showtime.auditorium?.name || 'Unknown Hall'}</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-dollar-sign me-2"></i>Price:</strong>
                            <span class="ms-2 text-dark">$${showtime.price ? parseFloat(showtime.price).toFixed(2) : '0.00'} per seat</span>
                        </div>
                        ${showtime.movie?.duration ? `
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-hourglass-half me-2"></i>Duration:</strong>
                            <span class="ms-2 text-dark">${showtime.movie.duration} minutes</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                ${showtime.movie?.description ? `
                <div class="movie-description">
                    <h5 class="text-dark"><i class="fas fa-info-circle me-2"></i>About the Movie</h5>
                    <p class="text-dark">${showtime.movie.description}</p>
                </div>
                ` : ''}
                
                <div class="movie-details mb-3">
                    ${showtime.movie?.genre ? `<span class="badge bg-primary me-2">${showtime.movie.genre}</span>` : ''}
                    ${showtime.movie?.rating ? `<span class="badge bg-warning text-dark"><i class="fas fa-star me-1"></i>${showtime.movie.rating}</span>` : ''}
                </div>
                
                ${isLoggedIn ? `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Ready to book? Click "Select Seats" to choose your preferred seats and complete your booking.
                    </div>
                ` : `
                    <div class="alert alert-warning">
                        <i class="fas fa-sign-in-alt me-2"></i>
                        Please <a href="/login" class="alert-link">login</a> to book tickets for this showtime.
                    </div>
                `}
            </div>
        </div>
    `;
}

// Handle book seats button
function handleBookSeats() {
    const showtimeId = elements.bookSeatsBtn.dataset.showtimeId;
    if (!showtimeId) return;
    
    if (!isLoggedIn) {
        handleLoginRequired(event, 'seat booking');
        return;
    }
    
    currentShowtimeId = parseInt(showtimeId);
    const showtime = allShowtimes.find(s => s.id == currentShowtimeId);
    currentShowtimePrice = showtime ? parseFloat(showtime.price) || 0 : 0;
    
    // Close showtime detail modal
    const modal = bootstrap.Modal.getInstance(elements.showtimeDetailModal);
    modal.hide();
    
    // Show seat selection modal
    showSeatSelectionModal(currentShowtimeId);
}

// Show seat selection modal
async function showSeatSelectionModal(showtimeId) {
    try {
        // Show loading in seat modal
        elements.modalSeatContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading seat map...</span>
                </div>
                <p>Loading seat map...</p>
            </div>
        `;
        
        // Show seat selection modal
        const modal = new bootstrap.Modal(elements.seatSelectionModal);
        modal.show();
        
        // Step 1: Get showtime info to get auditorium ID
        const showtime = allShowtimes.find(s => s.id == showtimeId);
        if (!showtime || !showtime.auditoriumId) {
            throw new Error('Showtime or auditorium information not found');
        }
        
        console.log('Found showtime with auditorium ID:', showtime.auditoriumId);
        
        // Step 2: Load auditorium layout and seat statuses in parallel
        const [auditoriumLayout, seatStatuses] = await Promise.all([
            loadAuditoriumLayout(showtime.auditoriumId).catch(err => {
                console.warn('Failed to load auditorium layout:', err.message);
                return null; // Return null instead of throwing
            }),
            loadSeatStatuses(showtimeId).catch(err => {
                console.warn('Failed to load seat statuses:', err.message);
                return []; // Return empty array instead of throwing
            })
        ]);
        
        console.log('Loaded auditorium layout:', auditoriumLayout);
        console.log('Loaded seat statuses:', seatStatuses);
        
        // Additional debugging for seat layout
        if (auditoriumLayout && auditoriumLayout.seatLayout) {
            console.log('Raw seatLayout string:', auditoriumLayout.seatLayout);
            try {
                const parsed = JSON.parse(auditoriumLayout.seatLayout);
                console.log('Parsed seatLayout object:', parsed);
                if (parsed.seats) {
                    console.log('Seats array in layout:', parsed.seats);
                    console.log('First seat example:', parsed.seats[0]);
                }
            } catch (parseError) {
                console.error('Error parsing seatLayout JSON:', parseError);
            }
        }
        
        // Step 3: Render seat map with actual layout (or fallback if layout failed)
        renderSeatMap(auditoriumLayout, seatStatuses);
        
    } catch (error) {
        console.error('Error loading seat selection:', error);
        elements.modalSeatContent.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error loading seat map: ${error.message}. Please try again.
            </div>
        `;
    }
}

// Load seat statuses for a showtime
async function loadSeatStatuses(showtimeId) {
    try {
        console.log('Loading seat statuses for showtime:', showtimeId);
        
        const result = await AuthService.graphqlRequest(
            SHOWTIME_QUERIES.GET_SEAT_STATUSES, 
            { showtimeId: parseInt(showtimeId) }, 
            false // Public access for viewing seat availability
        );
        
        console.log('Seat statuses result:', result);
        
        if (result.errors) {
            console.error('Seat statuses errors:', result.errors);
            throw new Error(result.errors[0].message);
        }

        const seatStatuses = result.data?.seatStatuses || [];
        console.log('Parsed seat statuses:', seatStatuses.length, 'seats');
        
        return seatStatuses;
        
    } catch (error) {
        console.error('Error loading seat statuses:', error);
        return [];
    }
}

async function loadAuditoriumLayout(auditoriumId) {
    try {
        console.log('Loading auditorium layout for auditorium:', auditoriumId);
        
        const result = await AuthService.graphqlRequest(
            SHOWTIME_QUERIES.GET_AUDITORIUM_LAYOUT, 
            { auditoriumId: parseInt(auditoriumId) }, 
            false // Public access - CHANGED FROM true TO false
        );
        
        console.log('Auditorium layout result:', result);
        
        if (result.errors) {
            console.error('Auditorium layout errors:', result.errors);
            throw new Error(result.errors[0].message);
        }

        const auditorium = result.data?.auditorium;
        console.log('Parsed auditorium layout:', auditorium);
        
        return auditorium;
        
    } catch (error) {
        console.error('Error loading auditorium layout:', error);
        return null;
    }
}

// Render seat map
function renderSeatMap(auditoriumLayout, seatStatuses) {
    console.log('Rendering seat map with layout:', auditoriumLayout);
    console.log('Seat statuses:', seatStatuses);
    
    selectedSeats = [];
    updateSelectedSeatsDisplay();
    
    if (!auditoriumLayout || !auditoriumLayout.seatLayout) {
        // Fallback to default layout if no layout specified
        console.log('No auditorium layout found, using default layout');
        renderDefaultSeatMap(seatStatuses);
        return;
    }
    
    try {
        // Parse seat layout JSON
        let seatLayout;
        if (typeof auditoriumLayout.seatLayout === 'string') {
            seatLayout = JSON.parse(auditoriumLayout.seatLayout);
        } else {
            seatLayout = auditoriumLayout.seatLayout;
        }
        
        console.log('Parsed seat layout:', seatLayout);
        console.log('Seat layout type:', typeof seatLayout);
        console.log('Has seats property:', seatLayout.hasOwnProperty('seats'));
        console.log('Seats is array:', Array.isArray(seatLayout.seats));
        console.log('Seats length:', seatLayout.seats ? seatLayout.seats.length : 'undefined');
        
        let seatMapHtml = `
            <div class="seat-map-container">
                <div class="screen-indicator mb-4">
                    <div class="screen">SCREEN</div>
                </div>
                <div class="auditorium-info mb-3">
                    <h6 class="text-center">${auditoriumLayout.name || 'Auditorium'} - ${auditoriumLayout.cinema?.name || 'Cinema'}</h6>
                </div>
                <div class="seat-legend mb-3">
                    <div class="d-flex justify-content-center gap-3">
                        <div class="legend-item">
                            <span class="seat-demo available"></span>
                            <span>Available</span>
                        </div>
                        <div class="legend-item">
                            <span class="seat-demo occupied"></span>
                            <span>Occupied</span>
                        </div>
                        <div class="legend-item">
                            <span class="seat-demo selected"></span>
                            <span>Selected</span>
                        </div>
                        <div class="legend-item">
                            <span class="seat-demo not-available"></span>
                            <span>Not Available</span>
                        </div>
                    </div>
                </div>
                <div class="seats-grid">
        `;
        
        // FIXED: Better condition checks with more specific validation
        if (seatLayout && 
            seatLayout.hasOwnProperty('seats') && 
            Array.isArray(seatLayout.seats) && 
            seatLayout.seats.length > 0) {
            
            // Format 1: Array of seat objects - call directly
            console.log('✅ Using seats array format with', seatLayout.seats.length, 'seats');
            seatMapHtml += renderSeatsFromArray(seatLayout.seats, seatStatuses);
            
        } else if (seatLayout && 
                  seatLayout.hasOwnProperty('rows') && 
                  Array.isArray(seatLayout.rows) && 
                  seatLayout.rows.length > 0) {
            
            // Format 2: Row-based layout
            console.log('✅ Using rows format with', seatLayout.rows.length, 'rows');
            seatMapHtml += renderSeatsFromRows(seatLayout.rows, seatStatuses);
            
        } else {
            // Format 3: Fallback to default when no valid layout found
            console.log('❌ No valid seat layout found, using default grid');
            console.log('- seatLayout exists:', !!seatLayout);
            console.log('- has seats property:', seatLayout ? seatLayout.hasOwnProperty('seats') : false);
            console.log('- seats is array:', seatLayout && seatLayout.seats ? Array.isArray(seatLayout.seats) : false);
            console.log('- seats length > 0:', seatLayout && seatLayout.seats ? seatLayout.seats.length > 0 : false);
            seatMapHtml += renderDefaultSeatsGrid(seatStatuses);
        }
        
        seatMapHtml += `
                </div>
            </div>
        `;
        
        elements.modalSeatContent.innerHTML = seatMapHtml;
        
    } catch (error) {
        console.error('Error parsing seat layout:', error);
        // Fallback to default layout
        renderDefaultSeatMap(seatStatuses);
    }
}

// function renderSeatsWithAvailabilityCheck(seatLayout, seatStatuses) {
//     console.log('Rendering seats with availability check');
    
//     // Extract available seat numbers from the layout
//     const availableSeats = new Set();
    
//     if (seatLayout && seatLayout.seats && Array.isArray(seatLayout.seats)) {
//         seatLayout.seats.forEach(seat => {
//             const seatNumber = seat.number || seat.seatNumber || seat.id;
//             if (seatNumber) {
//                 availableSeats.add(seatNumber);
//             }
//         });
//     }
    
//     // If no seats found in layout, fall back to default pattern
//     if (availableSeats.size === 0) {
//         console.warn('No seats found in layout, using default grid');
//         return renderDefaultSeatsGrid(seatStatuses);
//     }
    
//     // Group available seats by row
//     const seatsByRow = {};
//     availableSeats.forEach(seatNumber => {
//         const rowLetter = seatNumber.charAt(0);
//         if (!seatsByRow[rowLetter]) {
//             seatsByRow[rowLetter] = [];
//         }
//         seatsByRow[rowLetter].push(seatNumber);
//     });
    
//     // Sort rows alphabetically
//     const sortedRows = Object.keys(seatsByRow).sort();
    
//     // Determine the maximum number of seats per row to create a grid
//     const maxSeatsInRow = Math.max(...Object.values(seatsByRow).map(row => row.length));
//     const maxSeatNumber = Math.max(...Object.values(seatsByRow).flat().map(seat => parseInt(seat.slice(1))));
    
//     let html = '';
    
//     sortedRows.forEach(row => {
//         html += `<div class="seat-row" data-row="${row}">`;
//         html += `<div class="row-label">${row}</div>`;
        
//         // Create a full grid showing all possible positions
//         for (let i = 1; i <= maxSeatNumber; i++) {
//             const seatNumber = `${row}${i}`;
            
//             if (availableSeats.has(seatNumber)) {
//                 // This seat exists in the auditorium layout
//                 const seatStatus = seatStatuses.find(s => s.seatNumber === seatNumber);
//                 const isOccupied = seatStatus && seatStatus.status === 'BOOKED';
                
//                 html += `
//                     <div class="seat ${isOccupied ? 'occupied' : 'available'}" 
//                          data-seat="${seatNumber}" 
//                          ${!isOccupied ? `onclick="toggleSeat('${seatNumber}')"` : ''}>
//                         ${i}
//                     </div>
//                 `;
//             } else {
//                 // This seat doesn't exist in the auditorium layout
//                 html += `
//                     <div class="seat not-available" 
//                          data-seat="${seatNumber}" 
//                          title="This seat is not available in this auditorium">
//                         ${i}
//                     </div>
//                 `;
//             }
//         }
        
//         html += `</div>`;
//     });
    
//     return html;
// }

function renderSeatsFromArray(seats, seatStatuses) {
    console.log('Rendering seats from array:', seats);
    console.log('Number of seats in layout:', seats.length);
    
    // Extract available seat numbers from the seats array
    const availableSeats = new Set();
    seats.forEach(seat => {
        // Handle different possible seat number field names
        const seatNumber = seat.number || seat.seatNumber || seat.id || seat.name;
        if (seatNumber) {
            availableSeats.add(seatNumber);
            console.log('Added seat to available set:', seatNumber);
        }
    });
    
    console.log('Available seats set:', Array.from(availableSeats));
    
    if (availableSeats.size === 0) {
        console.warn('No valid seat numbers found in seats array, using default grid');
        return renderDefaultSeatsGrid(seatStatuses);
    }
    
    // Group seats by row (assuming seat numbers like A1, A2, B1, B2...)
    const seatsByRow = {};
    let maxSeatNumber = 0;
    
    availableSeats.forEach(seatNumber => {
        const rowLetter = seatNumber.charAt(0).toUpperCase();
        const seatNum = parseInt(seatNumber.slice(1));
        
        if (!seatsByRow[rowLetter]) {
            seatsByRow[rowLetter] = [];
        }
        seatsByRow[rowLetter].push(seatNumber);
        maxSeatNumber = Math.max(maxSeatNumber, seatNum);
    });
    
    console.log('Seats grouped by row:', seatsByRow);
    console.log('Max seat number found:', maxSeatNumber);
    
    // Sort rows alphabetically
    const sortedRows = Object.keys(seatsByRow).sort();
    
    let html = '';
    sortedRows.forEach(row => {
        html += `<div class="seat-row" data-row="${row}">`;
        html += `<div class="row-label">${row}</div>`;
        
        // Create full grid showing available and not-available seats
        for (let i = 1; i <= maxSeatNumber; i++) {
            const seatNumber = `${row}${i}`;
            
            if (availableSeats.has(seatNumber)) {
                // Seat exists in auditorium
                const seatStatus = seatStatuses.find(s => s.seatNumber === seatNumber);
                const isOccupied = seatStatus && seatStatus.status === 'BOOKED';
                
                html += `
                    <div class="seat ${isOccupied ? 'occupied' : 'available'}" 
                         data-seat="${seatNumber}" 
                         ${!isOccupied ? `onclick="toggleSeat('${seatNumber}')"` : ''}>
                        ${i}
                    </div>
                `;
            } else {
                // Seat doesn't exist in this auditorium
                html += `
                    <div class="seat not-available" 
                         data-seat="${seatNumber}" 
                         title="Seat not available in this auditorium">
                        ${i}
                    </div>
                `;
            }
        }
        
        html += `</div>`;
    });
    
    console.log('Generated HTML length:', html.length);
    return html;
}

function renderSeatsFromRows(rows, seatStatuses) {
    console.log('Rendering seats from rows format:', rows);
    
    let html = '';
    
    if (Array.isArray(rows)) {
        // First pass: determine the maximum number of seats per row
        let maxSeatsPerRow = 0;
        const availableSeatsByRow = {};
        
        rows.forEach((row, rowIndex) => {
            const rowLetter = String.fromCharCode(65 + rowIndex); // A, B, C...
            availableSeatsByRow[rowLetter] = new Set();
            
            if (row.seats && Array.isArray(row.seats)) {
                maxSeatsPerRow = Math.max(maxSeatsPerRow, row.seats.length);
                row.seats.forEach((seat, seatIndex) => {
                    const seatNumber = `${rowLetter}${seatIndex + 1}`;
                    availableSeatsByRow[rowLetter].add(seatNumber);
                });
            }
        });
        
        // Second pass: render with not-available indicators
        rows.forEach((row, rowIndex) => {
            const rowLetter = String.fromCharCode(65 + rowIndex); // A, B, C...
            
            html += `<div class="seat-row" data-row="${rowLetter}">`;
            html += `<div class="row-label">${rowLetter}</div>`;
            
            // Create full grid for this row
            for (let i = 1; i <= maxSeatsPerRow; i++) {
                const seatNumber = `${rowLetter}${i}`;
                
                if (availableSeatsByRow[rowLetter].has(seatNumber)) {
                    // Seat exists in auditorium
                    const seatStatus = seatStatuses.find(s => s.seatNumber === seatNumber);
                    const isOccupied = seatStatus && seatStatus.status === 'BOOKED';
                    
                    html += `
                        <div class="seat ${isOccupied ? 'occupied' : 'available'}" 
                             data-seat="${seatNumber}" 
                             ${!isOccupied ? `onclick="toggleSeat('${seatNumber}')"` : ''}>
                            ${i}
                        </div>
                    `;
                } else {
                    // Seat doesn't exist in this auditorium
                    html += `
                        <div class="seat not-available" 
                             data-seat="${seatNumber}" 
                             title="Seat not available in this auditorium">
                            ${i}
                        </div>
                    `;
                }
            }
            
            html += `</div>`;
        });
    }
    
    return html;
}

function renderDefaultSeatsGrid(seatStatuses) {
    console.log('Rendering default seats grid');
    
    // Generate default 6 rows x 10 seats layout
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seatsPerRow = 10;
    
    let html = '';
    
    rows.forEach(row => {
        html += `<div class="seat-row" data-row="${row}">`;
        html += `<div class="row-label">${row}</div>`;
        
        for (let i = 1; i <= seatsPerRow; i++) {
            const seatNumber = `${row}${i}`;

            const seatStatus = seatStatuses.find(s => s.seatNumber === seatNumber);
            const isOccupied = seatStatus && seatStatus.status === 'BOOKED';
            
            html += `
                <div class="seat ${isOccupied ? 'occupied' : 'available'}" 
                     data-seat="${seatNumber}" 
                     ${!isOccupied ? `onclick="toggleSeat('${seatNumber}')"` : ''}>
                    ${i}
                </div>
            `;
        }
        
        html += `</div>`;
    });
    
    return html;
}

function renderDefaultSeatMap(seatStatuses) {
    console.log('Rendering fallback default seat map');
    
    selectedSeats = [];
    updateSelectedSeatsDisplay();
    
    let seatMapHtml = `
        <div class="seat-map-container">
            <div class="screen-indicator mb-4">
                <div class="screen">SCREEN</div>
            </div>
            <div class="seat-legend mb-3">
                <div class="d-flex justify-content-center gap-3">
                    <div class="legend-item">
                        <span class="seat-demo available"></span>
                        <span>Available</span>
                    </div>
                    <div class="legend-item">
                        <span class="seat-demo occupied"></span>
                        <span>Occupied</span>
                    </div>
                    <div class="legend-item">
                        <span class="seat-demo selected"></span>
                        <span>Selected</span>
                    </div>
                    <div class="legend-item">
                        <span class="seat-demo not-available"></span>
                        <span>Not Available</span>
                    </div>
                </div>
            </div>
            <div class="seats-grid">
    `;
    
    seatMapHtml += renderDefaultSeatsGrid(seatStatuses);
    
    seatMapHtml += `
            </div>
        </div>
    `;
    
    elements.modalSeatContent.innerHTML = seatMapHtml;
}

// Toggle seat selection
function toggleSeat(seatNumber) {
    const seatElement = document.querySelector(`[data-seat="${seatNumber}"]`);
    
    // Prevent selection of occupied or not-available seats
    if (!seatElement || 
        seatElement.classList.contains('occupied') || 
        seatElement.classList.contains('not-available')) {
        
        if (seatElement && seatElement.classList.contains('not-available')) {
            AuthService.showMessage('This seat is not available in this auditorium', 'warning');
        }
        return;
    }
    
    if (selectedSeats.includes(seatNumber)) {
        // Deselect seat
        selectedSeats = selectedSeats.filter(seat => seat !== seatNumber);
        seatElement.classList.remove('selected');
        seatElement.classList.add('available');
    } else {
        // Select seat (limit to 8 seats)
        if (selectedSeats.length >= 8) {
            AuthService.showMessage('Maximum 8 seats can be selected', 'warning');
            return;
        }
        selectedSeats.push(seatNumber);
        seatElement.classList.remove('available');
        seatElement.classList.add('selected');
    }
    
    updateSelectedSeatsDisplay();
}

function showBookingConfirmationModal(booking, selectedSeats, totalPrice) {
    try {
        console.log('Showing booking confirmation for:', booking);
        
        // Get showtime details for confirmation
        const showtime = allShowtimes.find(s => s.id == booking.showtimeId);
        
        if (!showtime) {
            throw new Error('Showtime details not found');
        }
        
        const startTime = showtime.startTime ? new Date(showtime.startTime) : null;
        const timeDisplay = startTime ? startTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        }) : 'TBD';
        const dateDisplay = startTime ? startTime.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : 'TBD';
        
        const bookingDate = booking.bookingDate ? new Date(booking.bookingDate) : new Date();
        const bookingDateDisplay = bookingDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        elements.modalBookingContent.innerHTML = `
            <div class="booking-confirmation-content">
                <div class="text-center mb-4">
                    <div class="success-icon mb-3">
                        <i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>
                    </div>
                    <h4 class="text-success">Booking & Tickets Created Successfully!</h4>
                    <p class="text-muted">Your seats have been reserved and tickets generated. Please complete payment to confirm your booking.</p>
                </div>
                
                <!-- Ticket Status Alert -->
                <div class="alert alert-info">
                    <i class="fas fa-ticket-alt me-2"></i>
                    <strong>Tickets Generated:</strong> ${selectedSeats.length} tickets have been automatically created for your selected seats. Complete payment to activate them.
                </div>
                
                <div class="booking-details">
                    <!-- ... existing booking details ... -->
                    
                    <div class="col-md-6">
                        <div class="detail-card mb-3">
                            <h6 class="detail-header">
                                <i class="fas fa-ticket-alt me-2"></i>Generated Tickets
                            </h6>
                            <div class="detail-content">
                                <div class="seats-display">
                                    ${selectedSeats.map(seat => `
                                        <span class="seat-badge">
                                            <i class="fas fa-ticket-alt me-1"></i>Ticket for ${seat}
                                        </span>
                                    `).join('')}
                                </div>
                                <div class="detail-row mt-2">
                                    <span class="label">Total Tickets:</span>
                                    <span class="value">${selectedSeats.length} ticket(s) created</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Important:</strong> Your tickets are created but in PENDING status. Complete payment within 15 minutes to activate them, or they will be automatically cancelled.
                </div>
            </div>
        `;
        
        // Store booking data for payment
        currentBookingData = {
            bookingId: booking.id,
            totalAmount: totalPrice,
            showtime: showtime,
            seats: selectedSeats
        };
        
        // Show the modal
        const modal = new bootstrap.Modal(elements.bookingConfirmationModal);
        modal.show();
        
        // Setup event listeners for modal buttons
        setupBookingConfirmationListeners();
        
    } catch (error) {
        console.error('Error showing booking confirmation:', error);
        AuthService.showMessage(`Error displaying booking confirmation: ${error.message}`, 'error');
    }
}

function setupBookingConfirmationListeners() {
    // Proceed to payment button
    elements.proceedPaymentBtn.onclick = function() {
        const bookingModal = bootstrap.Modal.getInstance(elements.bookingConfirmationModal);
        bookingModal.hide();
        showPaymentModal();
    };
    
    // View bookings button
    elements.viewBookingsBtn.onclick = function() {
        const bookingModal = bootstrap.Modal.getInstance(elements.bookingConfirmationModal);
        bookingModal.hide();
        
        // Redirect to dashboard bookings section
        setTimeout(() => {
            window.location.href = '/dashboard#bookings';
        }, 300);
    };
}

// Update selected seats display
function updateSelectedSeatsDisplay() {
    const seatsText = selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None';
    const totalPrice = selectedSeats.length * currentShowtimePrice;
    
    elements.selectedSeatsDisplay.textContent = seatsText;
    elements.totalPriceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
    
    // Enable/disable proceed button
    elements.proceedBookingBtn.disabled = selectedSeats.length === 0;
}

// Handle proceed to booking
function handleProceedBooking() {
    if (selectedSeats.length === 0 || !currentShowtimeId) return;
    
    // This would typically redirect to a payment/booking confirmation page
    // For now, we'll simulate the booking process
    proceedWithBooking();
}

// Proceed with booking (simplified version)
async function proceedWithBooking() {
    try {
        if (selectedSeats.length === 0 || !currentShowtimeId) {
            throw new Error('Please select at least one seat');
        }

        const totalPrice = selectedSeats.length * currentShowtimePrice;
        
        // Show loading state
        elements.proceedBookingBtn.disabled = true;
        elements.proceedBookingBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Processing Booking...
        `;
        
        console.log('Creating booking with:', {
            showtimeId: currentShowtimeId,
            seatNumbers: selectedSeats,
            totalPrice: totalPrice
        });
        
        // Call the GraphQL createBooking mutation
        const bookingResult = await createBooking(currentShowtimeId, selectedSeats, totalPrice);
        
        if (bookingResult.success) {
            // Close seat selection modal
            const seatModal = bootstrap.Modal.getInstance(elements.seatSelectionModal);
            seatModal.hide();
            
            // Show booking confirmation modal
            showBookingConfirmationModal(bookingResult.booking, selectedSeats, totalPrice);
            
            // Reset selected seats
            selectedSeats = [];
            updateSelectedSeatsDisplay();
            
        } else {
            throw new Error(bookingResult.message || 'Booking failed');
        }
        
    } catch (error) {
        console.error('Booking error:', error);
        AuthService.showMessage(`Booking failed: ${error.message}`, 'error');
        
        // Reset button
        elements.proceedBookingBtn.disabled = selectedSeats.length === 0;
        elements.proceedBookingBtn.innerHTML = `
            <i class="fas fa-shopping-cart me-2"></i>Proceed to Booking
        `;
    }
}

async function createBooking(showtimeId, seatNumbers, totalPrice) {
    try {
        const mutation = `
            mutation CreateBooking($showtimeId: Int!, $seatNumbers: [String!]!, $totalPrice: Float!) {
                createBooking(showtimeId: $showtimeId, seatNumbers: $seatNumbers, totalPrice: $totalPrice) {
                    booking {
                        id
                        userId
                        showtimeId
                        status
                        totalPrice
                        bookingDate
                    }
                    success
                    message
                }
            }
        `;

        const variables = {
            showtimeId: parseInt(showtimeId),
            seatNumbers: seatNumbers,
            totalPrice: parseFloat(totalPrice)
        };

        console.log('Sending GraphQL mutation:', { mutation, variables });

        const result = await AuthService.graphqlRequest(mutation, variables, true);
        
        console.log('GraphQL booking result:', result);

        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        const bookingData = result.data.createBooking;
        if (!bookingData.success) {
            throw new Error(bookingData.message || 'Booking failed');
        }

        return bookingData;
        
    } catch (error) {
        console.error('Error creating booking:', error);
        throw error;
    }
}
let currentBookingData = null;
// Show payment modal
function showPaymentModal() {
    try {
        if (!currentBookingData) {
            throw new Error('No booking data available');
        }
        
        const { bookingId, totalAmount, showtime, seats } = currentBookingData;
        
        elements.modalPaymentContent.innerHTML = `
            <div class="payment-form-content">
                <div class="booking-summary mb-4">
                    <h6 class="mb-3">
                        <i class="fas fa-receipt me-2"></i>Booking Summary
                    </h6>
                    <div class="summary-card">
                        <div class="row">
                            <div class="col-md-8">
                                <div class="summary-details">
                                    <div class="detail-row">
                                        <span class="label">Booking ID:</span>
                                        <span class="value">#${bookingId}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="label">Movie:</span>
                                        <span class="value">${showtime.movie?.title}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="label">Seats:</span>
                                        <span class="value">${seats.join(', ')}</span>
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
                            <input class="form-check-input" type="radio" name="paymentMethod" id="creditCard" value="CREDIT_CARD" checked>
                            <label class="form-check-label" for="creditCard">
                                <i class="fas fa-credit-card me-2"></i>Credit Card
                            </label>
                        </div>
                        <div class="form-check payment-option">
                            <input class="form-check-input" type="radio" name="paymentMethod" id="debitCard" value="DEBIT_CARD">
                            <label class="form-check-label" for="debitCard">
                                <i class="fas fa-money-check-alt me-2"></i>Debit Card
                            </label>
                        </div>
                        <div class="form-check payment-option">
                            <input class="form-check-input" type="radio" name="paymentMethod" id="digitalWallet" value="DIGITAL_WALLET">
                            <label class="form-check-label" for="digitalWallet">
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
                        <input type="file" class="form-control" id="paymentProofFile" accept="image/*">
                        <div class="form-text">Upload payment receipt or proof (JPG, PNG, max 5MB)</div>
                    </div>
                </div>
                
                <div class="payment-terms">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="agreeTerms" required>
                        <label class="form-check-label" for="agreeTerms">
                            I agree to the <a href="/terms" target="_blank">Terms and Conditions</a> and <a href="/privacy" target="_blank">Privacy Policy</a>
                        </label>
                    </div>
                </div>
            </div>
        `;
        
        // Show payment modal
        const modal = new bootstrap.Modal(elements.paymentModal);
        modal.show();
        
        // Setup payment completion listener
        setupPaymentListeners();
        
    } catch (error) {
        console.error('Error showing payment modal:', error);
        AuthService.showMessage(`Error displaying payment form: ${error.message}`, 'error');
    }
}

// Setup payment modal listeners
function setupPaymentListeners() {
    elements.completePaymentBtn.onclick = async function() {
        await processPayment();
    };
}

// Process payment
async function processPayment() {
    try {
        if (!currentBookingData) {
            throw new Error('No booking data available');
        }
        
        // Validate terms agreement
        const agreeTerms = document.getElementById('agreeTerms');
        if (!agreeTerms.checked) {
            throw new Error('Please agree to the terms and conditions');
        }
        
        // Get selected payment method
        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selectedPaymentMethod) {
            throw new Error('Please select a payment method');
        }
        
        // Get payment proof file (optional)
        const paymentProofFile = document.getElementById('paymentProofFile');
        let paymentProofImage = null;
        
        if (paymentProofFile.files.length > 0) {
            // Convert file to base64 (simplified for demo)
            paymentProofImage = await fileToBase64(paymentProofFile.files[0]);
        }
        
        // Show loading state
        elements.completePaymentBtn.disabled = true;
        elements.completePaymentBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Processing Payment...
        `;
        
        // Create payment via GraphQL mutation
        const paymentResult = await createPayment(
            currentBookingData.bookingId,
            selectedPaymentMethod.value,
            paymentProofImage
        );
        
        if (paymentResult.success) {
            // Close payment modal
            const paymentModal = bootstrap.Modal.getInstance(elements.paymentModal);
            paymentModal.hide();
            
            // Show success message
            AuthService.showMessage('Payment successful! Your booking has been confirmed.', 'success');
            
            // Redirect to bookings page after a delay
            setTimeout(() => {
                window.location.href = '/dashboard#bookings';
            }, 2000);
            
        } else {
            throw new Error(paymentResult.message || 'Payment failed');
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        AuthService.showMessage(`Payment failed: ${error.message}`, 'error');
        
        // Reset button
        elements.completePaymentBtn.disabled = false;
        elements.completePaymentBtn.innerHTML = `
            <i class="fas fa-lock me-2"></i>Complete Payment
        `;
    }
}

// Create payment via GraphQL mutation
async function createPayment(bookingId, paymentMethod, paymentProofImage) {
    try {
        const mutation = `
            mutation CreatePayment($bookingId: Int!, $paymentMethod: String!, $paymentProofImage: String) {
                createPayment(bookingId: $bookingId, paymentMethod: $paymentMethod, paymentProofImage: $paymentProofImage) {
                    payment {
                        id
                        bookingId
                        amount
                        paymentMethod
                        status
                        createdAt
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

        const result = await AuthService.graphqlRequest(mutation, variables, true);
        
        console.log('Payment result:', result);

        if (result.errors) {
            throw new Error(result.errors[0].message);
        }

        const paymentData = result.data.createPayment;
        if (!paymentData.success) {
            throw new Error(paymentData.message || 'Payment failed');
        }

        return paymentData;
        
    } catch (error) {
        console.error('Error creating payment:', error);
        throw error;
    }
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
    
    setTimeout(() => {
        const confirmLogin = confirm(`You need to login to ${contentType}. Go to login page now?`);
        if (confirmLogin) {
            window.location.href = '/login?returnUrl=/showtimes';
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

// Global functions for inline event handlers
window.showShowtimeDetail = showShowtimeDetail;
window.changePage = changePage;
window.toggleSeat = toggleSeat;
window.handleLoginRequired = handleLoginRequired;

// Export for testing and debugging
window.ShowtimesPage = {
    SHOWTIME_FIELDS,
    SHOWTIME_QUERIES,
    loadShowtimes,
    renderShowtimes,
    createShowtimeCard,
    showShowtimeDetail,
    handleBookSeats,
    applyFilters,
    clearAllFilters,
    switchView,
    changePage
};

console.log('Showtimes.js loaded successfully with full schema consistency');