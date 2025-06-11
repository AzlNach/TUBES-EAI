/**
 * Admin Movies Management JavaScript
 * Handles CRUD operations for movies in admin panel
 */

const FALLBACK_IMAGES = {
    poster: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjZTJlOGYwIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjI1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjQ3NDhiIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiPk5vIFBvc3RlcjwvdGV4dD4KPHN2Zz4=',
    
    small: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNzUiIHZpZXdCb3g9IjAgMCA1MCA3NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9Ijc1IiBmaWxsPSIjZTJlOGYwIi8+Cjx0ZXh0IHg9IjI1IiB5PSIzNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY0NzQ4YiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiPk5vPC90ZXh0Pgo8dGV4dCB4PSIyNSIgeT0iNDciIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2NDc0OGIiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4Ij5Qb3N0ZXI8L3RleHQ+Cjwvc3ZnPgo=',
    
    large: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgODAgMTIwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZTJlOGYwIi8+Cjx0ZXh0IHg9IjQwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY0NzQ4YiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIj5ObyBQb3N0ZXI8L3RleHQ+Cjwvc3ZnPgo='
};

// Global state
let allMovies = [];
let filteredMovies = [];
let currentPage = 1;
const moviesPerPage = 12;
let currentView = 'grid';
let currentFilters = {
    genre: '',
    search: '',
    rating: ''
};

// DOM Elements
let elements = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Check admin authentication
    if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
        window.location.href = '/admin/login';
        return;
    }

    cacheElements();
    setupEventListeners();
    loadMovies();
});

// Cache DOM elements
function cacheElements() {
    elements = {
        // ✅ Main containers
        loadingContainer: document.getElementById('loading-container'),
        moviesGrid: document.getElementById('movies-grid'),
        moviesList: document.getElementById('movies-list'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        paginationContainer: document.getElementById('pagination-container'),
        
        // ✅ Stats elements
        totalMoviesCount: document.getElementById('total-movies'),
        showingStart: document.getElementById('showing-start'),
        showingEnd: document.getElementById('showing-end'),
        
        // ✅ Filter elements
        searchInput: document.getElementById('search-input'),
        genreFilter: document.getElementById('genre-filter'),
        ratingFilter: document.getElementById('rating-filter'),
        sortSelect: document.getElementById('sort-select'),
        clearFiltersBtn: document.getElementById('clear-filters-btn'),
        
        // ✅ View controls
        gridViewBtn: document.getElementById('grid-view-btn'),
        listViewBtn: document.getElementById('list-view-btn'),
        
        // ✅ Modals
        addMovieModal: document.getElementById('addMovieModal'),
        editMovieModal: document.getElementById('editMovieModal'),
        deleteMovieModal: document.getElementById('deleteMovieModal'),
        
        // ✅ Forms
        addMovieForm: document.getElementById('add-movie-form'),
        editMovieForm: document.getElementById('edit-movie-form'),
        
        // ✅ Buttons
        saveMovieBtn: document.getElementById('save-movie'),
        updateMovieBtn: document.getElementById('update-movie'),
        confirmDeleteBtn: document.getElementById('confirm-delete-movie'),
        
        // ✅ Delete modal elements
        deleteMovieTitle: document.getElementById('delete-movie-title'),
        
        // ✅ Pagination
        paginationControls: document.getElementById('pagination-controls')
    };
    
    console.log('✅ Elements cached:', Object.keys(elements).length, 'elements found');
}

// Setup event listeners
function setupEventListeners() {
    // Search input
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleFilterChange, 300));
    }
    
    // Filter selects
    if (elements.genreFilter) {
        elements.genreFilter.addEventListener('change', handleFilterChange);
    }
    
    if (elements.ratingFilter) {
        elements.ratingFilter.addEventListener('change', handleFilterChange);
    }
    
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', handleFilterChange);
    }
    
    // View controls
    if (elements.gridViewBtn) {
        elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    }
    
    if (elements.listViewBtn) {
        elements.listViewBtn.addEventListener('click', () => switchView('list'));
    }
    
    // Clear filters button
    if (elements.clearFiltersBtn) {
        elements.clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // Form submissions with proper error handling
    if (elements.addMovieForm) {
        elements.addMovieForm.addEventListener('submit', handleSaveMovie);
    }
    
    if (elements.editMovieForm) {
        elements.editMovieForm.addEventListener('submit', handleUpdateMovie);
    }
    
    // Delete confirmation
    if (elements.confirmDeleteBtn) {
        elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }
    
    console.log('✅ All event listeners setup successfully');
}

