/**
 * Enhanced Admin Cinema Management JavaScript
 * Handles CRUD operations for cinemas, auditoriums, and showtimes
 */

// Global state
let allCinemas = [];
let allAuditoriums = [];
let allShowtimes = [];
let allMovies = [];
let filteredCinemas = [];
let filteredAuditoriums = [];
let filteredShowtimes = [];
let currentEditingId = null;
let currentEditingType = null; // 'cinema', 'auditorium', 'showtime'
let deleteTargetId = null;
let deleteTargetType = null;

// DOM Elements
let elements = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== ADMIN CINEMAS PAGE INITIALIZATION ===');
    
    // Check admin authentication
    if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
        console.error('❌ Admin authentication failed');
        window.location.href = '/admin/login';
        return;
    }

    console.log('✅ Admin authentication passed');
    
    try {
        cacheElements();
        setupEventListeners();
        
        // Add small delay to ensure all scripts are loaded
        setTimeout(() => {
            loadAllData();
        }, 100);
        
        console.log('✅ Admin cinemas page initialized successfully');
    } catch (error) {
        console.error('❌ Error during initialization:', error);
        showErrorMessage('Failed to initialize page. Please refresh.');
    }
});

// Cache DOM elements
function cacheElements() {
    elements = {
        // Tab elements
        cinemasTab: document.getElementById('cinemas-tab'),
        auditoriumsTab: document.getElementById('auditoriums-tab'),
        showtimesTab: document.getElementById('showtimes-tab'),
        
        // Grid containers
        cinemasGrid: document.getElementById('cinemas-grid'),
        auditoriumsGrid: document.getElementById('auditoriums-grid'),
        showtimesGrid: document.getElementById('showtimes-grid'),
        
        // Search and filters
        searchCinemas: document.getElementById('search-cinemas'),
        cityFilter: document.getElementById('city-filter'),
        searchAuditoriums: document.getElementById('search-auditoriums'),
        auditoriumCinemaFilter: document.getElementById('auditorium-cinema-filter'),
        searchShowtimes: document.getElementById('search-showtimes'),
        showtimeCinemaFilter: document.getElementById('showtime-cinema-filter'),
        showtimeMovieFilter: document.getElementById('showtime-movie-filter'),
        showtimeDateFilter: document.getElementById('showtime-date-filter'),
        
        // Cinema modal
        cinemaModal: document.getElementById('cinema-modal'),
        cinemaModalTitle: document.getElementById('cinema-modal-title'),
        cinemaForm: document.getElementById('cinema-form'),
        cinemaName: document.getElementById('cinema-name'),
        cinemaCity: document.getElementById('cinema-city'),
        cinemaCapacity: document.getElementById('cinema-capacity'),
        cinemaSaveBtn: document.getElementById('cinema-save-btn'),
        
        // Auditorium modal
        auditoriumModal: document.getElementById('auditorium-modal'),
        auditoriumModalTitle: document.getElementById('auditorium-modal-title'),
        auditoriumForm: document.getElementById('auditorium-form'),
        auditoriumCinema: document.getElementById('auditorium-cinema'),
        auditoriumName: document.getElementById('auditorium-name'),
        auditoriumSeatLayout: document.getElementById('auditorium-seat-layout'),
        auditoriumSaveBtn: document.getElementById('auditorium-save-btn'),
        
        // Showtime modal
        showtimeModal: document.getElementById('showtime-modal'),
        showtimeModalTitle: document.getElementById('showtime-modal-title'),
        showtimeForm: document.getElementById('showtime-form'),
        showtimeMovie: document.getElementById('showtime-movie'),
        showtimeCinema: document.getElementById('showtime-cinema'),
        showtimeAuditorium: document.getElementById('showtime-auditorium'),
        showtimeDate: document.getElementById('showtime-date'),
        showtimeTime: document.getElementById('showtime-time'),
        showtimePrice: document.getElementById('showtime-price'),
        showtimeSaveBtn: document.getElementById('showtime-save-btn'),
        
        // Delete modal
        deleteModal: document.getElementById('delete-modal'),
        deleteMessage: document.getElementById('delete-message')
    };
}

