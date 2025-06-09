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
    movie_id: 'movie_id',
    auditorium_id: 'auditorium_id',
    start_time: 'start_time',
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
        retryLoadBtn: document.getElementById('retry-load')
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
                const movieId = showtime.movie?.id || showtime.movieId || showtime.movie_id;
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
        
        // FIXED: Support both field formats for date filtering
        if (currentFilters.date) {
            filtered = filtered.filter(showtime => {
                const startTimeValue = showtime.startTime || showtime.start_time;
                if (!startTimeValue) return false;
                const showtimeDate = new Date(startTimeValue).toISOString().split('T')[0];
                return showtimeDate === currentFilters.date;
            });
            console.log('After date filter:', filtered.length);
        }
        
        // FIXED: Support both field formats for time filtering
        if (currentFilters.time) {
            filtered = filtered.filter(showtime => {
                const startTimeValue = showtime.startTime || showtime.start_time;
                if (!startTimeValue) return false;
                const showtimeHour = new Date(startTimeValue).getHours();
                
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
    
    // FIXED: Support both field name formats
    const startTimeValue = showtime.startTime || showtime.start_time;
    const movieIdValue = showtime.movieId || showtime.movie_id;
    const auditoriumIdValue = showtime.auditoriumId || showtime.auditorium_id;
    
    const startTime = startTimeValue ? new Date(startTimeValue) : null;
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
    
    // Get movie poster
    const posterUrl = showtime.movie?.posterUrl || 'https://via.placeholder.com/300x200/e2e8f0/64748b?text=No+Poster';
    
    // Handle button logic based on login status
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
    const startTime = showtime.start_time ? new Date(showtime.start_time) : null;
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
        
        // Load seat statuses
        const seatStatuses = await loadSeatStatuses(showtimeId);
        
        // Render seat map
        renderSeatMap(seatStatuses);
        
    } catch (error) {
        console.error('Error loading seat selection:', error);
        elements.modalSeatContent.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error loading seat map. Please try again.
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
        
        return result.data?.seatStatuses || [];
        
    } catch (error) {
        console.error('Error loading seat statuses:', error);
        return [];
    }
}


// Render seat map
function renderSeatMap(seatStatuses) {
    // Create a simple seat map (this would be more complex in a real app)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seatsPerRow = 10;
    
    selectedSeats = [];
    updateSelectedSeatsDisplay();
    
    let seatMapHtml = `
        <div class="seat-map-container">
            <div class="screen-indicator mb-4">
                <div class="screen">SCREEN</div>
            </div>
            <div class="seat-legend mb-3">
                <div class="d-flex justify-content-center gap-4">
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
                </div>
            </div>
            <div class="seats-grid">
    `;
    
    rows.forEach(row => {
        seatMapHtml += `<div class="seat-row" data-row="${row}">`;
        seatMapHtml += `<div class="row-label">${row}</div>`;
        
        for (let i = 1; i <= seatsPerRow; i++) {
            const seatNumber = `${row}${i}`;
            // FIXED: Use camelCase seatNumber
            const seatStatus = seatStatuses.find(s => s.seatNumber === seatNumber);
            const isOccupied = seatStatus && seatStatus.status === 'BOOKED';
            
            seatMapHtml += `
                <div class="seat ${isOccupied ? 'occupied' : 'available'}" 
                     data-seat="${seatNumber}" 
                     ${!isOccupied ? `onclick="toggleSeat('${seatNumber}')"` : ''}>
                    ${i}
                </div>
            `;
        }
        
        seatMapHtml += `</div>`;
    });
    
    seatMapHtml += `
            </div>
        </div>
    `;
    
    elements.modalSeatContent.innerHTML = seatMapHtml;
}

// Toggle seat selection
function toggleSeat(seatNumber) {
    const seatElement = document.querySelector(`[data-seat="${seatNumber}"]`);
    if (!seatElement || seatElement.classList.contains('occupied')) return;
    
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
        const totalPrice = selectedSeats.length * currentShowtimePrice;
        
        // Show loading state
        elements.proceedBookingBtn.disabled = true;
        elements.proceedBookingBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Processing...
        `;
        
        // Call booking API
        const result = await AuthService.createBooking(currentShowtimeId, selectedSeats, totalPrice);
        
        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.seatSelectionModal);
            modal.hide();
            
            // Show success message
            AuthService.showMessage('Booking successful! Redirecting to your bookings...', 'success');
            
            // Redirect to bookings page
            setTimeout(() => {
                window.location.href = '/dashboard#bookings';
            }, 2000);
        } else {
            throw new Error(result.message || 'Booking failed');
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