// Load movies from API
async function loadMovies() {
    try {
        showLoadingState();
        console.log('Loading movies for admin...');
        
        // ✅ Check if AdminAuth is available
        if (typeof AdminAuth === 'undefined' || typeof AdminAuth.getMovies !== 'function') {
            throw new Error('AdminAuth.getMovies method is not available');
        }
        
        const movies = await AdminAuth.getMovies();
        console.log('Movies received from API:', movies);
        
        if (movies && movies.length > 0) {
            allMovies = movies;
            updateStats(movies);
            applyFilters();
            populateGenreFilter();
            console.log(`✅ Loaded ${movies.length} movies successfully`);
        } else {
            allMovies = [];
            filteredMovies = [];
            updateStats([]);
            showEmptyState();
            console.log('⚠️ No movies found');
        }
    } catch (error) {
        console.error('❌ Error loading movies:', error);
        showErrorState('Failed to load movies: ' + error.message);
    }
}

// Update statistics
function updateStats(movies) {
    const totalMovies = movies.length;
    const activeMovies = movies.filter(movie => {
        const releaseDate = movie.releaseDate || movie.release_date;
        return releaseDate && new Date(releaseDate) <= new Date();
    }).length;
    const genres = [...new Set(movies.map(movie => movie.genre))].filter(Boolean);
    const ratingsSum = movies.reduce((sum, movie) => {
        const rating = parseFloat(movie.rating) || 0;
        return sum + rating;
    }, 0);
    const avgRating = totalMovies > 0 ? (ratingsSum / totalMovies).toFixed(1) : '0.0';

    // Update stats cards
    if (elements.totalMoviesCount) {
        elements.totalMoviesCount.textContent = totalMovies;
    }
    if (elements.activeMoviesCount) {
        elements.activeMoviesCount.textContent = activeMovies;
    }
    if (elements.genresCount) {
        elements.genresCount.textContent = genres.length;
    }
    if (elements.avgRating) {
        elements.avgRating.textContent = avgRating;
    }
    
    console.log('Stats updated:', { totalMovies, activeMovies, genres: genres.length, avgRating });
}

// Show loading state
function showLoadingState() {
    hideAllContainers();
    if (elements.loadingContainer) {
        elements.loadingContainer.style.display = 'block';
    }
}

// Show empty state
function showEmptyState() {
    hideAllContainers();
    if (elements.emptyState) {
        elements.emptyState.style.display = 'block';
    }
}

// Show error state
function showErrorState(message) {
    hideAllContainers();
    if (elements.errorState) {
        elements.errorState.style.display = 'block';
    }
    
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
}

// Hide all containers
function hideAllContainers() {
    const containers = [
        elements.loadingContainer,
        elements.moviesGrid,
        elements.moviesList,
        elements.emptyState,
        elements.errorState,
        elements.paginationContainer
    ];
    
    containers.forEach(container => {
        if (container) {
            container.style.display = 'none';
        }
    });
}

// Apply filters and render movies
function applyFilters() {
    filteredMovies = allMovies.filter(movie => {
        const matchesGenre = !currentFilters.genre || movie.genre === currentFilters.genre;
        const matchesSearch = !currentFilters.search || 
            movie.title.toLowerCase().includes(currentFilters.search.toLowerCase()) ||
            movie.genre.toLowerCase().includes(currentFilters.search.toLowerCase()) ||
            (movie.description && movie.description.toLowerCase().includes(currentFilters.search.toLowerCase()));
        
        const matchesRating = !currentFilters.rating || 
            (movie.rating && parseFloat(movie.rating) >= parseFloat(currentFilters.rating));
        
        return matchesGenre && matchesSearch && matchesRating;
    });
    
    currentPage = 1;
    renderMovies();
}