// Setup event listeners
function setupEventListeners() {
    // Tab listeners
    elements.auditoriumsTab.addEventListener('click', () => loadAuditoriums());
    elements.showtimesTab.addEventListener('click', () => loadShowtimes());
    
    // Form submissions
    elements.cinemaForm.addEventListener('submit', handleCinemaFormSubmit);
    elements.auditoriumForm.addEventListener('submit', handleAuditoriumFormSubmit);
    elements.showtimeForm.addEventListener('submit', handleShowtimeFormSubmit);
    
    // Modal close events
    window.addEventListener('click', function(event) {
        if (event.target === elements.cinemaModal) closeCinemaModal();
        if (event.target === elements.auditoriumModal) closeAuditoriumModal();
        if (event.target === elements.showtimeModal) closeShowtimeModal();
        if (event.target === elements.deleteModal) closeDeleteModal();
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeCinemaModal();
            closeAuditoriumModal();
            closeShowtimeModal();
            closeDeleteModal();
        }
    });
    
    // Showtime cinema change listener
    elements.showtimeCinema.addEventListener('change', loadAuditoriumsForCinema);
}

// Load all initial data
async function loadAllData() {
    try {
        console.log('=== LOAD ALL DATA START ===');
        
        // Check if all required methods exist
        if (!checkAdminAuthMethods()) {
            throw new Error('Required AdminAuth methods are missing');
        }
        
        await Promise.all([
            loadCinemas(),
            loadMovies()
        ]);
        
        populateFilters();
        console.log('✅ All initial data loaded successfully');
    } catch (error) {
        console.error('❌ Error loading initial data:', error);
        showErrorMessage('Failed to load initial data. Please refresh the page.');
    }
}

// Load cinemas
async function loadCinemas() {
    try {
        console.log('=== LOADING CINEMAS DEBUG START ===');
        showLoadingState('cinemas');
        
        const cinemas = await AdminAuth.getCinemas();
        console.log('Raw cinemas response:', cinemas);
        
        if (cinemas && cinemas.length > 0) {
            allCinemas = cinemas;
            filteredCinemas = [...allCinemas];
            renderCinemas();
            console.log(`✅ Loaded ${cinemas.length} cinemas successfully`);
        } else {
            console.log('⚠️ No cinemas found');
            allCinemas = [];
            filteredCinemas = [];
            showEmptyState('cinemas');
        }
        
        console.log('=== LOADING CINEMAS DEBUG END ===');
    } catch (error) {
        console.error('❌ Error loading cinemas:', error);
        console.error('❌ Error message:', error.message);
        
        // Better error handling
        if (error.message.includes('seat_layout')) {
            console.error('❌ Field name mismatch detected - this is a schema issue');
        }
        
        showErrorState('cinemas', 'Failed to load cinemas');
    }
}

// Load auditoriums
async function loadAuditoriums() {
    try {
        console.log('=== LOADING AUDITORIUMS DEBUG START ===');
        showLoadingState('auditoriums');
        
        if (typeof AdminAuth.getAuditoriums !== 'function') {
            throw new Error('AdminAuth.getAuditoriums method is not available');
        }
        
        const auditoriums = await AdminAuth.getAuditoriums();
        console.log('Raw auditoriums response:', auditoriums);
        
        if (auditoriums && auditoriums.length > 0) {
            allAuditoriums = auditoriums;
            filteredAuditoriums = [...allAuditoriums];
            renderAuditoriums();
            console.log(`✅ Loaded ${auditoriums.length} auditoriums successfully`);
        } else {
            console.log('⚠️ No auditoriums found');
            allAuditoriums = [];
            filteredAuditoriums = [];
            showEmptyState('auditoriums');
        }
        
        console.log('=== LOADING AUDITORIUMS DEBUG END ===');
    } catch (error) {
        console.error('❌ Error loading auditoriums:', error);
        console.error('❌ Error message:', error.message);
        showErrorState('auditoriums', 'Failed to load auditoriums');
    }
}

// Load showtimes
async function loadShowtimes() {
    try {
        console.log('=== LOADING SHOWTIMES DEBUG START ===');
        showLoadingState('showtimes');
        
        if (typeof AdminAuth.getShowtimes !== 'function') {
            throw new Error('AdminAuth.getShowtimes method is not available');
        }
        
        const showtimes = await AdminAuth.getShowtimes();
        console.log('Raw showtimes response:', showtimes);
        
        if (showtimes && showtimes.length > 0) {
            allShowtimes = showtimes;
            filteredShowtimes = [...allShowtimes];
            renderShowtimes();
            console.log(`✅ Loaded ${showtimes.length} showtimes successfully`);
        } else {
            console.log('⚠️ No showtimes found');
            allShowtimes = [];
            filteredShowtimes = [];
            showEmptyState('showtimes');
        }
        
        console.log('=== LOADING SHOWTIMES DEBUG END ===');
    } catch (error) {
        console.error('❌ Error loading showtimes:', error);
        console.error('❌ Error message:', error.message);
        showErrorState('showtimes', 'Failed to load showtimes');
    }
}

