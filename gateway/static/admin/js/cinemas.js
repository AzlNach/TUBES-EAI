/**
 * Admin Cinemas Management JavaScript
 * Handles CRUD operations for cinemas in admin panel
 * Consistent with gateway/schema.py GraphQL types
 */

// Global state
let allCinemas = [];
let filteredCinemas = [];
let currentEditingId = null;
let deleteTargetId = null;

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
    loadCinemas();
});

// Cache DOM elements
function cacheElements() {
    elements = {
        // Containers
        cinemasGrid: document.getElementById('cinemas-grid'),
        
        // Search and filters
        searchInput: document.getElementById('search-cinemas'),
        cityFilter: document.getElementById('city-filter'),
        
        // Modals
        cinemaModal: document.getElementById('cinema-modal'),
        deleteModal: document.getElementById('delete-modal'),
        
        // Form elements
        cinemaForm: document.getElementById('cinema-form'),
        modalTitle: document.getElementById('modal-title'),
        cinemaName: document.getElementById('cinema-name'),
        cinemaCity: document.getElementById('cinema-city'),
        cinemaCapacity: document.getElementById('cinema-capacity'),
        saveBtn: document.getElementById('save-btn')
    };
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    elements.cinemaForm.addEventListener('submit', handleFormSubmit);
    
    // Modal close events
    window.addEventListener('click', function(event) {
        if (event.target === elements.cinemaModal) {
            closeCinemaModal();
        }
        if (event.target === elements.deleteModal) {
            closeDeleteModal();
        }
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeCinemaModal();
            closeDeleteModal();
        }
    });
}

// Load cinemas from API
async function loadCinemas() {
    try {
        showLoadingState();
        console.log('Loading cinemas for admin...');
        
        const cinemas = await AdminAuth.getCinemas();
        
        if (cinemas && cinemas.length > 0) {
            allCinemas = cinemas;
            filterCinemas();
            populateCityFilter();
            console.log(`Loaded ${cinemas.length} cinemas successfully`);
        } else {
            allCinemas = [];
            showEmptyState();
            console.log('No cinemas found');
        }
    } catch (error) {
        console.error('Error loading cinemas:', error);
        showErrorState('Failed to load cinemas. Please try again.');
    }
}

// Show loading state
function showLoadingState() {
    elements.cinemasGrid.innerHTML = `
        <div class="loading-container">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading cinemas...</span>
            </div>
            <p class="mt-3">Loading cinemas...</p>
        </div>
    `;
}

// Show empty state
function showEmptyState() {
    elements.cinemasGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-building fa-4x text-muted mb-3"></i>
            <h3>No Cinemas Found</h3>
            <p class="text-muted">Start by adding your first cinema to the system.</p>
            <button class="btn btn-primary" onclick="showCreateCinemaModal()">
                <i class="fas fa-plus"></i> Add First Cinema
            </button>
        </div>
    `;
}

// Show error state
function showErrorState(message) {
    elements.cinemasGrid.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle fa-4x text-danger mb-3"></i>
            <h3>Error Loading Cinemas</h3>
            <p class="text-muted">${message}</p>
            <button class="btn btn-primary" onclick="loadCinemas()">
                <i class="fas fa-retry"></i> Retry
            </button>
        </div>
    `;
}

// Filter cinemas based on search and city
function filterCinemas() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const selectedCity = elements.cityFilter.value;
    
    filteredCinemas = allCinemas.filter(cinema => {
        const matchesSearch = !searchTerm || 
            cinema.name.toLowerCase().includes(searchTerm) ||
            cinema.city.toLowerCase().includes(searchTerm);
        
        const matchesCity = !selectedCity || cinema.city === selectedCity;
        
        return matchesSearch && matchesCity;
    });
    
    renderCinemas();
}

