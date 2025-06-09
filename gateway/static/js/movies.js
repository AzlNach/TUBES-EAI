/**
 * Movies Page JavaScript
 * Konsisten dengan schema.py GraphQL types dan movie-service schema
 * 
 * Schema mappings yang HARUS diikuti dari services/movie-service/src/schema.py:
 * - MovieType: { id, title, genre, duration, description, releaseDate, posterUrl, rating }
 * - Query: { movies, movie(id) } 
 * - Mutation: { createMovie, updateMovie, deleteMovie } (admin only)
 */

// KONSISTEN DENGAN SCHEMA.PY - Field names sesuai movie-service
const MOVIE_FIELDS = {
    id: 'id',
    title: 'title', 
    genre: 'genre',
    duration: 'duration',
    description: 'description',
    releaseDate: 'releaseDate',  // camelCase sesuai schema GraphQL
    posterUrl: 'posterUrl',      // camelCase sesuai schema GraphQL
    rating: 'rating'
};

// GraphQL Queries sesuai movie-service/src/schema.py - DIPERBAIKI: SAMA SEPERTI MAIN.JS
const MOVIE_QUERIES = {
    // DIPERBAIKI: Gunakan publicMovies untuk konsistensi dengan main.js
    GET_MOVIES: `
        query GetMovies {
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
    `,
    GET_MOVIE: `
        query GetMovie($id: Int!) {
            movie(id: $id) {
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
    `
};

// Global state variables
let allMovies = [];
let filteredMovies = [];
let currentPage = 1;
const moviesPerPage = 12;
let currentView = 'grid'; // 'grid' or 'list'
let currentFilters = {
    genre: '',
    rating: '',
    search: '',
    sort: 'title'
};
let isLoggedIn = false;

// DOM Elements cache
let elements = {};

// DOM ready initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Movies page initializing...');
    
    // Cache DOM elements
    cacheElements();
    
    // Initialize authentication state
    isLoggedIn = AuthService.isLoggedIn();
    updateNavigation();
    
    // Initialize page
    initializeMoviesPage();
    
    console.log('Movies page initialized successfully');
});