// Handle filter changes
function handleFilterChange() {
    if (elements.genreFilter) {
        currentFilters.genre = elements.genreFilter.value;
        applyFilters();
    }
}

// Handle rating filter changes
function handleRatingFilterChange() {
    if (elements.ratingFilter) {
        currentFilters.rating = elements.ratingFilter.value;
        applyFilters();
    }
}

// Handle search input
function handleSearchInput() {
    if (elements.searchInput) {
        currentFilters.search = elements.searchInput.value;
        applyFilters();
    }
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
        currentFilters.search = '';
        applyFilters();
    }
}

// Clear all filters
function clearAllFilters() {
    if (elements.genreFilter) {
        elements.genreFilter.value = '';
        currentFilters.genre = '';
    }
    if (elements.ratingFilter) {
        elements.ratingFilter.value = '';
        currentFilters.rating = '';
    }
    if (elements.searchInput) {
        elements.searchInput.value = '';
        currentFilters.search = '';
    }
    applyFilters();
}

// Switch view
function switchView(view) {
    currentView = view;
    
    // Update button states
    if (elements.gridViewBtn) {
        elements.gridViewBtn.classList.toggle('active', view === 'grid');
    }
    if (elements.listViewBtn) {
        elements.listViewBtn.classList.toggle('active', view === 'list');
    }
    
    renderMovies();
}