// Render cinemas grid
function renderCinemas() {
    if (filteredCinemas.length === 0) {
        elements.cinemasGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search fa-4x text-muted mb-3"></i>
                <h3>No Cinemas Match Your Filter</h3>
                <p class="text-muted">Try adjusting your search criteria.</p>
            </div>
        `;
        return;
    }
    
    elements.cinemasGrid.innerHTML = '';
    
    filteredCinemas.forEach(cinema => {
        const cinemaCard = createCinemaCard(cinema);
        elements.cinemasGrid.appendChild(cinemaCard);
    });
}

// Create cinema card
function createCinemaCard(cinema) {
    const card = document.createElement('div');
    card.className = 'cinema-card';
    card.setAttribute('data-cinema-id', cinema.id);
    
    const auditoriumCount = cinema.auditoriums ? cinema.auditoriums.length : 0;
    
    card.innerHTML = `
        <div class="cinema-card-header">
            <div class="cinema-info">
                <h3 class="cinema-name">${cinema.name}</h3>
                <p class="cinema-location">
                    <i class="fas fa-map-marker-alt"></i> ${cinema.city}
                </p>
            </div>
            <div class="cinema-actions">
                <button class="btn-action btn-edit" onclick="editCinema(${cinema.id})" title="Edit Cinema">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteCinema(${cinema.id})" title="Delete Cinema">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="cinema-card-body">
            <div class="cinema-stats">
                <div class="stat-item">
                    <span class="stat-value">${cinema.capacity || 0}</span>
                    <span class="stat-label">Total Capacity</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${auditoriumCount}</span>
                    <span class="stat-label">Auditoriums</span>
                </div>
            </div>
            ${auditoriumCount > 0 ? `
                <div class="auditoriums-list">
                    <h4>Auditoriums:</h4>
                    <div class="auditoriums-grid">
                        ${cinema.auditoriums.map(auditorium => `
                            <div class="auditorium-item">
                                <span class="auditorium-name">${auditorium.name}</span>
                                <span class="auditorium-layout">${auditorium.seat_layout || 'Standard'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Populate city filter
function populateCityFilter() {
    const cities = [...new Set(allCinemas.map(cinema => cinema.city))].sort();
    
    elements.cityFilter.innerHTML = '<option value="">All Cities</option>';
    
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        elements.cityFilter.appendChild(option);
    });
}

// Show create cinema modal
function showCreateCinemaModal() {
    currentEditingId = null;
    elements.modalTitle.textContent = 'Add New Cinema';
    elements.saveBtn.textContent = 'Save Cinema';
    elements.cinemaForm.reset();
    elements.cinemaModal.style.display = 'block';
    elements.cinemaName.focus();
}

// Show edit cinema modal
function editCinema(cinemaId) {
    const cinema = allCinemas.find(c => c.id === cinemaId);
    if (!cinema) {
        alert('Cinema not found!');
        return;
    }
    
    currentEditingId = cinemaId;
    elements.modalTitle.textContent = 'Edit Cinema';
    elements.saveBtn.textContent = 'Update Cinema';
    
    // Populate form with cinema data
    elements.cinemaName.value = cinema.name;
    elements.cinemaCity.value = cinema.city;
    elements.cinemaCapacity.value = cinema.capacity;
    
    elements.cinemaModal.style.display = 'block';
    elements.cinemaName.focus();
}

// Close cinema modal
function closeCinemaModal() {
    elements.cinemaModal.style.display = 'none';
    elements.cinemaForm.reset();
    currentEditingId = null;
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = {
        name: elements.cinemaName.value.trim(),
        city: elements.cinemaCity.value.trim(),
        capacity: parseInt(elements.cinemaCapacity.value)
    };
    
    // Validate form data
    if (!validateFormData(formData)) {
        return;
    }
    
    // Set loading state
    elements.saveBtn.disabled = true;
    elements.saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        let result;
        
        if (currentEditingId) {
            // Update existing cinema
            result = await AdminAuth.updateCinema(currentEditingId, formData);
        } else {
            // Create new cinema
            result = await AdminAuth.createCinema(formData);
        }
        
        if (result.success) {
            showSuccessMessage(currentEditingId ? 'Cinema updated successfully!' : 'Cinema created successfully!');
            closeCinemaModal();
            await loadCinemas(); // Reload cinemas
        } else {
            showErrorMessage(result.message || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving cinema:', error);
        showErrorMessage('An error occurred while saving the cinema');
    } finally {
        // Reset button state
        elements.saveBtn.disabled = false;
        elements.saveBtn.textContent = currentEditingId ? 'Update Cinema' : 'Save Cinema';
    }
}

// Validate form data
function validateFormData(data) {
    if (!data.name) {
        showErrorMessage('Cinema name is required');
        elements.cinemaName.focus();
        return false;
    }
    
    if (!data.city) {
        showErrorMessage('City is required');
        elements.cinemaCity.focus();
        return false;
    }
    
    if (!data.capacity || data.capacity < 1) {
        showErrorMessage('Capacity must be at least 1');
        elements.cinemaCapacity.focus();
        return false;
    }
    
    return true;
}

// Delete cinema
function deleteCinema(cinemaId) {
    const cinema = allCinemas.find(c => c.id === cinemaId);
    if (!cinema) {
        alert('Cinema not found!');
        return;
    }
    
    deleteTargetId = cinemaId;
    
    // Show confirmation in delete modal
    const modalBody = elements.deleteModal.querySelector('.modal-body p');
    modalBody.textContent = `Are you sure you want to delete "${cinema.name}"? This action cannot be undone.`;
    
    elements.deleteModal.style.display = 'block';
}

// Confirm delete
async function confirmDelete() {
    if (!deleteTargetId) return;
    
    const deleteBtn = elements.deleteModal.querySelector('.btn-danger');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        const result = await AdminAuth.deleteCinema(deleteTargetId);
        
        if (result.success) {
            showSuccessMessage('Cinema deleted successfully!');
            closeDeleteModal();
            await loadCinemas(); // Reload cinemas
        } else {
            showErrorMessage(result.message || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting cinema:', error);
        showErrorMessage('An error occurred while deleting the cinema');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

// Close delete modal
function closeDeleteModal() {
    elements.deleteModal.style.display = 'none';
    deleteTargetId = null;
}

// Show success message
function showSuccessMessage(message) {
    // Create a temporary success alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    alert.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Show error message
function showErrorMessage(message) {
    // Create a temporary error alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    alert.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        AdminAuth.logout();
        window.location.href = '/admin/login';
    }
}

// Global functions for inline event handlers
window.showCreateCinemaModal = showCreateCinemaModal;
window.editCinema = editCinema;
window.deleteCinema = deleteCinema;
window.closeCinemaModal = closeCinemaModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.filterCinemas = filterCinemas;
window.logout = logout;

console.log('Admin Cinemas JS loaded successfully');