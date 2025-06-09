/**
 * Cinemas Page JavaScript
 * Konsisten dengan schema.py GraphQL types dan cinema-service schema
 * 
 * Schema mappings yang HARUS diikuti dari gateway/schema.py:
 * - CinemaType: { id, name, city, capacity, auditoriums }
 * - AuditoriumType: { id, cinema_id, name, seat_layout, cinema }
 * - Query: { publicCinemas, cinemas, cinema(id), auditoriums(cinema_id) }
 */

// KONSISTEN DENGAN SCHEMA.PY - Field names sesuai gateway schema
const CINEMA_FIELDS = {
    id: 'id',
    name: 'name',
    city: 'city',
    capacity: 'capacity',
    auditoriums: 'auditoriums'
};

// GraphQL Queries sesuai gateway/schema.py - PUBLIC ACCESS
const CINEMA_QUERIES = {
    GET_CINEMAS: `
        query GetCinemas {
            publicCinemas {
                id
                name
                city
                capacity
            }
        }
    `,
    GET_CINEMA: `
        query GetCinema($id: Int!) {
            cinema(id: $id) {
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
    `,
    GET_AUDITORIUMS: `
        query GetAuditoriums($cinemaId: Int) {
            auditoriums(cinema_id: $cinemaId) {
                id
                cinema_id
                name
                seat_layout
                cinema {
                    id
                    name
                    city
                }
            }
        }
    `
};

// Global state variables
let allCinemas = [];
let filteredCinemas = [];
let currentPage = 1;
const cinemasPerPage = 12;
let currentView = 'grid'; // 'grid' or 'list'
let currentFilters = {
    city: '',
    capacity: '',
    search: '',
    sort: 'name'
};
let isLoggedIn = false;

// DOM Elements cache
let elements = {};

// DOM ready initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Cinemas page initializing...');
    
    // Cache DOM elements
    cacheElements();
    
    // Initialize authentication state
    isLoggedIn = AuthService.isLoggedIn();
    updateNavigation();
    
    // Initialize page
    initializeCinemasPage();
    
    console.log('Cinemas page initialized successfully');
});