// Cache frequently used DOM elements
function cacheElements() {
    elements = {
        // Containers
        loadingContainer: document.getElementById('loading-container'),
        moviesGrid: document.getElementById('movies-grid'),
        moviesList: document.getElementById('movies-list'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        paginationContainer: document.getElementById('pagination-container'),
        
        // Filters
        genreFilter: document.getElementById('genre-filter'),
        ratingFilter: document.getElementById('rating-filter'),
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
        totalMovies: document.getElementById('total-movies'),
        
        // Movie count
        movieCount: document.getElementById('movie-count'),
        
        // Modal
        movieDetailModal: document.getElementById('movieDetailModal'),
        modalMovieContent: document.getElementById('modal-movie-content'),
        bookMovieBtn: document.getElementById('book-movie-btn'),
        
        // Error handling
        errorMessage: document.getElementById('error-message'),
        retryLoadBtn: document.getElementById('retry-load')
    };
}

// Initialize the movies page
function initializeMoviesPage() {
    try {
        // Setup event listeners
        setupEventListeners();
        
        // Load initial data
        loadMovies();
        
        // Setup view controls
        setupViewControls();
        
        // Setup filters
        setupFilters();
        
    } catch (error) {
        console.error('Error initializing movies page:', error);
        showErrorState('Failed to initialize page. Please refresh.');
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Filter controls
    elements.genreFilter.addEventListener('change', handleFilterChange);
    elements.ratingFilter.addEventListener('change', handleFilterChange);
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
    elements.bookMovieBtn.addEventListener('click', handleBookMovie);
    
    // Error handling
    elements.retryLoadBtn.addEventListener('click', loadMovies);
    
    // Search input enter key
    elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
}

// Load movies from API - DIPERBAIKI: SAMA SEPERTI MAIN.JS
async function loadMovies() {
    try {
        showLoadingState();
        
        console.log('Loading movies from GraphQL API...');
        
        // DIPERBAIKI: Gunakan method yang sama dengan main.js
        const movies = await AuthService.getMoviesForDisplay();
        
        console.log('Movies loaded successfully:', movies ? movies.length : 0, 'movies');
        
        if (movies && movies.length > 0) {
            allMovies = movies;
            
            // Update movie count
            updateMovieCount(allMovies.length);
            
            // Apply initial filters and render
            applyFilters();
            
        } else {
            console.warn('No movies data received');
            allMovies = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading movies:', error);
        showErrorState('Failed to load movies. Please check your connection and try again.');
    }
}

// Show loading state
function showLoadingState() {
    elements.loadingContainer.style.display = 'block';
    elements.moviesGrid.style.display = 'none';
    elements.moviesList.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Show error state
function showErrorState(message = 'An error occurred') {
    elements.loadingContainer.style.display = 'none';
    elements.moviesGrid.style.display = 'none';
    elements.moviesList.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'block';
    elements.paginationContainer.style.display = 'none';
    
    elements.errorMessage.textContent = message;
}

// Show empty state
function showEmptyState() {
    elements.loadingContainer.style.display = 'none';
    elements.moviesGrid.style.display = 'none';
    elements.moviesList.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Update movie count badge
function updateMovieCount(count) {
    elements.movieCount.innerHTML = `<i class="fas fa-video me-1"></i>${count} Movies`;
}

// Handle filter changes
function handleFilterChange() {
    currentFilters.genre = elements.genreFilter.value;
    currentFilters.rating = elements.ratingFilter.value;
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
        // Start with all movies
        let filtered = [...allMovies];
        
        // Apply genre filter
        if (currentFilters.genre) {
            filtered = filtered.filter(movie => 
                movie.genre && movie.genre.toLowerCase() === currentFilters.genre.toLowerCase()
            );
        }
        
        // Apply rating filter
        if (currentFilters.rating) {
            const minRating = parseFloat(currentFilters.rating);
            filtered = filtered.filter(movie => 
                movie.rating && parseFloat(movie.rating) >= minRating
            );
        }
        
        // Apply search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            filtered = filtered.filter(movie => 
                movie.title && movie.title.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply sorting
        filtered = sortMovies(filtered, currentFilters.sort);
        
        filteredMovies = filtered;
        currentPage = 1; // Reset to first page
        
        console.log('Filters applied:', {
            total: allMovies.length,
            filtered: filteredMovies.length,
            filters: currentFilters
        });
        
        renderMovies();
        
    } catch (error) {
        console.error('Error applying filters:', error);
        showErrorState('Error filtering movies');
    }
}

// Sort movies based on criteria
function sortMovies(movies, sortBy) {
    return movies.sort((a, b) => {
        switch (sortBy) {
            case 'title':
                return (a.title || '').localeCompare(b.title || '');
            case 'rating':
                return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
            case 'duration':
                return (parseInt(b.duration) || 0) - (parseInt(a.duration) || 0);
            case 'genre':
                return (a.genre || '').localeCompare(b.genre || '');
            default:
                return 0;
        }
    });
}

// Clear all filters
function clearAllFilters() {
    elements.genreFilter.value = '';
    elements.ratingFilter.value = '';
    elements.sortFilter.value = 'title';
    elements.searchInput.value = '';
    
    currentFilters = {
        genre: '',
        rating: '',
        search: '',
        sort: 'title'
    };
    
    applyFilters();
}

// Render movies based on current view and pagination
function renderMovies() {
    if (filteredMovies.length === 0) {
        showEmptyState();
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
    const startIndex = (currentPage - 1) * moviesPerPage;
    const endIndex = Math.min(startIndex + moviesPerPage, filteredMovies.length);
    const currentMovies = filteredMovies.slice(startIndex, endIndex);
    
    // Hide loading and error states
    elements.loadingContainer.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    
    // Render based on current view
    if (currentView === 'grid') {
        renderGridView(currentMovies);
    } else {
        renderListView(currentMovies);
    }
    
    // Update pagination
    updatePagination(startIndex + 1, endIndex, filteredMovies.length, totalPages);
}

// Render grid view
function renderGridView(movies) {
    elements.moviesGrid.style.display = 'flex';
    elements.moviesList.style.display = 'none';
    elements.paginationContainer.style.display = 'block';
    
    elements.moviesGrid.innerHTML = '';
    
    movies.forEach((movie, index) => {
        const movieCard = createMovieCard(movie, index);
        elements.moviesGrid.appendChild(movieCard);
    });
    
    // Add animation classes
    setTimeout(() => {
        elements.moviesGrid.querySelectorAll('.movie-card').forEach((card, index) => {
            card.classList.add('animate-movie-in');
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }, 50);
}

// Render list view
function renderListView(movies) {
    elements.moviesGrid.style.display = 'none';
    elements.moviesList.style.display = 'block';
    elements.paginationContainer.style.display = 'block';
    
    elements.moviesList.innerHTML = '';
    
    movies.forEach((movie, index) => {
        const movieListItem = createMovieListItem(movie, index);
        elements.moviesList.appendChild(movieListItem);
    });
}

// Create movie card for grid view - DIPERBAIKI: SESUAI DENGAN CSS STYLING
function createMovieCard(movie, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 col-sm-6 mb-4';
    
    // DIPERBAIKI: Handle posterUrl dari database dengan prioritas
    const posterUrl = movie.posterUrl || movie.poster_url || 'https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster';
    
    // DIPERBAIKI: Handle rating display dengan parsing yang benar
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const stars = movie.rating ? '★'.repeat(Math.round(parseFloat(movie.rating) / 2)) : '☆☆☆☆☆';
    
    // Handle release date
    const releaseDate = movie.releaseDate || movie.release_date || null;
    const releaseDateDisplay = releaseDate ? new Date(releaseDate).getFullYear() : 'TBD';
    
    // DIPERBAIKI: Gunakan logika yang sama dengan main.js untuk button handling
    const buttonOnClick = `onclick="showMovieDetail(${movie.id})"`;
    
    // DIPERBAIKI: Struktur HTML yang sesuai dengan CSS styling
    col.innerHTML = `
        <div class="card movie-card h-100" data-movie-id="${movie.id}">
            <div class="movie-poster-container position-relative">
                <img src="${posterUrl}" class="movie-poster" alt="${movie.title}" 
                     onerror="this.src='https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster'">
                <div class="movie-overlay">
                    <button class="btn btn-primary btn-sm movie-quick-view" ${buttonOnClick}>
                        <i class="fas fa-eye me-1"></i>Quick View
                    </button>
                </div>
                <div class="movie-rating-badge">
                    <span class="badge bg-warning text-dark">
                        <i class="fas fa-star me-1"></i>${rating}
                    </span>
                </div>
            </div>
            <div class="card-body">
                <h5 class="card-title">${movie.title}</h5>
                <div class="movie-meta">
                    <span class="genre-badge">${movie.genre}</span>
                    <span class="year-badge">${releaseDateDisplay}</span>
                </div>
                <p class="card-text movie-description">
                    ${movie.description ? 
                        (movie.description.length > 100 ? 
                            movie.description.substring(0, 100) + '...' : 
                            movie.description) 
                        : 'No description available'}
                </p>
                <div class="movie-details d-flex justify-content-between align-items-center">
                    <small class="text-muted">
                        <i class="fas fa-clock me-1"></i>${movie.duration || 'N/A'} min
                    </small>
                    <div class="rating-stars">
                        ${stars}
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <a href="#" class="btn-view" ${buttonOnClick}>
                    <i class="fas fa-ticket-alt me-2"></i>
                    ${isLoggedIn ? 'Book Tickets' : 'View Details'}
                </a>
            </div>
        </div>
    `;
    
    return col;
}

// Create movie list item for list view
function createMovieListItem(movie, index) {
    const row = document.createElement('div');
    row.className = 'col-12 mb-3';
    
    const posterUrl = movie.posterUrl || movie.poster_url || 'https://via.placeholder.com/150x225/e2e8f0/64748b?text=No+Poster';
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const stars = movie.rating ? '★'.repeat(Math.round(movie.rating / 2)) : '☆☆☆☆☆';
    const releaseDate = movie.releaseDate || movie.release_date || null;
    const releaseDateDisplay = releaseDate ? new Date(releaseDate).getFullYear() : 'TBD';
    
    // DIPERBAIKI: Gunakan logika yang sama dengan main.js untuk button handling
    const buttonOnClick = isLoggedIn ? `onclick="showMovieDetail(${movie.id})"` : 'onclick="handleLoginRequired(event, \'movie details\')"';
    const bookingOnClick = isLoggedIn ? `onclick="handleMovieBooking(${movie.id})"` : 'onclick="handleLoginRequired(event, \'movie booking\')"';
    
    row.innerHTML = `
        <div class="card movie-list-item" data-movie-id="${movie.id}">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-2 col-sm-3">
                        <img src="${posterUrl}" class="img-fluid rounded movie-list-poster" alt="${movie.title}"
                             onerror="this.src='https://via.placeholder.com/150x225/e2e8f0/64748b?text=No+Poster'">
                    </div>
                    <div class="col-md-7 col-sm-6">
                        <h5 class="movie-title mb-2">${movie.title}</h5>
                        <div class="movie-meta mb-2">
                            <span class="genre-badge me-2">${movie.genre}</span>
                            <span class="year-badge me-2">${releaseDateDisplay}</span>
                            <span class="duration-badge">
                                <i class="fas fa-clock me-1"></i>${movie.duration || 'N/A'} min
                            </span>
                        </div>
                        <p class="movie-description text-muted mb-2">
                            ${movie.description || 'No description available'}
                        </p>
                        <div class="rating-container">
                            <span class="rating-stars text-warning me-2">${stars}</span>
                            <span class="rating-text">${rating}/10</span>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-3 text-end">
                        <div class="btn-group-vertical w-100" role="group">
                            <button type="button" class="btn btn-outline-primary mb-2" ${buttonOnClick}>
                                <i class="fas fa-info-circle me-1"></i>Details
                            </button>
                            <button type="button" class="btn btn-primary" ${bookingOnClick}>
                                <i class="fas fa-ticket-alt me-1"></i>
                                ${isLoggedIn ? 'Book Tickets' : 'Login to Book'}
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
    
    renderMovies();
}

// Setup filters functionality
function setupFilters() {
    // Populate genre options dynamically from loaded movies
    populateGenreOptions();
}

// Populate genre filter with available genres
function populateGenreOptions() {
    if (allMovies.length === 0) return;
    
    const genres = [...new Set(allMovies.map(movie => movie.genre).filter(Boolean))].sort();
    const currentValue = elements.genreFilter.value;
    
    // Clear existing options except "All Genres"
    elements.genreFilter.innerHTML = '<option value="">All Genres</option>';
    
    // Add genre options
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        elements.genreFilter.appendChild(option);
    });
    
    // Restore previous selection
    elements.genreFilter.value = currentValue;
}

// Update pagination display and controls
function updatePagination(start, end, total, totalPages) {
    // Update pagination info
    elements.showingStart.textContent = start;
    elements.showingEnd.textContent = end;
    elements.totalMovies.textContent = total;
    
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
    const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
    
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    renderMovies();
    
    // Scroll to top of movies section
    elements.moviesGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show movie detail modal - DIPERBAIKI: HANDLE AUTH REQUIREMENT
async function showMovieDetail(movieId) {
    try {
        console.log('Loading movie detail for ID:', movieId);
        
        // Show loading in modal
        if (elements.modalMovieContent) {
            elements.modalMovieContent.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading movie details...</span>
                    </div>
                    <p>Loading movie details...</p>
                </div>
            `;
        }
        
        // Show modal
        const modal = new bootstrap.Modal(elements.movieDetailModal);
        modal.show();
        
        // Get movie details from local data first (no auth required for basic details)
        const localMovie = allMovies.find(m => m.id == movieId);
        if (localMovie) {
            renderMovieDetailModal(localMovie);
            if (elements.bookMovieBtn) {
                elements.bookMovieBtn.dataset.movieId = movieId;
            }
        } else {
            // If not found locally and user is logged in, try to fetch from API
            if (isLoggedIn) {
                const result = await AuthService.graphqlRequest(MOVIE_QUERIES.GET_MOVIE, { id: parseInt(movieId) }, true);
                
                if (result && result.data && result.data.movie) {
                    const movie = result.data.movie;
                    renderMovieDetailModal(movie);
                    if (elements.bookMovieBtn) {
                        elements.bookMovieBtn.dataset.movieId = movieId;
                    }
                } else {
                    elements.modalMovieContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Movie details not found.
                        </div>
                    `;
                }
            } else {
                elements.modalMovieContent.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-sign-in-alt me-2"></i>
                        Movie details not found in local cache. Please <a href="/login" class="alert-link">login</a> for full access.
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading movie detail:', error);
        if (elements.modalMovieContent) {
            elements.modalMovieContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading movie details. Please try again.
                </div>
            `;
        }
    }
}

// Render movie detail in modal
function renderMovieDetailModal(movie) {
    const posterUrl = movie.posterUrl || movie.poster_url || 'https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster';
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const stars = movie.rating ? '★'.repeat(Math.round(parseFloat(movie.rating) / 2)) : '☆☆☆☆☆';
    const releaseDate = movie.releaseDate || movie.release_date || null;
    const releaseDateDisplay = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'To be determined';
    
    elements.modalMovieContent.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <img src="${posterUrl}" class="img-fluid rounded shadow" alt="${movie.title}"
                     onerror="this.src='https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster'">
            </div>
            <div class="col-md-8">
                <h3 class="movie-title mb-3">${movie.title}</h3>
                
                <div class="movie-meta mb-4">
                    <div class="row">
                        <div class="col-sm-6 mb-2">
                            <strong><i class="fas fa-tags me-2"></i>Genre:</strong>
                            <span class="genre-badge ms-2">${movie.genre}</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong><i class="fas fa-clock me-2"></i>Duration:</strong>
                            <span class="ms-2">${movie.duration || 'N/A'} minutes</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong><i class="fas fa-star me-2"></i>Rating:</strong>
                            <span class="rating-stars text-warning ms-2">${stars}</span>
                            <span class="ms-1">${rating}/10</span>
                        </div>
                        <div class="col-sm-6 mb-2">
                            <strong><i class="fas fa-calendar me-2"></i>Release Date:</strong>
                            <span class="ms-2">${releaseDateDisplay}</span>
                        </div>
                    </div>
                </div>
                
                <div class="movie-description">
                    <h5><i class="fas fa-align-left me-2"></i>Description</h5>
                    <p class="text-muted">${movie.description || 'No description available for this movie.'}</p>
                </div>
                
                ${isLoggedIn ? `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Ready to book tickets for this movie? Click "Book Tickets" to see available showtimes.
                    </div>
                ` : `
                    <div class="alert alert-warning">
                        <i class="fas fa-sign-in-alt me-2"></i>
                        Please <a href="/login" class="alert-link">login</a> to book tickets for this movie.
                    </div>
                `}
            </div>
        </div>
    `;
}

// Handle movie booking
function handleMovieBooking(movieId) {
    if (!isLoggedIn) {
        // DIPERBAIKI: Gunakan fungsi yang sama dengan main.js
        handleLoginRequired(event, 'movie booking');
        return;
    }
    
    // Redirect to showtimes for the specific movie
    window.location.href = `/showtimes?movieId=${movieId}`;
}

// Handle book movie button in modal
function handleBookMovie() {
    const movieId = elements.bookMovieBtn.dataset.movieId;
    if (movieId) {
        // Close modal first
        const modal = bootstrap.Modal.getInstance(elements.movieDetailModal);
        modal.hide();
        
        // Handle booking
        handleMovieBooking(movieId);
    }
}

// DIPERBAIKI: TAMBAHKAN FUNGSI YANG SAMA DENGAN MAIN.JS
function handleLoginRequired(event, contentType) {
    if (event) event.preventDefault();
    
    AuthService.showMessage(`Please login to access ${contentType}`, 'info');
    
    // Show a modal or redirect to login after a short delay
    setTimeout(() => {
        const confirmLogin = confirm(`You need to login to view ${contentType}. Go to login page now?`);
        if (confirmLogin) {
            window.location.href = '/login?returnUrl=/movies';
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
window.showMovieDetail = showMovieDetail;
window.handleMovieBooking = handleMovieBooking;
window.changePage = changePage;
window.handleLoginRequired = handleLoginRequired; // DIPERBAIKI: TAMBAHKAN INI

// Export for testing and debugging
window.MoviesPage = {
    MOVIE_FIELDS,
    MOVIE_QUERIES,
    loadMovies,
    renderMovies,
    createMovieCard,
    showMovieDetail,
    handleMovieBooking,
    applyFilters,
    clearAllFilters,
    switchView,
    changePage
};

console.log('Movies.js loaded successfully with full schema consistency');