// Render movies
function renderMovies() {
    if (filteredMovies.length === 0) {
        showEmptyState();
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
    const startIndex = (currentPage - 1) * moviesPerPage;
    const endIndex = Math.min(startIndex + moviesPerPage, filteredMovies.length);
    const pageMovies = filteredMovies.slice(startIndex, endIndex);
    
    // Show appropriate container
    hideAllContainers();
    
    if (currentView === 'grid') {
        if (elements.moviesGrid) {
            elements.moviesGrid.style.display = 'flex';
            elements.moviesGrid.style.flexWrap = 'wrap';
            renderGridView(pageMovies);
        }
    } else {
        if (elements.moviesList) {
            elements.moviesList.style.display = 'block';
            renderListView(pageMovies);
        }
    }
    
    // Update pagination
    updatePagination(startIndex + 1, endIndex, filteredMovies.length, totalPages);
    if (elements.paginationContainer) {
        elements.paginationContainer.style.display = 'flex';
    }
}

// Render grid view
function renderGridView(movies) {
    if (!elements.moviesGrid) return;
    
    elements.moviesGrid.innerHTML = '';
    
    movies.forEach(movie => {
        const movieCard = createMovieCard(movie);
        elements.moviesGrid.appendChild(movieCard);
    });
}

// Render list view
function renderListView(movies) {
    if (!elements.moviesList) return;
    
    elements.moviesList.innerHTML = '';
    
    const table = document.createElement('div');
    table.className = 'table-responsive';
    table.innerHTML = `
        <table class="table table-hover">
            <thead class="table-light">
                <tr>
                    <th style="width: 80px;">Poster</th>
                    <th>Title</th>
                    <th>Genre</th>
                    <th>Duration</th>
                    <th>Rating</th>
                    <th>Release Date</th>
                    <th style="width: 120px;">Actions</th>
                </tr>
            </thead>
            <tbody id="movies-table-body">
            </tbody>
        </table>
    `;
    
    elements.moviesList.appendChild(table);
    
    const tbody = document.getElementById('movies-table-body');
    movies.forEach(movie => {
        const row = createMovieRow(movie);
        tbody.appendChild(row);
    });
}

// Create movie card
function createMovieCard(movie) {
    const col = document.createElement('div');
    col.className = 'col-xl-3 col-lg-4 col-md-6 col-sm-6 mb-4';
    
    // ✅ FIX: Use reliable fallback instead of via.placeholder.com
    const posterUrl = movie.posterUrl || movie.poster_url || FALLBACK_IMAGES.poster;
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const releaseDate = movie.releaseDate || movie.release_date;
    const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';
    const description = movie.description ? 
        (movie.description.length > 100 ? movie.description.substring(0, 100) + '...' : movie.description) : 
        'No description available';
    
    col.innerHTML = `
        <div class="card h-100 movie-card shadow-sm">
            <div class="position-relative">
                <img src="${posterUrl}" alt="${movie.title}" class="card-img-top" 
                     style="height: 300px; object-fit: cover;"
                     onerror="this.src='${FALLBACK_IMAGES.poster}'">
                <div class="movie-overlay position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
                     style="background: rgba(0,0,0,0.7); opacity: 0; transition: opacity 0.3s;">
                    <div class="movie-actions">
                        <button class="btn btn-sm btn-primary me-2" onclick="editMovie(${movie.id})" title="Edit Movie">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteMovie(${movie.id})" title="Delete Movie">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <h6 class="card-title movie-title mb-2" style="height: 2.5em; overflow: hidden; line-height: 1.25em;">${movie.title}</h6>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge bg-primary">${movie.genre}</span>
                    <small class="text-muted">${movie.duration} min</small>
                </div>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <small class="text-muted">${formattedDate}</small>
                    <div class="rating-stars">
                        ⭐ ${rating}
                    </div>
                </div>
                <p class="card-text text-muted small" style="height: 3em; overflow: hidden; font-size: 0.8em;">
                    ${description}
                </p>
            </div>
        </div>
    `;
    
    // Add hover effect
    const card = col.querySelector('.movie-card');
    const overlay = col.querySelector('.movie-overlay');
    
    card.addEventListener('mouseenter', () => {
        overlay.style.opacity = '1';
    });
    
    card.addEventListener('mouseleave', () => {
        overlay.style.opacity = '0';
    });
    
    return col;
}

// Create movie row
function createMovieRow(movie) {
    const row = document.createElement('tr');
    
    // ✅ FIX: Use reliable fallback instead of via.placeholder.com
    const posterUrl = movie.posterUrl || movie.poster_url || FALLBACK_IMAGES.small;
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const releaseDate = movie.releaseDate || movie.release_date || null;
    const releaseDateDisplay = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'TBD';
    
    row.innerHTML = `
        <td>
            <img src="${posterUrl}" alt="${movie.title}" style="width: 50px; height: 75px; object-fit: cover; border-radius: 4px;"
                 onerror="this.src='${FALLBACK_IMAGES.small}'">
        </td>
        <td>
            <div class="fw-semibold">${movie.title}</div>
            <small class="text-muted">${movie.description ? 
                (movie.description.length > 50 ? movie.description.substring(0, 50) + '...' : movie.description) 
                : 'No description'}</small>
        </td>
        <td><span class="badge bg-primary">${movie.genre}</span></td>
        <td>${movie.duration || 'N/A'} min</td>
        <td>
            <div class="d-flex align-items-center">
                <span class="rating-stars text-warning me-2">★</span>
                <span>${rating}/10</span>
            </div>
        </td>
        <td>${releaseDateDisplay}</td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-primary" onclick="editMovie(${movie.id})" title="Edit Movie">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-outline-danger" onclick="confirmDeleteMovie(${movie.id})" title="Delete Movie">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Populate genre filter
function populateGenreFilter() {
    if (!elements.genreFilter) return;
    
    const genres = [...new Set(allMovies.map(movie => movie.genre))].filter(Boolean).sort();
    
    // Store current value
    const currentValue = elements.genreFilter.value;
    
    // Clear existing options except "All Genres"
    const firstOption = elements.genreFilter.firstElementChild;
    elements.genreFilter.innerHTML = '';
    elements.genreFilter.appendChild(firstOption);
    
    // Add genre options
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        elements.genreFilter.appendChild(option);
    });
    
    // Restore value if it still exists
    if (currentValue && genres.includes(currentValue)) {
        elements.genreFilter.value = currentValue;
    }
    
    console.log('Genre filter populated with:', genres);
}

// Update pagination
function updatePagination(start, end, total, totalPages) {
    if (elements.showingStart) elements.showingStart.textContent = start;
    if (elements.showingEnd) elements.showingEnd.textContent = end;
    if (elements.totalMovies) elements.totalMovies.textContent = total;
    
    if (!elements.paginationControls) return;
    
    // Generate pagination controls
    elements.paginationControls.innerHTML = '';
    
    // Previous button
    const prevBtn = document.createElement('li');
    prevBtn.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = `<a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>`;
    elements.paginationControls.appendChild(prevBtn);
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('li');
        pageBtn.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageBtn.innerHTML = `<a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>`;
        elements.paginationControls.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('li');
    nextBtn.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = `<a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>`;
    elements.paginationControls.appendChild(nextBtn);
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
    if (page < 1 || page > totalPages) return false;
    
    currentPage = page;
    renderMovies();
    
    // Scroll to top
    const contentWrapper = document.querySelector('.content-wrapper');
    if (contentWrapper) {
        contentWrapper.scrollTop = 0;
    }
    
    return false;
}

// Handle save movie
async function handleSaveMovie(event) {
    event.preventDefault();
    
    try {
        // Get form data
        const formData = getFormData('add-movie-form');
        console.log('Creating movie with data:', formData);
        
        // Validate form
        if (!validateMovieForm(formData, 'add-movie-form')) {
            return;
        }
        
        // Set loading state
        setButtonLoading(elements.saveMovieBtn, true);
        
        // Create movie
        const result = await AdminAuth.createMovie(formData);
        console.log('Create movie result:', result);
        
        if (result.success) {
            showSuccessMessage('Movie created successfully!');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.addMovieModal);
            if (modal) modal.hide();
            
            // Reload movies
            await loadMovies();
        } else {
            showErrorMessage(result.message || 'Failed to create movie');
        }
    } catch (error) {
        console.error('Error creating movie:', error);
        showErrorMessage(error.message || 'Failed to create movie');
    } finally {
        setButtonLoading(elements.saveMovieBtn, false);
    }
}

// Edit movie
async function editMovie(movieId) {
    try {
        const movie = allMovies.find(m => m.id === movieId);
        if (!movie) {
            showErrorMessage('Movie not found');
            return;
        }
        
        console.log('Editing movie:', movie);
        
        // Populate edit form
        document.getElementById('edit-movie-id').value = movie.id;
        document.getElementById('edit-movie-title').value = movie.title || '';
        document.getElementById('edit-movie-genre').value = movie.genre || '';
        document.getElementById('edit-movie-duration').value = movie.duration || '';
        document.getElementById('edit-movie-rating').value = movie.rating || '';
        
        // Handle date formatting
        const releaseDate = movie.releaseDate || movie.release_date;
        if (releaseDate) {
            const date = new Date(releaseDate);
            if (!isNaN(date.getTime())) {
                document.getElementById('edit-movie-release-date').value = date.toISOString().split('T')[0];
            }
        }
        
        document.getElementById('edit-movie-poster-url').value = movie.posterUrl || movie.poster_url || '';
        document.getElementById('edit-movie-description').value = movie.description || '';
        
        // Show modal
        const modal = new bootstrap.Modal(elements.editMovieModal);
        modal.show();
    } catch (error) {
        console.error('Error editing movie:', error);
        showErrorMessage('Failed to load movie data');
    }
}

// Handle update movie
async function handleUpdateMovie(event) {
    event.preventDefault();
    
    try {
        // Get form data
        const movieId = parseInt(document.getElementById('edit-movie-id').value);
        const formData = getFormData('edit-movie-form');
        console.log('Updating movie with data:', formData);
        
        // Validate form
        if (!validateMovieForm(formData, 'edit-movie-form')) {
            return;
        }
        
        // Set loading state
        setButtonLoading(elements.updateMovieBtn, true);
        
        // Update movie
        const result = await AdminAuth.updateMovie(movieId, formData);
        console.log('Update movie result:', result);
        
        if (result.success) {
            showSuccessMessage('Movie updated successfully!');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.editMovieModal);
            if (modal) modal.hide();
            
            // Reload movies
            await loadMovies();
        } else {
            showErrorMessage(result.message || 'Failed to update movie');
        }
    } catch (error) {
        console.error('Error updating movie:', error);
        showErrorMessage(error.message || 'Failed to update movie');
    } finally {
        setButtonLoading(elements.updateMovieBtn, false);
    }
}

// Confirm delete movie (show modal)
async function confirmDeleteMovie(movieId) {
    try {
        const movie = allMovies.find(m => m.id === movieId);
        if (!movie) {
            showErrorMessage('Movie not found');
            return;
        }
        
        // Store movie ID for deletion
        elements.confirmDeleteBtn.dataset.movieId = movieId;
        
        // Update modal content
        if (elements.deleteMovieTitle) {
            elements.deleteMovieTitle.textContent = movie.title;
        }
        
        // Show modal
        const modal = new bootstrap.Modal(elements.deleteMovieModal);
        modal.show();
    } catch (error) {
        console.error('Error preparing delete modal:', error);
        showErrorMessage('Failed to prepare delete confirmation');
    }
}

// Handle confirm delete
async function handleConfirmDelete() {
    try {
        const movieId = parseInt(elements.confirmDeleteBtn.dataset.movieId);
        if (!movieId) {
            showErrorMessage('Movie ID not found');
            return;
        }
        
        console.log('Deleting movie:', movieId);
        
        // Set loading state
        setButtonLoading(elements.confirmDeleteBtn, true);
        
        // Delete movie
        const result = await AdminAuth.deleteMovie(movieId);
        console.log('Delete movie result:', result);
        
        if (result.success) {
            showSuccessMessage('Movie deleted successfully!');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.deleteMovieModal);
            if (modal) modal.hide();
            
            // Reload movies
            await loadMovies();
        } else {
            showErrorMessage(result.message || 'Failed to delete movie');
        }
    } catch (error) {
        console.error('Error deleting movie:', error);
        showErrorMessage(error.message || 'Failed to delete movie');
    } finally {
        setButtonLoading(elements.confirmDeleteBtn, false);
    }
}

// Delete movie (fallback for direct delete without modal)
async function deleteMovie(movieId) {
    try {
        const movie = allMovies.find(m => m.id === movieId);
        if (!movie) {
            showErrorMessage('Movie not found');
            return;
        }
        
        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to delete "${movie.title}"? This action cannot be undone.`);
        if (!confirmed) return;
        
        console.log('Deleting movie:', movieId);
        
        // Delete movie
        const result = await AdminAuth.deleteMovie(movieId);
        console.log('Delete movie result:', result);
        
        if (result.success) {
            showSuccessMessage('Movie deleted successfully!');
            
            // Reload movies
            await loadMovies();
        } else {
            showErrorMessage(result.message || 'Failed to delete movie');
        }
    } catch (error) {
        console.error('Error deleting movie:', error);
        showErrorMessage(error.message || 'Failed to delete movie');
    }
}