// Cache frequently used DOM elements
function cacheElements() {
    elements = {
        // Containers
        loadingContainer: document.getElementById('loading-container'),
        cinemasGrid: document.getElementById('cinemas-grid'),
        cinemasList: document.getElementById('cinemas-list'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        paginationContainer: document.getElementById('pagination-container'),
        
        // Filters
        cityFilter: document.getElementById('city-filter'),
        capacityFilter: document.getElementById('capacity-filter'),
        sortFilter: document.getElementById('sort-filter'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search'),
        applyFiltersBtn: document.getElementById('apply-filters'),
        clearFiltersBtn: document.getElementById('clear-filters'),
        resetFiltersBtn: document.getElementById('reset-filters'),
        
        // View controls
        gridViewBtn: document.getElementById('grid-view'),
        listViewBtn: document.getElementById('list-view'),
        
        // Pagination
        paginationInfo: document.getElementById('pagination-info'),
        paginationControls: document.getElementById('pagination-controls'),
        showingStart: document.getElementById('showing-start'),
        showingEnd: document.getElementById('showing-end'),
        totalCinemas: document.getElementById('total-cinemas'),
        
        // Cinema count
        cinemaCount: document.getElementById('cinema-count'),
        
        // Modal
        cinemaDetailModal: document.getElementById('cinemaDetailModal'),
        modalCinemaContent: document.getElementById('modal-cinema-content'),
        viewShowtimesBtn: document.getElementById('view-showtimes-btn'),
        
        // Error handling
        errorMessage: document.getElementById('error-message'),
        retryLoadBtn: document.getElementById('retry-load')
    };
}

// Initialize the cinemas page
function initializeCinemasPage() {
    try {
        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        loadCinemas();
        
        // Setup view controls
        setupViewControls();
        
        // Setup filters
        setupFilters();
        
    } catch (error) {
        console.error('Error initializing cinemas page:', error);
        showErrorState('Failed to initialize page. Please refresh.');
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Filter controls
    elements.cityFilter.addEventListener('change', handleFilterChange);
    elements.capacityFilter.addEventListener('change', handleFilterChange);
    elements.sortFilter.addEventListener('change', handleFilterChange);
    elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    elements.applyFiltersBtn.addEventListener('click', applyFilters);
    elements.clearFiltersBtn.addEventListener('click', clearAllFilters);
    elements.resetFiltersBtn.addEventListener('click', clearAllFilters);
    
    // View controls
    elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    elements.listViewBtn.addEventListener('click', () => switchView('list'));
    
    // Modal controls
    elements.viewShowtimesBtn.addEventListener('click', handleViewShowtimes);
    
    // Error handling
    elements.retryLoadBtn.addEventListener('click', loadCinemas);
    
    // Search input enter key
    elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
}

// Load cinemas from API - PUBLIC ACCESS
async function loadCinemas() {
    try {
        showLoadingState();
        
        console.log('Loading cinemas from GraphQL API...');
        
        // Use public cinema access (no authentication required)
        const cinemas = await AuthService.getCinemasForDisplay();
        
        console.log('Cinemas loaded successfully:', cinemas ? cinemas.length : 0, 'cinemas');
        
        if (cinemas && cinemas.length > 0) {
            allCinemas = cinemas;
            
            // Update cinema count
            updateCinemaCount(allCinemas.length);
            
            // Apply initial filters and render
            applyFilters();
            
        } else {
            console.warn('No cinemas data received');
            allCinemas = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading cinemas:', error);
        showErrorState('Failed to load cinemas. Please check your connection and try again.');
    }
}

// Show loading state
function showLoadingState() {
    elements.loadingContainer.style.display = 'block';
    elements.cinemasGrid.style.display = 'none';
    elements.cinemasList.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Show error state
function showErrorState(message = 'An error occurred') {
    elements.loadingContainer.style.display = 'none';
    elements.cinemasGrid.style.display = 'none';
    elements.cinemasList.style.display = 'none';
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
    elements.cinemasGrid.style.display = 'none';
    elements.cinemasList.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Update cinema count badge
function updateCinemaCount(count) {
    elements.cinemaCount.innerHTML = `<i class="fas fa-building me-1"></i>${count} Cinemas`;
}

// Handle filter changes
function handleFilterChange() {
    currentFilters.city = elements.cityFilter.value;
    currentFilters.capacity = elements.capacityFilter.value;
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

// Apply all filters
function applyFilters() {
    try {
        // Start with all cinemas
        let filtered = [...allCinemas];
        
        // Apply city filter
        if (currentFilters.city) {
            filtered = filtered.filter(cinema => 
                cinema.city && cinema.city.toLowerCase() === currentFilters.city.toLowerCase()
            );
        }
        
        // Apply capacity filter
        if (currentFilters.capacity) {
            const minCapacity = parseInt(currentFilters.capacity);
            filtered = filtered.filter(cinema => 
                cinema.capacity && parseInt(cinema.capacity) >= minCapacity
            );
        }
        
        // Apply search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            filtered = filtered.filter(cinema => 
                (cinema.name && cinema.name.toLowerCase().includes(searchTerm)) ||
                (cinema.city && cinema.city.toLowerCase().includes(searchTerm))
            );
        }
        
        // Apply sorting
        filtered = sortCinemas(filtered, currentFilters.sort);
        
        filteredCinemas = filtered;
        currentPage = 1; // Reset to first page
        
        console.log('Filters applied:', {
            total: allCinemas.length,
            filtered: filteredCinemas.length,
            filters: currentFilters
        });
        
        renderCinemas();
        
    } catch (error) {
        console.error('Error applying filters:', error);
        showErrorState('Error filtering cinemas');
    }
}

// Sort cinemas based on criteria
function sortCinemas(cinemas, sortBy) {
    const sorted = [...cinemas];
    
    switch (sortBy) {
        case 'name':
            return sorted.sort((a, b) => 
                (a.name || '').localeCompare(b.name || '')
            );
        case 'capacity':
            return sorted.sort((a, b) => 
                (parseInt(b.capacity) || 0) - (parseInt(a.capacity) || 0)
            );
        case 'city':
            return sorted.sort((a, b) => 
                (a.city || '').localeCompare(b.city || '')
            );
        default:
            return sorted;
    }
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {
        city: '',
        capacity: '',
        search: '',
        sort: 'name'
    };
    
    // Reset form controls
    elements.cityFilter.value = '';
    elements.capacityFilter.value = '';
    elements.sortFilter.value = 'name';
    elements.searchInput.value = '';
    
    // Apply filters
    applyFilters();
}

// Render cinemas based on current view and pagination
function renderCinemas() {
    if (filteredCinemas.length === 0) {
        showEmptyState();
        return;
    }
    
    // Hide loading and error states
    elements.loadingContainer.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredCinemas.length / cinemasPerPage);
    const startIndex = (currentPage - 1) * cinemasPerPage;
    const endIndex = Math.min(startIndex + cinemasPerPage, filteredCinemas.length);
    const currentCinemas = filteredCinemas.slice(startIndex, endIndex);
    
    // Render based on current view
    if (currentView === 'grid') {
        renderGridView(currentCinemas);
    } else {
        renderListView(currentCinemas);
    }
    
    // Update pagination
    updatePagination(startIndex + 1, endIndex, filteredCinemas.length, totalPages);
}

// Render grid view
function renderGridView(cinemas) {
    elements.cinemasGrid.style.display = 'flex';
    elements.cinemasList.style.display = 'none';
    elements.paginationContainer.style.display = 'block';
    
    elements.cinemasGrid.innerHTML = '';
    
    cinemas.forEach((cinema, index) => {
        const cinemaCard = createCinemaCard(cinema, index);
        elements.cinemasGrid.appendChild(cinemaCard);
    });
    
    // Add animation classes
    setTimeout(() => {
        elements.cinemasGrid.querySelectorAll('.cinema-card').forEach((card, index) => {
            card.classList.add('animate-cinema-in');
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }, 50);
}

// Render list view
function renderListView(cinemas) {
    elements.cinemasGrid.style.display = 'none';
    elements.cinemasList.style.display = 'block';
    elements.paginationContainer.style.display = 'block';
    
    elements.cinemasList.innerHTML = '';
    
    cinemas.forEach((cinema, index) => {
        const cinemaListItem = createCinemaListItem(cinema, index);
        elements.cinemasList.appendChild(cinemaListItem);
    });
}

// Create cinema card for grid view
function createCinemaCard(cinema, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 col-sm-6 mb-4';
    
    // Default cinema image (since cinemas don't have poster URLs)
    const imageUrl = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80';
    
    // Handle button logic based on login status
    const buttonOnClick = `onclick="showCinemaDetail(${cinema.id})"`;
    
    col.innerHTML = `
        <div class="card cinema-card h-100" data-cinema-id="${cinema.id}">
            <div class="cinema-image-container position-relative">
                <img src="${imageUrl}" class="cinema-image" alt="${cinema.name}">
                <!-- REMOVED: Quick view button and overlay -->
            </div>
            <div class="card-body">
                <!-- UPDATED: Title with capacity on the right -->
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <h5 class="card-title mb-0">${cinema.name}</h5>
                    <span class="capacity-badge-inline">
                        <i class="fas fa-users me-1"></i>${cinema.capacity || 'N/A'}
                    </span>
                </div>
                
                <div class="cinema-meta mb-2">
                    <span class="city-badge">${cinema.city}</span>
                </div>
                <p class="card-text cinema-description">
                    Modern cinema with state-of-the-art facilities and comfortable seating.
                </p>
                <div class="cinema-details d-flex justify-content-between align-items-center">
                    <small class="text-muted">
                        <i class="fas fa-map-marker-alt me-1"></i>${cinema.city}
                    </small>
                    <div class="rating-stars">
                        ★★★★★
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <a href="#" class="btn-view" ${buttonOnClick}>
                    <i class="fas fa-calendar-alt me-2"></i>
                    View Showtimes
                </a>
            </div>
        </div>
    `;
    
    return col;
}


// Create cinema list item for list view
function createCinemaListItem(cinema, index) {
    const row = document.createElement('div');
    row.className = 'col-12 mb-3';
    
    const imageUrl = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80';
    
    // Handle button logic
    const buttonOnClick = `onclick="showCinemaDetail(${cinema.id})"`;
    const showtimesOnClick = isLoggedIn ? `onclick="handleViewShowtimes(${cinema.id})"` : 'onclick="handleLoginRequired(event, \'showtimes\')"';
    
    row.innerHTML = `
        <div class="card cinema-list-item" data-cinema-id="${cinema.id}">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-2 col-sm-3">
                        <img src="${imageUrl}" class="img-fluid rounded cinema-list-image" alt="${cinema.name}">
                    </div>
                    <div class="col-md-7 col-sm-6">
                        <h5 class="cinema-title mb-2">${cinema.name}</h5>
                        <div class="cinema-meta mb-2">
                            <span class="city-badge me-2">${cinema.city}</span>
                            <span class="capacity-badge">
                                <i class="fas fa-users me-1"></i>${cinema.capacity || 'N/A'} seats
                            </span>
                        </div>
                        <p class="cinema-description text-muted mb-2">
                            Modern cinema facility with comfortable seating and advanced projection systems.
                        </p>
                        <div class="rating-container">
                            <span class="rating-stars text-warning me-2">★★★★★</span>
                            <span class="rating-text">4.5/5</span>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-3 text-end">
                        <div class="btn-group-vertical w-100" role="group">
                            <button type="button" class="btn btn-outline-primary mb-2" ${buttonOnClick}>
                                <i class="fas fa-info-circle me-1"></i>Details
                            </button>
                            <button type="button" class="btn btn-primary" ${showtimesOnClick}>
                                <i class="fas fa-calendar-alt me-1"></i>
                                ${isLoggedIn ? 'View Showtimes' : 'Login to View'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return row;
}

// Setup view controls
function setupViewControls() {
    elements.gridViewBtn.classList.add('active');
    elements.listViewBtn.classList.remove('active');
}

// Switch between grid and list view
function switchView(view) {
    currentView = view;
    
    if (view === 'grid') {
        elements.gridViewBtn.classList.add('active');
        elements.listViewBtn.classList.remove('active');
    } else {
        elements.gridViewBtn.classList.remove('active');
        elements.listViewBtn.classList.add('active');
    }
    
    renderCinemas();
}

// Setup filters functionality
function setupFilters() {
    // Populate city options dynamically from loaded cinemas
    populateCityOptions();
}

// Populate city filter with available cities
function populateCityOptions() {
    if (allCinemas.length === 0) return;
    
    const cities = [...new Set(allCinemas.map(cinema => cinema.city).filter(Boolean))].sort();
    const currentValue = elements.cityFilter.value;
    
    // Clear existing options except "All Cities"
    elements.cityFilter.innerHTML = '<option value="">All Cities</option>';
    
    // Add city options
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        elements.cityFilter.appendChild(option);
    });
    
    // Restore previous selection
    elements.cityFilter.value = currentValue;
}

// Update pagination display and controls
function updatePagination(start, end, total, totalPages) {
    // Update pagination info
    elements.showingStart.textContent = start;
    elements.showingEnd.textContent = end;
    elements.totalCinemas.textContent = total;
    
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
    const totalPages = Math.ceil(filteredCinemas.length / cinemasPerPage);
    
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    renderCinemas();
    
    // Scroll to top of cinemas section
    elements.cinemasGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show cinema detail modal - PUBLIC ACCESS
async function showCinemaDetail(cinemaId) {
    try {
        console.log('Loading cinema detail for ID:', cinemaId);
        
        // Show loading in modal
        if (elements.modalCinemaContent) {
            elements.modalCinemaContent.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading cinema details...</span>
                    </div>
                    <p>Loading cinema details...</p>
                </div>
            `;
        }
        
        // Show modal
        const modal = new bootstrap.Modal(elements.cinemaDetailModal);
        modal.show();
        
        // Get cinema details from local data first (public access)
        const localCinema = allCinemas.find(c => c.id == cinemaId);
        if (localCinema) {
            renderCinemaDetailModal(localCinema);
            if (elements.viewShowtimesBtn) {
                elements.viewShowtimesBtn.dataset.cinemaId = cinemaId;
            }
        } else {
            // If not found locally, try to fetch from API (still public access)
            if (isLoggedIn) {
                const result = await AuthService.graphqlRequest(CINEMA_QUERIES.GET_CINEMA, { id: parseInt(cinemaId) }, true);
                
                if (result && result.data && result.data.cinema) {
                    const cinema = result.data.cinema;
                    renderCinemaDetailModal(cinema);
                    if (elements.viewShowtimesBtn) {
                        elements.viewShowtimesBtn.dataset.cinemaId = cinemaId;
                    }
                } else {
                    elements.modalCinemaContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Cinema details not found.
                        </div>
                    `;
                }
            } else {
                elements.modalCinemaContent.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-sign-in-alt me-2"></i>
                        Cinema details not found in local cache. Please <a href="/login" class="alert-link">login</a> for full access.
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading cinema detail:', error);
        if (elements.modalCinemaContent) {
            elements.modalCinemaContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading cinema details. Please try again.
                </div>
            `;
        }
    }
}

// Render cinema detail in modal
function renderCinemaDetailModal(cinema) {
    const imageUrl = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80';
    
    elements.modalCinemaContent.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <img src="${imageUrl}" class="img-fluid rounded mb-3" alt="${cinema.name}">
            </div>
            <div class="col-md-8">
                <h4 class="mb-3 text-dark">${cinema.name}</h4>
                
                <div class="cinema-info">
                    <div class="row mb-3">
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-map-marker-alt me-2"></i>Location:</strong>
                            <span class="ms-2 text-dark">${cinema.city}</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-users me-2"></i>Capacity:</strong>
                            <span class="ms-2 text-dark">${cinema.capacity || 'N/A'} seats</span>
                        </div>
                        ${cinema.auditoriums && cinema.auditoriums.length > 0 ? `
                        <div class="col-sm-6 mb-2">
                            <strong class="text-dark"><i class="fas fa-door-open me-2"></i>Auditoriums:</strong>
                            <span class="ms-2 text-dark">${cinema.auditoriums.length} theaters</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="cinema-description">
                    <h5 class="text-dark"><i class="fas fa-info-circle me-2"></i>About</h5>
                    <p class="text-dark">
                        ${cinema.name} offers a premium movie-watching experience with state-of-the-art facilities, 
                        comfortable seating, and the latest in audio-visual technology. Located in ${cinema.city}, 
                        it's the perfect destination for your entertainment needs.
                    </p>
                </div>
                
                ${cinema.auditoriums && cinema.auditoriums.length > 0 ? `
                <div class="auditoriums-info">
                    <h5 class="text-dark"><i class="fas fa-door-open me-2"></i>Auditoriums</h5>
                    <div class="row">
                        ${cinema.auditoriums.map(auditorium => `
                            <div class="col-md-6 mb-2">
                                <div class="card border-light">
                                    <div class="card-body py-2">
                                        <h6 class="card-title mb-1 text-dark">${auditorium.name}</h6>
                                        <small class="text-dark">Premium seating available</small>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${isLoggedIn ? `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Ready to book tickets? Click "View Showtimes" to see available movie schedules.
                    </div>
                ` : `
                    <div class="alert alert-warning">
                        <i class="fas fa-sign-in-alt me-2"></i>
                        Please <a href="/login" class="alert-link">login</a> to view showtimes and book tickets.
                    </div>
                `}
            </div>
        </div>
    `;
}

// Handle view showtimes
function handleViewShowtimes(cinemaId) {
    if (!isLoggedIn) {
        handleLoginRequired(event, 'showtimes');
        return;
    }
    
    // Redirect to showtimes for the specific cinema
    window.location.href = `/showtimes?cinemaId=${cinemaId}`;
}

// Handle view showtimes button in modal
function handleViewShowtimes() {
    const cinemaId = elements.viewShowtimesBtn.dataset.cinemaId;
    if (cinemaId) {
        // Close modal first
        const modal = bootstrap.Modal.getInstance(elements.cinemaDetailModal);
        modal.hide();
        
        // Handle view showtimes
        handleViewShowtimes(cinemaId);
    }
}

// Handle login requirement
function handleLoginRequired(event, contentType) {
    if (event) event.preventDefault();
    
    AuthService.showMessage(`Please login to access ${contentType}`, 'info');
    
    // Show a modal or redirect to login after a short delay
    setTimeout(() => {
        const confirmLogin = confirm(`You need to login to view ${contentType}. Go to login page now?`);
        if (confirmLogin) {
            window.location.href = '/login?returnUrl=/cinemas';
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
window.showCinemaDetail = showCinemaDetail;
window.handleViewShowtimes = handleViewShowtimes;
window.changePage = changePage;
window.handleLoginRequired = handleLoginRequired;

// Export for testing and debugging
window.CinemasPage = {
    CINEMA_FIELDS,
    CINEMA_QUERIES,
    loadCinemas,
    renderCinemas,
    createCinemaCard,
    showCinemaDetail,
    handleViewShowtimes,
    applyFilters,
    clearAllFilters,
    switchView,
    changePage
};

console.log('Cinemas.js loaded successfully with full schema consistency');