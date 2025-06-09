/**
 * Admin Users Management
 * Handles user viewing and management for admin panel
 */

// Global variables
let allUsers = [];
let filteredUsers = [];

// DOM Elements
let elements = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // Cache DOM elements
    cacheElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load users
    loadUsers();
}

function cacheElements() {
    elements = {
        // Containers
        loadingContainer: document.getElementById('loading-container'),
        usersTableContainer: document.getElementById('users-table-container'),
        usersTableBody: document.getElementById('users-table-body'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        errorMessage: document.getElementById('error-message'),
        
        // Filters
        roleFilter: document.getElementById('role-filter'),
        searchInput: document.getElementById('search-input'),
        clearSearch: document.getElementById('clear-search'),
        
        // Stats
        totalUsersCount: document.getElementById('total-users-count'),
        adminUsersCount: document.getElementById('admin-users-count'),
        regularUsersCount: document.getElementById('regular-users-count'),
        newUsersToday: document.getElementById('new-users-today')
    };
}

function setupEventListeners() {
    // Search and filters
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    if (elements.clearSearch) {
        elements.clearSearch.addEventListener('click', clearSearch);
    }
    
    if (elements.roleFilter) {
        elements.roleFilter.addEventListener('change', applyFilters);
    }
}

// Load users from API
async function loadUsers() {
    try {
        showLoadingState();
        
        console.log('Loading users for admin...');
        const users = await AdminAuth.getUsers();
        
        if (users && users.length > 0) {
            allUsers = users;
            updateStats(users);
            applyFilters();
        } else {
            allUsers = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
        showErrorState('Failed to load users. Please try again.');
    }
}

// Update statistics
function updateStats(users) {
    const totalUsers = users.length;
    const adminUsers = users.filter(user => user.role === 'ADMIN').length;
    const regularUsers = users.filter(user => user.role === 'USER').length;
    
    // For demo purposes, assume some users are new today
    const newToday = Math.floor(totalUsers * 0.1); // 10% as new today
    
    if (elements.totalUsersCount) {
        animateNumber(elements.totalUsersCount, totalUsers);
    }
    
    if (elements.adminUsersCount) {
        animateNumber(elements.adminUsersCount, adminUsers);
    }
    
    if (elements.regularUsersCount) {
        animateNumber(elements.regularUsersCount, regularUsers);
    }
    
    if (elements.newUsersToday) {
        animateNumber(elements.newUsersToday, newToday);
    }
}

// Apply filters and render
function applyFilters() {
    const searchTerm = elements.searchInput?.value.toLowerCase() || '';
    const selectedRole = elements.roleFilter?.value || '';
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = !searchTerm || 
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm);
            
        const matchesRole = !selectedRole || user.role === selectedRole;
        
        return matchesSearch && matchesRole;
    });
    
    renderUsers(filteredUsers);
}

// Render users table
function renderUsers(users) {
    if (!users || users.length === 0) {
        showEmptyState();
        return;
    }
    
    hideAllStates();
    elements.usersTableContainer.style.display = 'block';
    
    elements.usersTableBody.innerHTML = '';
    
    users.forEach(user => {
        const row = createUserRow(user);
        elements.usersTableBody.appendChild(row);
    });
}

// Create user table row
function createUserRow(user) {
    const row = document.createElement('tr');
    
    // Format join date (demo data)
    const joinDate = new Date().toLocaleDateString(); // Demo: use current date
    
    // Role badge styling
    const roleBadgeClass = user.role === 'ADMIN' ? 'bg-danger' : 'bg-primary';
    
    row.innerHTML = `
        <td>${user.id}</td>
        <td>
            <div class="d-flex align-items-center">
                <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                    <i class="fas fa-user"></i>
                </div>
                <span class="fw-medium">${user.username}</span>
            </div>
        </td>
        <td>${user.email}</td>
        <td>
            <span class="badge ${roleBadgeClass}">
                <i class="fas fa-${user.role === 'ADMIN' ? 'crown' : 'user'} me-1"></i>
                ${user.role}
            </span>
        </td>
        <td>${joinDate}</td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-info" onclick="viewUser(${user.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn btn-outline-warning" onclick="editUser(${user.id})" title="Edit User">
                    <i class="fas fa-edit"></i>
                </button>
                ${user.role !== 'ADMIN' ? `
                <button type="button" class="btn btn-outline-danger" onclick="deleteUser(${user.id})" title="Delete User">
                    <i class="fas fa-trash"></i>
                </button>
                ` : ''}
            </div>
        </td>
    `;
    
    return row;
}

// Handle search
function handleSearch() {
    applyFilters();
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
    applyFilters();
}

// View user details
function viewUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        alert(`User Details:\n\nID: ${user.id}\nUsername: ${user.username}\nEmail: ${user.email}\nRole: ${user.role}`);
    }
}

// Edit user
function editUser(userId) {
    AdminAuth.showMessage('User editing functionality not implemented yet', 'info');
}

// Delete user
function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (user && confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
        AdminAuth.showMessage('User deletion functionality not implemented yet', 'warning');
    }
}

// Refresh users
function refreshUsers() {
    AdminAuth.showMessage('Refreshing users...', 'info');
    loadUsers();
}

// Animate number counting
function animateNumber(element, targetNumber, duration = 1000) {
    const startNumber = 0;
    const increment = targetNumber / (duration / 16);
    let currentNumber = startNumber;
    
    const timer = setInterval(() => {
        currentNumber += increment;
        if (currentNumber >= targetNumber) {
            currentNumber = targetNumber;
            clearInterval(timer);
        }
        element.textContent = Math.floor(currentNumber);
    }, 16);
}

// State management functions
function showLoadingState() {
    hideAllStates();
    elements.loadingContainer.style.display = 'block';
}

function showEmptyState() {
    hideAllStates();
    elements.emptyState.style.display = 'block';
}

function showErrorState(message) {
    hideAllStates();
    elements.errorMessage.textContent = message;
    elements.errorState.style.display = 'block';
}

function hideAllStates() {
    elements.loadingContainer.style.display = 'none';
    elements.usersTableContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
}

// Utility function
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

// Global functions for inline handlers
window.viewUser = viewUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.refreshUsers = refreshUsers;
window.loadUsers = loadUsers;

console.log('Admin users management loaded');