// Load movies for showtime creation
async function loadMovies() {
    try {
        const movies = await AdminAuth.getMovies();
        allMovies = movies || [];
        populateMovieOptions();
    } catch (error) {
        console.error('Error loading movies:', error);
        allMovies = [];
    }
}

// Render functions
function renderCinemas() {
    if (filteredCinemas.length === 0) {
        showEmptyState('cinemas');
        return;
    }
    
    elements.cinemasGrid.innerHTML = '';
    
    filteredCinemas.forEach(cinema => {
        const cinemaCard = createCinemaCard(cinema);
        elements.cinemasGrid.appendChild(cinemaCard);
    });
}

function renderAuditoriums() {
    if (filteredAuditoriums.length === 0) {
        showEmptyState('auditoriums');
        return;
    }
    
    elements.auditoriumsGrid.innerHTML = '';
    
    filteredAuditoriums.forEach(auditorium => {
        const auditoriumCard = createAuditoriumCard(auditorium);
        elements.auditoriumsGrid.appendChild(auditoriumCard);
    });
}

function renderShowtimes() {
    if (filteredShowtimes.length === 0) {
        showEmptyState('showtimes');
        return;
    }
    
    elements.showtimesGrid.innerHTML = '';
    
    filteredShowtimes.forEach(showtime => {
        const showtimeCard = createShowtimeCard(showtime);
        elements.showtimesGrid.appendChild(showtimeCard);
    });
}

// Create card functions
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
        </div>
    `;
    
    return card;
}

function createAuditoriumCard(auditorium) {
    const card = document.createElement('div');
    card.className = 'auditorium-card';
    card.setAttribute('data-auditorium-id', auditorium.id);
    
    const cinemaName = auditorium.cinema ? auditorium.cinema.name : 'Unknown Cinema';
    const cinemaCity = auditorium.cinema ? auditorium.cinema.city : '';
    
    card.innerHTML = `
        <div class="auditorium-card-header">
            <div class="auditorium-info">
                <h3 class="auditorium-name">${auditorium.name}</h3>
                <p class="auditorium-cinema">
                    <i class="fas fa-building"></i> ${cinemaName}
                    ${cinemaCity ? `<span class="city-label">(${cinemaCity})</span>` : ''}
                </p>
            </div>
            <div class="auditorium-actions">
                <button class="btn-action btn-edit" onclick="editAuditorium(${auditorium.id})" title="Edit Auditorium">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteAuditorium(${auditorium.id})" title="Delete Auditorium">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="auditorium-card-body">
            <div class="auditorium-layout">
                <span class="layout-badge">${auditorium.seat_layout || 'Standard'}</span>
            </div>
        </div>
    `;
    
    return card;
}

function createShowtimeCard(showtime) {
    const card = document.createElement('div');
    card.className = 'showtime-card';
    card.setAttribute('data-showtime-id', showtime.id);
    
    const movieTitle = showtime.movie ? showtime.movie.title : 'Unknown Movie';
    const auditoriumName = showtime.auditorium ? showtime.auditorium.name : 'Unknown Auditorium';
    const cinemaName = showtime.auditorium && showtime.auditorium.cinema ? showtime.auditorium.cinema.name : 'Unknown Cinema';
    
    const startDate = new Date(showtime.start_time);
    const dateStr = startDate.toLocaleDateString();
    const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    card.innerHTML = `
        <div class="showtime-card-header">
            <div class="showtime-info">
                <h3 class="movie-title">${movieTitle}</h3>
                <p class="showtime-venue">
                    <i class="fas fa-building"></i> ${cinemaName} - ${auditoriumName}
                </p>
            </div>
            <div class="showtime-actions">
                <button class="btn-action btn-edit" onclick="editShowtime(${showtime.id})" title="Edit Showtime">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteShowtime(${showtime.id})" title="Delete Showtime">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="showtime-card-body">
            <div class="showtime-details">
                <div class="detail-item">
                    <i class="fas fa-calendar"></i>
                    <span>${dateStr}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-clock"></i>
                    <span>${timeStr}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-money-bill"></i>
                    <span>Rp ${parseFloat(showtime.price).toLocaleString()}</span>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Modal functions
function showCreateCinemaModal() {
    currentEditingId = null;
    currentEditingType = 'cinema';
    elements.cinemaModalTitle.textContent = 'Add New Cinema';
    elements.cinemaSaveBtn.textContent = 'Save Cinema';
    elements.cinemaForm.reset();
    elements.cinemaModal.style.display = 'block';
    elements.cinemaName.focus();
}

