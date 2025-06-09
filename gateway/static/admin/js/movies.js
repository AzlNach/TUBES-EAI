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
    search: ''
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
        
        // Filters
        genreFilter: document.getElementById('genre-filter'),
        searchInput: document.getElementById('search-input'),
        clearSearchBtn: document.getElementById('clear-search'),
        gridViewBtn: document.getElementById('grid-view'),
        listViewBtn: document.getElementById('list-view'),
        
        // Modals
        addMovieModal: document.getElementById('addMovieModal'),
        editMovieModal: document.getElementById('editMovieModal'),
        
        // Forms
        addMovieForm: document.getElementById('add-movie-form'),
        editMovieForm: document.getElementById('edit-movie-form'),
        
        // Buttons
        saveMovieBtn: document.getElementById('save-movie'),
        updateMovieBtn: document.getElementById('update-movie'),
        
        // Pagination
        paginationControls: document.getElementById('pagination-controls'),
        showingStart: document.getElementById('showing-start'),
        showingEnd: document.getElementById('showing-end'),
        totalMovies: document.getElementById('total-movies')
    };
}

// Setup event listeners
function setupEventListeners() {
    // View toggles
    elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    elements.listViewBtn.addEventListener('click', () => switchView('list'));
    
    // Filters
    elements.genreFilter.addEventListener('change', handleFilterChange);
    elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    
    // Save movie
    elements.saveMovieBtn.addEventListener('click', handleSaveMovie);
    elements.updateMovieBtn.addEventListener('click', handleUpdateMovie);
    
    // Form resets when modals are hidden
    elements.addMovieModal.addEventListener('hidden.bs.modal', () => {
        elements.addMovieForm.reset();
        clearFormErrors('add-movie-form');
    });
    
    elements.editMovieModal.addEventListener('hidden.bs.modal', () => {
        elements.editMovieForm.reset();
        clearFormErrors('edit-movie-form');
    });
}