// Get form data
function getFormData(formId) {
    const prefix = formId === 'add-movie-form' ? 'movie' : 'edit-movie';
    
    const formData = {
        title: document.getElementById(`${prefix}-title`).value.trim(),
        genre: document.getElementById(`${prefix}-genre`).value,
        duration: parseInt(document.getElementById(`${prefix}-duration`).value) || 0,
        rating: parseFloat(document.getElementById(`${prefix}-rating`).value) || null,
        releaseDate: document.getElementById(`${prefix}-release-date`).value || null,
        posterUrl: document.getElementById(`${prefix}-poster-url`).value.trim() || null,
        description: document.getElementById(`${prefix}-description`).value.trim() || null
    };
    
    // Convert snake_case for API if needed
    if (formData.releaseDate) {
        formData.release_date = formData.releaseDate;
    }
    if (formData.posterUrl) {
        formData.poster_url = formData.posterUrl;
    }
    
    return formData;
}

// Validate movie form
function validateMovieForm(data, formId) {
    clearFormErrors(formId);
    let isValid = true;
    
    const prefix = formId === 'add-movie-form' ? 'movie' : 'edit-movie';
    
    if (!data.title) {
        showFieldError(`${prefix}-title`, 'Title is required');
        isValid = false;
    }
    
    if (!data.genre) {
        showFieldError(`${prefix}-genre`, 'Genre is required');
        isValid = false;
    }
    
    if (!data.duration || data.duration < 1) {
        showFieldError(`${prefix}-duration`, 'Valid duration is required');
        isValid = false;
    }
    
    if (data.rating && (data.rating < 1 || data.rating > 10)) {
        showFieldError(`${prefix}-rating`, 'Rating must be between 1 and 10');
        isValid = false;
    }
    
    if (data.posterUrl && !isValidUrl(data.posterUrl)) {
        showFieldError(`${prefix}-poster-url`, 'Please enter a valid URL');
        isValid = false;
    }
    
    return isValid;
}

// Validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('is-invalid');
        
        // Add error message
        let feedback = field.parentNode.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            field.parentNode.appendChild(feedback);
        }
        feedback.textContent = message;
    }
}

// Clear form errors
function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (form) {
        const invalidFields = form.querySelectorAll('.is-invalid');
        invalidFields.forEach(field => {
            field.classList.remove('is-invalid');
        });
        
        const feedbacks = form.querySelectorAll('.invalid-feedback');
        feedbacks.forEach(feedback => {
            feedback.remove();
        });
    }
}

// Set button loading state
function setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
        button.disabled = true;
        const originalText = button.innerHTML;
        button.dataset.originalText = originalText;
        
        if (button.id === 'confirm-delete-movie') {
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
        } else {
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
        }
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
}

// Show success message
function showSuccessMessage(message) {
    console.log('Success:', message);
    // You can replace this with a proper toast/notification system
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-bg-success border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-check-circle me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Show error message
function showErrorMessage(message) {
    console.error('Error:', message);
    // You can replace this with a proper toast/notification system
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-bg-danger border-0 position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-exclamation-circle me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Debounce function
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

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        AdminAuth.logout();
        window.location.href = '/admin/login';
    }
}

// Global functions for inline event handlers
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;
window.confirmDeleteMovie = confirmDeleteMovie;
window.changePage = changePage;
window.loadMovies = loadMovies;
window.clearAllFilters = clearAllFilters;
window.logout = logout;