function showCreateAuditoriumModal() {
    currentEditingId = null;
    currentEditingType = 'auditorium';
    elements.auditoriumModalTitle.textContent = 'Add New Auditorium';
    elements.auditoriumSaveBtn.textContent = 'Save Auditorium';
    elements.auditoriumForm.reset();
    populateCinemaOptions();
    elements.auditoriumModal.style.display = 'block';
    elements.auditoriumCinema.focus();
}

function showCreateShowtimeModal() {
    currentEditingId = null;
    currentEditingType = 'showtime';
    elements.showtimeModalTitle.textContent = 'Add New Showtime';
    elements.showtimeSaveBtn.textContent = 'Save Showtime';
    elements.showtimeForm.reset();
    populateMovieOptions();
    populateCinemaOptionsForShowtime();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    elements.showtimeDate.value = today;
    
    elements.showtimeModal.style.display = 'block';
    elements.showtimeMovie.focus();
}

// Close modal functions
function closeCinemaModal() {
    elements.cinemaModal.style.display = 'none';
    elements.cinemaForm.reset();
    currentEditingId = null;
    currentEditingType = null;
}

function closeAuditoriumModal() {
    elements.auditoriumModal.style.display = 'none';
    elements.auditoriumForm.reset();
    currentEditingId = null;
    currentEditingType = null;
}

function closeShowtimeModal() {
    elements.showtimeModal.style.display = 'none';
    elements.showtimeForm.reset();
    currentEditingId = null;
    currentEditingType = null;
}

function closeDeleteModal() {
    elements.deleteModal.style.display = 'none';
    deleteTargetId = null;
    deleteTargetType = null;
}

