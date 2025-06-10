/**
 * Admin Movies Management JavaScript
 * Handles CRUD operations for movies in admin panel
 */

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
        // Containers
        loadingContainer: document.getElementById('loading-container'),
        moviesGrid: document.getElementById('movies-grid'),
        moviesList: document.getElementById('movies-list'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        paginationContainer: document.getElementById('pagination-container'),
        
        // Stats
        totalMoviesCount: document.getElementById('total-movies-count'),
        activeMoviesCount: document.getElementById('active-movies-count'),
        genresCount: document.getElementById('genres-count'),
        avgRating: document.getElementById('avg-rating'),
        
        // Filters
        genreFilter: document.getElementById('genre-filter'),
        ratingFilter: document.getElementById('rating-filter'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search'),
        gridViewBtn: document.getElementById('grid-view'),
        listViewBtn: document.getElementById('list-view'),
        
        // Modals
        addMovieModal: document.getElementById('addMovieModal'),
        editMovieModal: document.getElementById('editMovieModal'),
        deleteMovieModal: document.getElementById('deleteMovieModal'),
        
        // Forms
        addMovieForm: document.getElementById('add-movie-form'),
        editMovieForm: document.getElementById('edit-movie-form'),
        
        // Buttons
        saveMovieBtn: document.getElementById('save-movie'),
        updateMovieBtn: document.getElementById('update-movie'),
        confirmDeleteBtn: document.getElementById('confirm-delete-movie'),
        
        // Delete modal elements
        deleteMovieTitle: document.getElementById('delete-movie-title'),
        
        // Pagination
        paginationControls: document.getElementById('pagination-controls'),
        showingStart: document.getElementById('showing-start'),
        showingEnd: document.getElementById('showing-end'),
        totalMovies: document.getElementById('total-movies'),
        
        // Error message
        errorMessage: document.getElementById('error-message')
    };
    
    console.log('DOM elements cached:', elements);
}

// Setup event listeners
function setupEventListeners() {
    // View toggles
    if (elements.gridViewBtn) {
        elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    }
    if (elements.listViewBtn) {
        elements.listViewBtn.addEventListener('click', () => switchView('list'));
    }
    
    // Filters
    if (elements.genreFilter) {
        elements.genreFilter.addEventListener('change', handleFilterChange);
    }
    if (elements.ratingFilter) {
        elements.ratingFilter.addEventListener('change', handleRatingFilterChange);
    }
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    }
    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    // Form submissions
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
    
    // Form resets when modals are hidden
    if (elements.addMovieModal) {
        elements.addMovieModal.addEventListener('hidden.bs.modal', () => {
            if (elements.addMovieForm) {
                elements.addMovieForm.reset();
                clearFormErrors('add-movie-form');
            }
        });
    }
    
    if (elements.editMovieModal) {
        elements.editMovieModal.addEventListener('hidden.bs.modal', () => {
            if (elements.editMovieForm) {
                elements.editMovieForm.reset();
                clearFormErrors('edit-movie-form');
            }
        });
    }
    
    // Sidebar toggle for mobile
    const toggleSidebar = document.getElementById('toggleSidebar');
    const closeSidebar = document.getElementById('closeSidebar');
    const sidebar = document.getElementById('sidebar');
    
    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', () => {
            sidebar?.classList.toggle('show');
        });
    }
    
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar?.classList.remove('show');
        });
    }
    
    console.log('Event listeners setup completed');
}

// Load movies from API
async function loadMovies() {
    try {
        showLoadingState();
        console.log('Loading movies for admin...');
        
        const movies = await AdminAuth.getMovies();
        console.log('Movies received from API:', movies);
        
        if (movies && movies.length > 0) {
            allMovies = movies;
            updateStats(movies);
            applyFilters();
            populateGenreFilter();
            console.log(`Loaded ${movies.length} movies successfully`);
        } else {
            allMovies = [];
            filteredMovies = [];
            updateStats([]);
            showEmptyState();
            console.log('No movies found');
        }
    } catch (error) {
        console.error('Error loading movies:', error);
        showErrorState('Failed to load movies. Please try again.');
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
    
    const posterUrl = movie.posterUrl || movie.poster_url || 'https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster';
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
                     onerror="this.src='https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster'">
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
    
    const posterUrl = movie.posterUrl || movie.poster_url || 'https://via.placeholder.com/60x90/e2e8f0/64748b?text=No+Poster';
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const releaseDate = movie.releaseDate || movie.release_date;
    const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';
    const description = movie.description ? 
        (movie.description.length > 50 ? movie.description.substring(0, 50) + '...' : movie.description) : 
        'No description';
    
    row.innerHTML = `
        <td>
            <img src="${posterUrl}" alt="${movie.title}" class="movie-thumbnail" 
                 style="width: 50px; height: 75px; object-fit: cover; border-radius: 4px;"
                 onerror="this.src='https://via.placeholder.com/60x90/e2e8f0/64748b?text=No+Poster'">
        </td>
        <td>
            <div class="fw-semibold">${movie.title}</div>
            <small class="text-muted">${description}</small>
        </td>
        <td><span class="badge bg-primary">${movie.genre}</span></td>
        <td>${movie.duration} min</td>
        <td>⭐ ${rating}</td>
        <td>${formattedDate}</td>
        <td>
            <div class="btn-group" role="group">
                <button class="btn btn-sm btn-outline-primary" onclick="editMovie(${movie.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteMovie(${movie.id})" title="Delete">
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

console.log('Admin Movies JS loaded successfully');