// ✅ TAMBAHKAN: Missing functions yang dipanggil tapi belum didefinisikan
function hideAllContainers() {
    if (elements.loadingContainer) elements.loadingContainer.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.errorState) elements.errorState.style.display = 'none';
    if (elements.moviesGrid) elements.moviesGrid.style.display = 'none';
    if (elements.moviesList) elements.moviesList.style.display = 'none';
    if (elements.paginationContainer) elements.paginationContainer.style.display = 'none';
}

// ✅ TAMBAHKAN: Create movie row untuk list view
function createMovieRow(movie) {
    const row = document.createElement('tr');
    
    // ✅ FIX: Use reliable fallback instead of via.placeholder.com
    const posterUrl = movie.posterUrl || movie.poster_url || FALLBACK_IMAGES.small;
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const releaseDate = movie.releaseDate || movie.release_date || null;
    const releaseDateDisplay = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'TBD';
    
    row.innerHTML = `
        <td>
            <img src="${posterUrl}" alt="${movie.title}" style="width: 50px; height: 75px; object-fit: cover; border-radius: 4px;"
                 onerror="this.src='${FALLBACK_IMAGES.small}'">
        </td>
        <td>
            <div class="fw-semibold">${movie.title}</div>
            <small class="text-muted">${movie.description ? 
                (movie.description.length > 50 ? movie.description.substring(0, 50) + '...' : movie.description) 
                : 'No description'}</small>
        </td>
        <td><span class="badge bg-primary">${movie.genre}</span></td>
        <td>${movie.duration || 'N/A'} min</td>
        <td>
            <div class="d-flex align-items-center">
                <span class="rating-stars text-warning me-2">★</span>
                <span>${rating}/10</span>
            </div>
        </td>
        <td>${releaseDateDisplay}</td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-primary" onclick="editMovie(${movie.id})" title="Edit Movie">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-outline-danger" onclick="confirmDeleteMovie(${movie.id})" title="Delete Movie">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// ✅ TAMBAHKAN: Get form data helper
function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    
    const prefix = formId === 'add-movie-form' ? 'movie' : 'edit-movie';
    
    return {
        title: document.getElementById(`${prefix}-title`)?.value?.trim() || '',
        genre: document.getElementById(`${prefix}-genre`)?.value || '',
        duration: parseInt(document.getElementById(`${prefix}-duration`)?.value) || 0,
        rating: parseFloat(document.getElementById(`${prefix}-rating`)?.value) || null,
        releaseDate: document.getElementById(`${prefix}-release-date`)?.value || null,
        posterUrl: document.getElementById(`${prefix}-poster-url`)?.value?.trim() || '',
        description: document.getElementById(`${prefix}-description`)?.value?.trim() || ''
    };
}

// ✅ TAMBAHKAN: Validation helper
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// ✅ TAMBAHKAN: Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('is-invalid');
        const feedback = field.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.textContent = message;
        }
    }
}

// ✅ TAMBAHKAN: Clear form errors
function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.querySelectorAll('.is-invalid').forEach(field => {
            field.classList.remove('is-invalid');
        });
        form.querySelectorAll('.invalid-feedback').forEach(feedback => {
            feedback.textContent = '';
        });
    }
}

// ✅ TAMBAHKAN: Set button loading state
function setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
        }
    }
}

// ✅ TAMBAHKAN: Show success message
function showSuccessMessage(message) {
    if (typeof AdminAuth !== 'undefined' && AdminAuth.showMessage) {
        AdminAuth.showMessage(message, 'success');
    } else {
        alert(message); // Fallback
    }
}

// ✅ TAMBAHKAN: Show error message
function showErrorMessage(message) {
    if (typeof AdminAuth !== 'undefined' && AdminAuth.showMessage) {
        AdminAuth.showMessage(message, 'error');
    } else {
        alert('Error: ' + message); // Fallback
    }
}

// ✅ TAMBAHKAN: Debounce function
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

// ✅ TAMBAHKAN: Clear all filters function
function clearAllFilters() {
    // Reset filters
    currentFilters = {
        genre: '',
        rating: '',
        search: '',
        sort: 'title'
    };
    
    // Reset UI
    if (elements.genreFilter) elements.genreFilter.value = '';
    if (elements.ratingFilter) elements.ratingFilter.value = '';
    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.sortSelect) elements.sortSelect.value = 'title';
    
    // Reset pagination
    currentPage = 1;
    
    // Apply filters
    applyFilters();
    
    showSuccessMessage('Filters cleared');
}

// ✅ PERBAIKI: Update global functions export
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;
window.confirmDeleteMovie = confirmDeleteMovie;
window.changePage = changePage;
window.loadMovies = loadMovies;
window.clearAllFilters = clearAllFilters;
window.logout = logout;

// ✅ TAMBAHKAN: Missing window functions
window.showMovieDetail = showMovieDetail || function(movieId) {
    console.log('Show movie detail:', movieId);
    alert('Movie detail functionality not implemented yet');
};

window.handleMovieBooking = handleMovieBooking || function(movieId) {
    console.log('Handle movie booking:', movieId);
    alert('Movie booking functionality not implemented yet');
};

console.log('✅ Admin Movies JS loaded successfully with all missing functions');