// Form submission handlers
async function handleCinemaFormSubmit(event) {
    event.preventDefault();
    
    const formData = {
        name: elements.cinemaName.value.trim(),
        city: elements.cinemaCity.value.trim(),
        capacity: parseInt(elements.cinemaCapacity.value)
    };
    
    if (!validateCinemaData(formData)) return;
    
    elements.cinemaSaveBtn.disabled = true;
    elements.cinemaSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        let result;
        
        if (currentEditingId) {
            result = await AdminAuth.updateCinema(currentEditingId, formData);
        } else {
            result = await AdminAuth.createCinema(formData);
        }
        
        if (result.success) {
            showSuccessMessage(currentEditingId ? 'Cinema updated successfully!' : 'Cinema created successfully!');
            closeCinemaModal();
            await loadCinemas();
            populateFilters();
        } else {
            showErrorMessage(result.message || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving cinema:', error);
        showErrorMessage('An error occurred while saving the cinema');
    } finally {
        elements.cinemaSaveBtn.disabled = false;
        elements.cinemaSaveBtn.textContent = currentEditingId ? 'Update Cinema' : 'Save Cinema';
    }
}

// ✅ TAMBAH: Test server connectivity
async function testServerConnection() {
    try {
        console.log('=== TESTING SERVER CONNECTION ===');
        
        // Test basic server connectivity
        const healthResponse = await fetch('/health', { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Health check status:', healthResponse.status);
        console.log('Health check ok:', healthResponse.ok);
        
        // Test GraphQL introspection
        const introspectionQuery = `
            query IntrospectionQuery {
                __schema {
                    types {
                        name
                    }
                }
            }
        `;
        
        const introspectionResponse = await fetch('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('cinema_auth_token')}`
            },
            body: JSON.stringify({
                query: introspectionQuery,
                variables: {}
            })
        });
        
        console.log('Introspection status:', introspectionResponse.status);
        console.log('Introspection ok:', introspectionResponse.ok);
        
        const introspectionText = await introspectionResponse.text();
        console.log('Introspection response:', introspectionText.substring(0, 500));
        
        if (!introspectionResponse.ok) {
            throw new Error(`GraphQL endpoint not accessible: ${introspectionResponse.status}`);
        }
        
        console.log('✅ Server connection test passed');
        return true;
    } catch (error) {
        console.error('❌ Server connection test failed:', error);
        return false;
    }
}

// ✅ FIX: Simplified auditorium form handler
async function handleAuditoriumFormSubmit(event) {
    event.preventDefault();
    
    const formData = {
        cinema_id: parseInt(elements.auditoriumCinema.value),
        name: elements.auditoriumName.value.trim(),
        seat_layout: elements.auditoriumSeatLayout.value
    };
    
    // ✅ FIX: Simple validation
    if (!formData.cinema_id || isNaN(formData.cinema_id)) {
        showErrorMessage('Please select a cinema');
        return;
    }
    if (!formData.name) {
        showErrorMessage('Auditorium name is required');
        return;
    }
    if (!formData.seat_layout) {
        showErrorMessage('Please select a seat layout');
        return;
    }
    
    elements.auditoriumSaveBtn.disabled = true;
    elements.auditoriumSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        let result;
        
        if (currentEditingId) {
            result = await AdminAuth.updateAuditorium(currentEditingId, formData);
        } else {
            result = await AdminAuth.createAuditorium(formData);
        }
        
        if (result && result.success) {
            showSuccessMessage(currentEditingId ? 'Auditorium updated successfully!' : 'Auditorium created successfully!');
            closeAuditoriumModal();
            await loadAuditoriums();
            await loadCinemas();
        } else {
            showErrorMessage(result?.message || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving auditorium:', error);
        
        // ✅ FIX: User-friendly error messages
        let errorMessage = 'Failed to save auditorium';
        if (error.message.includes('Network error')) {
            errorMessage = 'Cannot connect to server. Please check if the server is running.';
        } else if (error.message.includes('GraphQL error')) {
            errorMessage = 'Server error: ' + error.message.replace('GraphQL error: ', '');
        } else if (error.message.includes('Invalid')) {
            errorMessage = error.message;
        }
        
        showErrorMessage(errorMessage);
    } finally {
        elements.auditoriumSaveBtn.disabled = false;
        elements.auditoriumSaveBtn.textContent = currentEditingId ? 'Update Auditorium' : 'Save Auditorium';
    }
}

async function handleShowtimeFormSubmit(event) {
    event.preventDefault();
    
    const dateTime = `${elements.showtimeDate.value}T${elements.showtimeTime.value}:00`;
    
    const formData = {
        movie_id: parseInt(elements.showtimeMovie.value),
        auditorium_id: parseInt(elements.showtimeAuditorium.value),
        start_time: dateTime,
        price: parseFloat(elements.showtimePrice.value)
    };
    
    if (!validateShowtimeData(formData)) return;
    
    elements.showtimeSaveBtn.disabled = true;
    elements.showtimeSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        let result;
        
        if (currentEditingId) {
            result = await AdminAuth.updateShowtime(currentEditingId, formData);
        } else {
            result = await AdminAuth.createShowtime(formData);
        }
        
        if (result.success) {
            showSuccessMessage(currentEditingId ? 'Showtime updated successfully!' : 'Showtime created successfully!');
            closeShowtimeModal();
            await loadShowtimes();
        } else {
            showErrorMessage(result.message || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving showtime:', error);
        showErrorMessage('An error occurred while saving the showtime');
    } finally {
        elements.showtimeSaveBtn.disabled = false;
        elements.showtimeSaveBtn.textContent = currentEditingId ? 'Update Showtime' : 'Save Showtime';
    }
}

// Validation functions
function validateCinemaData(data) {
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

function validateAuditoriumData(data) {
    if (!data.cinema_id) {
        showErrorMessage('Please select a cinema');
        elements.auditoriumCinema.focus();
        return false;
    }
    
    if (!data.name) {
        showErrorMessage('Auditorium name is required');
        elements.auditoriumName.focus();
        return false;
    }
    
    if (!data.seat_layout) {
        showErrorMessage('Please select a seat layout');
        elements.auditoriumSeatLayout.focus();
        return false;
    }
    
    return true;
}

function validateShowtimeData(data) {
    if (!data.movie_id) {
        showErrorMessage('Please select a movie');
        elements.showtimeMovie.focus();
        return false;
    }
    
    if (!data.auditorium_id) {
        showErrorMessage('Please select an auditorium');
        elements.showtimeAuditorium.focus();
        return false;
    }
    
    if (!data.start_time) {
        showErrorMessage('Date and time are required');
        elements.showtimeDate.focus();
        return false;
    }
    
    if (!data.price || data.price < 0) {
        showErrorMessage('Valid ticket price is required');
        elements.showtimePrice.focus();
        return false;
    }
    
    // Check if the showtime is in the future
    const now = new Date();
    const showtimeDate = new Date(data.start_time);
    
    if (showtimeDate <= now) {
        showErrorMessage('Showtime must be in the future');
        elements.showtimeDate.focus();
        return false;
    }
    
    return true;
}

// Populate options functions
function populateCinemaOptions() {
    elements.auditoriumCinema.innerHTML = '<option value="">Select Cinema</option>';
    
    allCinemas.forEach(cinema => {
        const option = document.createElement('option');
        option.value = cinema.id;
        option.textContent = `${cinema.name} (${cinema.city})`;
        elements.auditoriumCinema.appendChild(option);
    });
}

function populateCinemaOptionsForShowtime() {
    elements.showtimeCinema.innerHTML = '<option value="">Select Cinema</option>';
    
    allCinemas.forEach(cinema => {
        const option = document.createElement('option');
        option.value = cinema.id;
        option.textContent = `${cinema.name} (${cinema.city})`;
        elements.showtimeCinema.appendChild(option);
    });
}

function populateMovieOptions() {
    elements.showtimeMovie.innerHTML = '<option value="">Select Movie</option>';
    
    allMovies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = `${movie.title} (${movie.genre})`;
        elements.showtimeMovie.appendChild(option);
    });
}

async function loadAuditoriumsForCinema() {
    const cinemaId = elements.showtimeCinema.value;
    elements.showtimeAuditorium.innerHTML = '<option value="">Select Auditorium</option>';
    
    if (!cinemaId) return;
    
    try {
        const auditoriums = await AdminAuth.getAuditoriums(parseInt(cinemaId));
        
        auditoriums.forEach(auditorium => {
            const option = document.createElement('option');
            option.value = auditorium.id;
            option.textContent = `${auditorium.name} (${auditorium.seat_layout})`;
            elements.showtimeAuditorium.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading auditoriums for cinema:', error);
        showErrorMessage('Failed to load auditoriums for selected cinema');
    }
}

// Edit functions
function editCinema(cinemaId) {
    const cinema = allCinemas.find(c => c.id === cinemaId);
    if (!cinema) {
        showErrorMessage('Cinema not found!');
        return;
    }
    
    currentEditingId = cinemaId;
    currentEditingType = 'cinema';
    elements.cinemaModalTitle.textContent = 'Edit Cinema';
    elements.cinemaSaveBtn.textContent = 'Update Cinema';
    
    elements.cinemaName.value = cinema.name;
    elements.cinemaCity.value = cinema.city;
    elements.cinemaCapacity.value = cinema.capacity;
    
    elements.cinemaModal.style.display = 'block';
    elements.cinemaName.focus();
}

function editAuditorium(auditoriumId) {
    const auditorium = allAuditoriums.find(a => a.id === auditoriumId);
    if (!auditorium) {
        showErrorMessage('Auditorium not found!');
        return;
    }
    
    currentEditingId = auditoriumId;
    currentEditingType = 'auditorium';
    elements.auditoriumModalTitle.textContent = 'Edit Auditorium';
    elements.auditoriumSaveBtn.textContent = 'Update Auditorium';
    
    populateCinemaOptions();
    elements.auditoriumCinema.value = auditorium.cinema_id;
    elements.auditoriumName.value = auditorium.name;
    elements.auditoriumSeatLayout.value = auditorium.seat_layout;
    
    elements.auditoriumModal.style.display = 'block';
    elements.auditoriumName.focus();
}

function editShowtime(showtimeId) {
    const showtime = allShowtimes.find(s => s.id === showtimeId);
    if (!showtime) {
        showErrorMessage('Showtime not found!');
        return;
    }
    
    currentEditingId = showtimeId;
    currentEditingType = 'showtime';
    elements.showtimeModalTitle.textContent = 'Edit Showtime';
    elements.showtimeSaveBtn.textContent = 'Update Showtime';
    
    populateMovieOptions();
    populateCinemaOptionsForShowtime();
    
    const startDate = new Date(showtime.start_time);
    const dateStr = startDate.toISOString().split('T')[0];
    const timeStr = startDate.toTimeString().slice(0, 5);
    
    elements.showtimeMovie.value = showtime.movie_id;
    elements.showtimeCinema.value = showtime.auditorium.cinema.id;
    
    // Load auditoriums for the selected cinema, then set the auditorium
    loadAuditoriumsForCinema().then(() => {
        elements.showtimeAuditorium.value = showtime.auditorium_id;
    });
    
    elements.showtimeDate.value = dateStr;
    elements.showtimeTime.value = timeStr;
    elements.showtimePrice.value = showtime.price;
    
    elements.showtimeModal.style.display = 'block';
    elements.showtimeMovie.focus();
}

// Delete functions
function deleteCinema(cinemaId) {
    const cinema = allCinemas.find(c => c.id === cinemaId);
    if (!cinema) {
        showErrorMessage('Cinema not found!');
        return;
    }
    
    deleteTargetId = cinemaId;
    deleteTargetType = 'cinema';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${cinema.name}"? This will also delete all associated auditoriums and showtimes. This action cannot be undone.`;
    elements.deleteModal.style.display = 'block';
}

function deleteAuditorium(auditoriumId) {
    const auditorium = allAuditoriums.find(a => a.id === auditoriumId);
    if (!auditorium) {
        showErrorMessage('Auditorium not found!');
        return;
    }
    
    deleteTargetId = auditoriumId;
    deleteTargetType = 'auditorium';
    elements.deleteMessage.textContent = `Are you sure you want to delete "${auditorium.name}"? This will also delete all associated showtimes. This action cannot be undone.`;
    elements.deleteModal.style.display = 'block';
}

function deleteShowtime(showtimeId) {
    const showtime = allShowtimes.find(s => s.id === showtimeId);
    if (!showtime) {
        showErrorMessage('Showtime not found!');
        return;
    }
    
    const movieTitle = showtime.movie ? showtime.movie.title : 'Unknown Movie';
    const startDate = new Date(showtime.start_time);
    const dateTimeStr = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    deleteTargetId = showtimeId;
    deleteTargetType = 'showtime';
    elements.deleteMessage.textContent = `Are you sure you want to delete the showtime for "${movieTitle}" on ${dateTimeStr}? This action cannot be undone.`;
    elements.deleteModal.style.display = 'block';
}

async function confirmDelete() {
    if (!deleteTargetId || !deleteTargetType) return;
    
    const deleteBtn = elements.deleteModal.querySelector('.btn-danger');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        let result;
        
        switch (deleteTargetType) {
            case 'cinema':
                result = await AdminAuth.deleteCinema(deleteTargetId);
                break;
            case 'auditorium':
                result = await AdminAuth.deleteAuditorium(deleteTargetId);
                break;
            case 'showtime':
                result = await AdminAuth.deleteShowtime(deleteTargetId);
                break;
            default:
                throw new Error('Invalid delete type');
        }
        
        if (result.success) {
            showSuccessMessage(`${deleteTargetType.charAt(0).toUpperCase() + deleteTargetType.slice(1)} deleted successfully!`);
            closeDeleteModal();
            
            // Reload appropriate data
            switch (deleteTargetType) {
                case 'cinema':
                    await loadCinemas();
                    await loadAuditoriums();
                    await loadShowtimes();
                    populateFilters();
                    break;
                case 'auditorium':
                    await loadAuditoriums();
                    await loadCinemas(); // Refresh to update auditorium counts
                    await loadShowtimes();
                    break;
                case 'showtime':
                    await loadShowtimes();
                    break;
            }
        } else {
            showErrorMessage(result.message || 'Delete failed');
        }
    } catch (error) {
        console.error(`Error deleting ${deleteTargetType}:`, error);
        showErrorMessage(`An error occurred while deleting the ${deleteTargetType}`);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
}

// Filter functions
function filterCinemas() {
    const searchTerm = elements.searchCinemas.value.toLowerCase();
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

function filterAuditoriums() {
    const searchTerm = elements.searchAuditoriums.value.toLowerCase();
    const selectedCinema = elements.auditoriumCinemaFilter.value;
    
    filteredAuditoriums = allAuditoriums.filter(auditorium => {
        const matchesSearch = !searchTerm || 
            auditorium.name.toLowerCase().includes(searchTerm) ||
            (auditorium.cinema && auditorium.cinema.name.toLowerCase().includes(searchTerm));
        
        const matchesCinema = !selectedCinema || auditorium.cinema_id === selectedCinema;
        
        return matchesSearch && matchesCinema;
    });
    
    renderAuditoriums();
}

function filterShowtimes() {
    const searchTerm = elements.searchShowtimes.value.toLowerCase();
    const selectedCinema = elements.showtimeCinemaFilter.value;
    const selectedMovie = elements.showtimeMovieFilter.value;
    const selectedDate = elements.showtimeDateFilter.value;
    
    filteredShowtimes = allShowtimes.filter(showtime => {
        const matchesSearch = !searchTerm || 
            showtime.movie.title.toLowerCase().includes(searchTerm) ||
            showtime.auditorium.name.toLowerCase().includes(searchTerm) ||
            (showtime.auditorium.cinema && showtime.auditorium.cinema.name.toLowerCase().includes(searchTerm));
        
        const matchesCinema = !selectedCinema || showtime.auditorium.cinema_id === selectedCinema;
        const matchesMovie = !selectedMovie || showtime.movie_id === selectedMovie;
        
        // Date matching
        let matchesDate = true;
        if (selectedDate) {
            const showtimeDate = new Date(showtime.start_time).toLocaleDateString();
            matchesDate = showtimeDate === new Date(selectedDate).toLocaleDateString();
        }
        
        return matchesSearch && matchesCinema && matchesMovie && matchesDate;
    });
    
    renderShowtimes();
}

// Populate filters
function populateFilters() {
    populateCityFilter();
    populateAuditoriumCinemaFilter();
    populateShowtimeCinemaFilter();
    populateShowtimeMovieFilter();
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

// Populate auditorium cinema filter
function populateAuditoriumCinemaFilter() {
    const cinemaSelect = elements.auditoriumCinemaFilter;
    cinemaSelect.innerHTML = '<option value="">All Cinemas</option>';
    
    allCinemas.forEach(cinema => {
        const option = document.createElement('option');
        option.value = cinema.id;
        option.textContent = `${cinema.name} (${cinema.city})`;
        cinemaSelect.appendChild(option);
    });
}

// Populate showtime cinema filter
function populateShowtimeCinemaFilter() {
    const cinemaSelect = elements.showtimeCinemaFilter;
    cinemaSelect.innerHTML = '<option value="">All Cinemas</option>';
    
    allCinemas.forEach(cinema => {
        const option = document.createElement('option');
        option.value = cinema.id;
        option.textContent = `${cinema.name} (${cinema.city})`;
        cinemaSelect.appendChild(option);
    });
}

// Populate showtime movie filter
function populateShowtimeMovieFilter() {
    const movieSelect = elements.showtimeMovieFilter;
    movieSelect.innerHTML = '<option value="">All Movies</option>';
    
    allMovies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = `${movie.title} (${movie.genre})`;
        movieSelect.appendChild(option);
    });
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        AdminAuth.logout();
        window.location.href = '/admin/login';
    }
}

// State management functions
function showLoadingState(type) {
    const container = document.getElementById(`${type}-grid`);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading ${type}...</span>
                </div>
                <p class="mt-3">Loading ${type}...</p>
            </div>
        `;
    }
}

function showEmptyState(type) {
    const container = document.getElementById(`${type}-grid`);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-${getIconForType(type)} fa-3x text-muted mb-3"></i>
                <h5>No ${type} found</h5>
                <p class="text-muted">No ${type} available at the moment.</p>
                <button class="btn btn-primary" onclick="showCreate${type.charAt(0).toUpperCase() + type.slice(0, -1)}Modal()">
                    <i class="fas fa-plus me-2"></i>Add ${type.charAt(0).toUpperCase() + type.slice(0, -1)}
                </button>
            </div>
        `;
    }
}

function showErrorState(type, message) {
    const container = document.getElementById(`${type}-grid`);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h5>Error loading ${type}</h5>
                <p class="text-muted">${message}</p>
                <button class="btn btn-primary" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}()">
                    <i class="fas fa-redo me-2"></i>Try Again
                </button>
            </div>
        `;
    }
}

function getIconForType(type) {
    switch (type) {
        case 'cinemas': return 'building';
        case 'auditoriums': return 'chair';
        case 'showtimes': return 'clock';
        default: return 'question';
    }
}

// Message functions
function showSuccessMessage(message) {
    // You can replace this with a proper toast/notification system
    alert(`✅ ${message}`);
}

function showErrorMessage(message) {
    // You can replace this with a proper toast/notification system
    alert(`❌ ${message}`);
}

// Add missing global functions
window.showCreateAuditoriumModal = showCreateAuditoriumModal;
window.showCreateShowtimeModal = showCreateShowtimeModal;
window.editAuditorium = editAuditorium;
window.editShowtime = editShowtime;
window.deleteAuditorium = deleteAuditorium;
window.deleteShowtime = deleteShowtime;
window.closeAuditoriumModal = closeAuditoriumModal;
window.closeShowtimeModal = closeShowtimeModal;
window.filterAuditoriums = filterAuditoriums;
window.filterShowtimes = filterShowtimes;
window.loadCinemas = loadCinemas;
window.loadAuditoriums = loadAuditoriums;
window.loadShowtimes = loadShowtimes;

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

// ✅ TAMBAH: Method availability checker
function checkAdminAuthMethods() {
    console.log('=== CHECKING ADMINAUTH METHODS ===');
    
    const requiredMethods = [
        'getCinemas',
        'createCinema', 
        'updateCinema',
        'deleteCinema',
        'getAuditoriums',
        'createAuditorium',
        'updateAuditorium', 
        'deleteAuditorium',
        'getShowtimes',
        'createShowtime',
        'updateShowtime',
        'deleteShowtime',
        'getMovies'
    ];
    
    const missingMethods = [];
    
    requiredMethods.forEach(method => {
        if (typeof AdminAuth[method] !== 'function') {
            missingMethods.push(method);
            console.error(`❌ Missing method: AdminAuth.${method}`);
        } else {
            console.log(`✅ Available method: AdminAuth.${method}`);
        }
    });
    
    if (missingMethods.length > 0) {
        console.error('❌ Missing AdminAuth methods:', missingMethods);
        showErrorMessage(`Missing required methods: ${missingMethods.join(', ')}`);
        return false;
    }
    
    console.log('✅ All AdminAuth methods are available');
    return true;
}