// Load movies from API
async function loadMovies() {
    try {
        showLoadingState();
        console.log('Loading movies for admin...');
        
        const movies = await AdminAuth.getMovies();
        
        if (movies && movies.length > 0) {
            allMovies = movies;
            applyFilters();
            populateGenreFilter();
            console.log(`Loaded ${movies.length} movies successfully`);
        } else {
            allMovies = [];
            showEmptyState();
            console.log('No movies found');
        }
    } catch (error) {
        console.error('Error loading movies:', error);
        showErrorState('Failed to load movies. Please try again.');
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

// Show empty state
function showEmptyState() {
    elements.loadingContainer.style.display = 'none';
    elements.moviesGrid.style.display = 'none';
    elements.moviesList.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.errorState.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
}

// Show error state
function showErrorState(message) {
    elements.loadingContainer.style.display = 'none';
    elements.moviesGrid.style.display = 'none';
    elements.moviesList.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'block';
    elements.paginationContainer.style.display = 'none';
    
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
    }
}

// Apply filters and render movies
function applyFilters() {
    filteredMovies = allMovies.filter(movie => {
        const matchesGenre = !currentFilters.genre || movie.genre === currentFilters.genre;
        const matchesSearch = !currentFilters.search || 
            movie.title.toLowerCase().includes(currentFilters.search.toLowerCase()) ||
            movie.genre.toLowerCase().includes(currentFilters.search.toLowerCase());
        
        return matchesGenre && matchesSearch;
    });
    
    currentPage = 1;
    renderMovies();
}

// Handle filter changes
function handleFilterChange() {
    currentFilters.genre = elements.genreFilter.value;
    applyFilters();
}

// Handle search input
function handleSearchInput() {
    currentFilters.search = elements.searchInput.value;
    applyFilters();
}

// Clear search
function clearSearch() {
    elements.searchInput.value = '';
    currentFilters.search = '';
    applyFilters();
}

// Switch view
function switchView(view) {
    currentView = view;
    
    // Update button states
    elements.gridViewBtn.classList.toggle('active', view === 'grid');
    elements.listViewBtn.classList.toggle('active', view === 'list');
    
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
    elements.loadingContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    
    if (currentView === 'grid') {
        elements.moviesGrid.style.display = 'block';
        elements.moviesList.style.display = 'none';
        renderGridView(pageMovies);
    } else {
        elements.moviesGrid.style.display = 'none';
        elements.moviesList.style.display = 'block';
        renderListView(pageMovies);
    }
    
    // Update pagination
    updatePagination(startIndex + 1, endIndex, filteredMovies.length, totalPages);
    elements.paginationContainer.style.display = 'flex';
}

// Render grid view
function renderGridView(movies) {
    elements.moviesGrid.innerHTML = '';
    
    movies.forEach(movie => {
        const movieCard = createMovieCard(movie);
        elements.moviesGrid.appendChild(movieCard);
    });
}

// Render list view
function renderListView(movies) {
    elements.moviesList.innerHTML = '';
    
    const table = document.createElement('div');
    table.className = 'table-responsive';
    table.innerHTML = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>Poster</th>
                    <th>Title</th>
                    <th>Genre</th>
                    <th>Duration</th>
                    <th>Rating</th>
                    <th>Release Date</th>
                    <th>Actions</th>
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
    col.className = 'col-xl-3 col-lg-4 col-md-6 mb-4';
    
    const posterUrl = movie.posterUrl || 'https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster';
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const releaseDate = movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'N/A';
    
    col.innerHTML = `
        <div class="movie-card">
            <div class="movie-poster-container">
                <img src="${posterUrl}" alt="${movie.title}" class="movie-poster" 
                     onerror="this.src='https://via.placeholder.com/300x450/e2e8f0/64748b?text=No+Poster'">
                <div class="movie-overlay">
                    <div class="movie-actions">
                        <button class="btn btn-sm btn-primary" onclick="editMovie(${movie.id})" title="Edit Movie">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMovie(${movie.id})" title="Delete Movie">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <h6 class="movie-title">${movie.title}</h6>
                <div class="movie-meta mb-2">
                    <span class="genre-badge">${movie.genre}</span>
                    <small class="text-muted">${movie.duration} min</small>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${releaseDate}</small>
                    <div class="rating-stars">
                        ⭐ ${rating}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// Create movie row
function createMovieRow(movie) {
    const row = document.createElement('tr');
    
    const posterUrl = movie.posterUrl || 'https://via.placeholder.com/60x90/e2e8f0/64748b?text=No+Poster';
    const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
    const releaseDate = movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'N/A';
    
    row.innerHTML = `
        <td>
            <img src="${posterUrl}" alt="${movie.title}" class="movie-thumbnail" 
                 style="width: 40px; height: 60px; object-fit: cover; border-radius: 4px;"
                 onerror="this.src='https://via.placeholder.com/60x90/e2e8f0/64748b?text=No+Poster'">
        </td>
        <td>
            <div class="fw-semibold">${movie.title}</div>
            <small class="text-muted">${movie.description ? movie.description.substring(0, 50) + '...' : 'No description'}</small>
        </td>
        <td><span class="badge bg-primary">${movie.genre}</span></td>
        <td>${movie.duration} min</td>
        <td>⭐ ${rating}</td>
        <td>${releaseDate}</td>
        <td>
            <div class="btn-group" role="group">
                <button class="btn btn-sm btn-outline-primary" onclick="editMovie(${movie.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteMovie(${movie.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Populate genre filter
function populateGenreFilter() {
    const genres = [...new Set(allMovies.map(movie => movie.genre))].sort();
    
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
}

// Update pagination
function updatePagination(start, end, total, totalPages) {
    elements.showingStart.textContent = start;
    elements.showingEnd.textContent = end;
    elements.totalMovies.textContent = total;
    
    // Generate pagination controls
    elements.paginationControls.innerHTML = '';
    
    // Previous button
    const prevBtn = document.createElement('li');
    prevBtn.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = `<a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>`;
    elements.paginationControls.appendChild(prevBtn);
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('li');
        pageBtn.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageBtn.innerHTML = `<a class="page-link" href="#" onclick="changePage(${i})">${i}</a>`;
        elements.paginationControls.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('li');
    nextBtn.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextBtn.innerHTML = `<a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>`;
    elements.paginationControls.appendChild(nextBtn);
}

// Change page
function changePage(page) {
    if (page < 1 || page > Math.ceil(filteredMovies.length / moviesPerPage)) return;
    
    currentPage = page;
    renderMovies();
    
    // Scroll to top
    document.querySelector('.content-wrapper').scrollTop = 0;
}

// Handle save movie
async function handleSaveMovie() {
    try {
        // Get form data
        const formData = getFormData('add-movie-form');
        
        // Validate form
        if (!validateMovieForm(formData, 'add-movie-form')) {
            return;
        }
        
        // Set loading state
        setButtonLoading(elements.saveMovieBtn, true);
        
        // Create movie
        const result = await AdminAuth.createMovie(formData);
        
        if (result.success) {
            AdminAuth.showMessage('Movie created successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.addMovieModal);
            modal.hide();
            
            // Reload movies
            await loadMovies();
        } else {
            AdminAuth.showMessage(result.message || 'Failed to create movie', 'error');
        }
    } catch (error) {
        console.error('Error creating movie:', error);
        AdminAuth.showMessage(error.message || 'Failed to create movie', 'error');
    } finally {
        setButtonLoading(elements.saveMovieBtn, false);
    }
}

// Edit movie
async function editMovie(movieId) {
    try {
        const movie = allMovies.find(m => m.id === movieId);
        if (!movie) {
            AdminAuth.showMessage('Movie not found', 'error');
            return;
        }
        
        // Populate edit form
        document.getElementById('edit-movie-id').value = movie.id;
        document.getElementById('edit-movie-title').value = movie.title || '';
        document.getElementById('edit-movie-genre').value = movie.genre || '';
        document.getElementById('edit-movie-duration').value = movie.duration || '';
        document.getElementById('edit-movie-rating').value = movie.rating || '';
        document.getElementById('edit-movie-release-date').value = movie.releaseDate || '';
        document.getElementById('edit-movie-poster-url').value = movie.posterUrl || '';
        document.getElementById('edit-movie-description').value = movie.description || '';
        
        // Show modal
        const modal = new bootstrap.Modal(elements.editMovieModal);
        modal.show();
    } catch (error) {
        console.error('Error editing movie:', error);
        AdminAuth.showMessage('Failed to load movie data', 'error');
    }
}

// Handle update movie
async function handleUpdateMovie() {
    try {
        // Get form data
        const movieId = parseInt(document.getElementById('edit-movie-id').value);
        const formData = getFormData('edit-movie-form');
        
        // Validate form
        if (!validateMovieForm(formData, 'edit-movie-form')) {
            return;
        }
        
        // Set loading state
        setButtonLoading(elements.updateMovieBtn, true);
        
        // Update movie
        const result = await AdminAuth.updateMovie(movieId, formData);
        
        if (result.success) {
            AdminAuth.showMessage('Movie updated successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.editMovieModal);
            modal.hide();
            
            // Reload movies
            await loadMovies();
        } else {
            AdminAuth.showMessage(result.message || 'Failed to update movie', 'error');
        }
    } catch (error) {
        console.error('Error updating movie:', error);
        AdminAuth.showMessage(error.message || 'Failed to update movie', 'error');
    } finally {
        setButtonLoading(elements.updateMovieBtn, false);
    }
}

// Delete movie
async function deleteMovie(movieId) {
    try {
        const movie = allMovies.find(m => m.id === movieId);
        if (!movie) {
            AdminAuth.showMessage('Movie not found', 'error');
            return;
        }
        
        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to delete "${movie.title}"? This action cannot be undone.`);
        if (!confirmed) return;
        
        // Delete movie
        const result = await AdminAuth.deleteMovie(movieId);
        
        if (result.success) {
            AdminAuth.showMessage('Movie deleted successfully!', 'success');
            
            // Reload movies
            await loadMovies();
        } else {
            AdminAuth.showMessage(result.message || 'Failed to delete movie', 'error');
        }
    } catch (error) {
        console.error('Error deleting movie:', error);
        AdminAuth.showMessage(error.message || 'Failed to delete movie', 'error');
    }
}

// Get form data
function getFormData(formId) {
    const prefix = formId === 'add-movie-form' ? 'movie' : 'edit-movie';
    
    return {
        title: document.getElementById(`${prefix}-title`).value.trim(),
        genre: document.getElementById(`${prefix}-genre`).value,
        duration: parseInt(document.getElementById(`${prefix}-duration`).value),
        rating: parseFloat(document.getElementById(`${prefix}-rating`).value) || null,
        releaseDate: document.getElementById(`${prefix}-release-date`).value || null,
        posterUrl: document.getElementById(`${prefix}-poster-url`).value.trim() || null,
        description: document.getElementById(`${prefix}-description`).value.trim() || null
    };
}

// Validate movie form
function validateMovieForm(data, formId) {
    clearFormErrors(formId);
    let isValid = true;
    
    if (!data.title) {
        showFieldError(`${formId === 'add-movie-form' ? 'movie' : 'edit-movie'}-title`, 'Title is required');
        isValid = false;
    }
    
    if (!data.genre) {
        showFieldError(`${formId === 'add-movie-form' ? 'movie' : 'edit-movie'}-genre`, 'Genre is required');
        isValid = false;
    }
    
    if (!data.duration || data.duration < 1) {
        showFieldError(`${formId === 'add-movie-form' ? 'movie' : 'edit-movie'}-duration`, 'Valid duration is required');
        isValid = false;
    }
    
    return isValid;
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
    if (loading) {
        button.disabled = true;
        const originalText = button.innerHTML;
        button.dataset.originalText = originalText;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
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

// Global functions for inline event handlers
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;
window.changePage = changePage;
window.loadMovies = loadMovies;

console.log('Admin Movies JS loaded successfully');