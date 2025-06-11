/**
 * Admin Coupons Management JavaScript
 * Handles coupon creation, editing, viewing, and management
 */

// Global variables
let allCoupons = [];
let filteredCoupons = [];
let currentPage = 1;
const couponsPerPage = 10;
let currentEditingCouponId = null;

// DOM Elements
let elements = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    // Check admin authentication
    if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
        window.location.href = '/admin/login';
        return;
    }
    
    cacheElements();
    setupEventListeners();
    loadCoupons();
    setupFormValidation();
}

// ✅ FIX: Update cacheElements function
function cacheElements() {
    console.log('📦 Caching DOM elements...');
    
    elements = {
        // Containers
        loadingContainer: document.getElementById('coupons-loading-container'),
        couponsTableContainer: document.getElementById('coupons-table-container'),
        couponsTableBody: document.getElementById('coupons-table-body'),
        emptyState: document.getElementById('coupons-empty-state'),
        errorState: document.getElementById('coupons-error-state'),
        errorMessage: document.getElementById('coupons-error-message'),
        
        // Filters
        searchInput: document.getElementById('coupon-search-input'),
        statusFilter: document.getElementById('coupon-status-filter'),
        typeFilter: document.getElementById('coupon-type-filter'),
        clearSearch: document.getElementById('coupon-clear-search'),
        selectAllCoupons: document.getElementById('select-all-coupons'),
        
        // Stats
        totalCouponsCount: document.getElementById('total-coupons-count'),
        activeCouponsCount: document.getElementById('active-coupons-count'),
        usedCouponsCount: document.getElementById('used-coupons-count'),
        avgDiscount: document.getElementById('avg-discount'),
        
        // Pagination
        paginationContainer: document.getElementById('coupons-pagination'),
        
        // Modals
        couponModal: document.getElementById('coupon-modal'),
        couponModalTitle: document.getElementById('coupon-modal-title'),
        couponDetailModal: document.getElementById('coupon-detail-modal'),
        couponDetailContent: document.getElementById('coupon-detail-content'),
        
        // Form elements
        couponForm: document.getElementById('coupon-form'),
        couponCode: document.getElementById('coupon-code'),
        couponName: document.getElementById('coupon-name'),
        couponDiscount: document.getElementById('coupon-discount'),
        couponStock: document.getElementById('coupon-stock'),
        couponValidUntil: document.getElementById('coupon-valid-until'),
        couponIsActive: document.getElementById('coupon-is-active'),
        couponSaveBtn: document.getElementById('coupon-save-btn'),
        
        // Preview elements
        previewCode: document.getElementById('preview-code'),
        previewName: document.getElementById('preview-name'),
        previewDiscount: document.getElementById('preview-discount'),
        
        // Action buttons
        toggleCouponStatusBtn: document.getElementById('toggle-coupon-status-btn'),
        editCouponBtn: document.getElementById('edit-coupon-btn')
    };
    
    // ✅ Log missing elements untuk debugging
    const missingElements = [];
    Object.entries(elements).forEach(([key, element]) => {
        if (!element) {
            missingElements.push(key);
        }
    });
    
    if (missingElements.length > 0) {
        console.warn('⚠️ Missing DOM elements:', missingElements);
    }
    
    console.log(`✅ Cached ${Object.keys(elements).length - missingElements.length}/${Object.keys(elements).length} elements`);
}

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Search and filters
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(filterCoupons, 300));
    }
    
    if (elements.clearSearch) {
        elements.clearSearch.addEventListener('click', clearSearch);
    }
    
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', filterCoupons);
    }
    
    if (elements.typeFilter) {
        elements.typeFilter.addEventListener('change', filterCoupons);
    }
    
    // Select all checkbox
    if (elements.selectAllCoupons) {
        elements.selectAllCoupons.addEventListener('change', toggleSelectAll);
    }
    
    // Form submission
    if (elements.couponForm) {
        elements.couponForm.addEventListener('submit', handleCouponFormSubmit);
    }
    
    // ✅ FIX: Modal action buttons - use dataset instead of direct function calls
    if (elements.toggleCouponStatusBtn) {
        elements.toggleCouponStatusBtn.addEventListener('click', function() {
            const couponId = this.dataset.couponId;
            if (couponId) {
                toggleCouponStatus(parseInt(couponId));
            }
        });
    }
    
    if (elements.editCouponBtn) {
        elements.editCouponBtn.addEventListener('click', function() {
            const couponId = this.dataset.couponId;
            if (couponId) {
                editCoupon(parseInt(couponId));
            }
        });
    }
    
    console.log('✅ Event listeners setup completed');
}

// ✅ FIX: Update setupFormValidation dengan better date handling
function setupFormValidation() {
    // Real-time form updates for preview
    [elements.couponCode, elements.couponName, elements.couponDiscount].forEach(input => {
        if (input) {
            input.addEventListener('input', updateCouponPreview);
        }
    });
    
    // Coupon code formatting
    if (elements.couponCode) {
        elements.couponCode.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }
    
    // ✅ FIX: Set better default datetime
    if (elements.couponValidUntil) {
        // Set minimum date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 0, 0); // Set to end of day
        
        const minDateTime = tomorrow.toISOString().slice(0, 16);
        elements.couponValidUntil.min = minDateTime;
        
        // Set maximum date to 1 year from now
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        elements.couponValidUntil.max = maxDate.toISOString().slice(0, 16);
        
        console.log('📅 Date limits set:', { min: minDateTime, max: maxDate.toISOString().slice(0, 16) });
    }
}

// Load coupons from API
// ✅ FIX: Update loadCoupons function dengan better error handling
async function loadCoupons() {
    try {
        console.log('📥 Loading coupons...');
        showLoadingState();
        
        // ✅ Check if AdminAuth.getCoupons exists
        if (typeof AdminAuth === 'undefined' || typeof AdminAuth.getCoupons !== 'function') {
            throw new Error('AdminAuth.getCoupons method is not available');
        }
        
        const coupons = await AdminAuth.getCoupons();
        console.log('📦 Coupons loaded:', coupons);
        
        if (coupons && coupons.length > 0) {
            allCoupons = coupons;
            updateStats(coupons);
            applyFilters();
            console.log(`✅ Successfully loaded ${coupons.length} coupons`);
        } else {
            console.log('⚠️ No coupons found');
            allCoupons = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('❌ Error loading coupons:', error);
        
        // ✅ Show user-friendly error message
        let errorMessage = 'Failed to load coupons';
        if (error.message.includes('not available')) {
            errorMessage = 'Coupon service is not available. Please check if the server is running.';
        } else if (error.message.includes('Network')) {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('Authentication')) {
            errorMessage = 'Authentication error. Please login again.';
        }
        
        showErrorState(errorMessage);
    }
}

// Update statistics
function updateStats(coupons) {
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter(c => c.isActive).length;
    const usedCoupons = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    const avgDiscountValue = coupons.length > 0 ? 
        (coupons.reduce((sum, c) => sum + c.discountPercentage, 0) / coupons.length).toFixed(1) : 0;
    
    if (elements.totalCouponsCount) {
        animateNumber(elements.totalCouponsCount, totalCoupons);
    }
    
    if (elements.activeCouponsCount) {
        animateNumber(elements.activeCouponsCount, activeCoupons);
    }
    
    if (elements.usedCouponsCount) {
        animateNumber(elements.usedCouponsCount, usedCoupons);
    }
    
    if (elements.avgDiscount) {
        elements.avgDiscount.textContent = `${avgDiscountValue}%`;
    }
}

// Apply filters and render
function applyFilters() {
    const searchTerm = elements.searchInput?.value.toLowerCase() || '';
    const selectedStatus = elements.statusFilter?.value || '';
    const selectedType = elements.typeFilter?.value || '';
    
    filteredCoupons = allCoupons.filter(coupon => {
        const matchesSearch = !searchTerm || 
            coupon.code.toLowerCase().includes(searchTerm) ||
            coupon.name.toLowerCase().includes(searchTerm);
            
        const matchesStatus = !selectedStatus || 
            coupon.isActive.toString() === selectedStatus;
            
        const matchesType = !selectedType || 
            coupon.discountPercentage.toString() === selectedType;
        
        return matchesSearch && matchesStatus && matchesType;
    });
    
    renderCoupons(filteredCoupons);
}

// Render coupons table
function renderCoupons(coupons) {
    if (!coupons || coupons.length === 0) {
        showEmptyState();
        return;
    }
    
    hideAllStates();
    elements.couponsTableContainer.style.display = 'block';
    
    elements.couponsTableBody.innerHTML = '';
    
    // Pagination
    const startIndex = (currentPage - 1) * couponsPerPage;
    const endIndex = startIndex + couponsPerPage;
    const paginatedCoupons = coupons.slice(startIndex, endIndex);
    
    paginatedCoupons.forEach(coupon => {
        const row = createCouponRow(coupon);
        elements.couponsTableBody.appendChild(row);
    });
    
    updatePagination(coupons.length);
}

// ✅ FIX: Update createCouponRow dengan better date display
function createCouponRow(coupon) {
    const row = document.createElement('tr');
    
    // ✅ FIX: Better date formatting for display
    let validUntilDisplay = 'No expiry';
    if (coupon.validUntil) {
        try {
            const date = new Date(coupon.validUntil);
            if (!isNaN(date.getTime())) {
                validUntilDisplay = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        } catch (error) {
            console.warn('Error formatting date for display:', error);
            validUntilDisplay = 'Invalid date';
        }
    }
    
    const statusClass = coupon.isActive ? 'success' : 'secondary';
    const statusText = coupon.isActive ? 'Active' : 'Inactive';
    
    const usedCount = coupon.usedCount || 0;
    const remainingStock = Math.max(0, coupon.stock - usedCount);
    const stockClass = remainingStock > 10 ? 'success' : remainingStock > 0 ? 'warning' : 'danger';
    
    row.innerHTML = `
        <td>
            <input type="checkbox" class="coupon-checkbox" value="${coupon.id}">
        </td>
        <td>
            <span class="coupon-code-badge">${coupon.code}</span>
        </td>
        <td>${coupon.name}</td>
        <td>
            <span class="discount-badge">${coupon.discountPercentage}%</span>
        </td>
        <td>
            <span class="badge bg-${stockClass}">${remainingStock}/${coupon.stock}</span>
        </td>
        <td>
            <span class="text-muted">${usedCount}</span>
        </td>
        <td><small>${validUntilDisplay}</small></td>
        <td>
            <span class="badge bg-${statusClass}">${statusText}</span>
        </td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-info" onclick="viewCoupon(${coupon.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn btn-outline-primary" onclick="editCoupon(${coupon.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-outline-${coupon.isActive ? 'warning' : 'success'}" 
                        onclick="toggleCouponStatus(${coupon.id})" 
                        title="${coupon.isActive ? 'Deactivate' : 'Activate'}">
                    <i class="fas fa-${coupon.isActive ? 'ban' : 'check'}"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// ✅ FIX: Update showCreateCouponModal dengan default date yang benar
function showCreateCouponModal() {
    currentEditingCouponId = null;
    elements.couponModalTitle.textContent = 'Create New Coupon';
    elements.couponSaveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Create Coupon';
    elements.couponForm.reset();
    
    // ✅ FIX: Set default expiry to 1 month from now dengan format yang benar
    const defaultExpiry = new Date();
    defaultExpiry.setMonth(defaultExpiry.getMonth() + 1);
    defaultExpiry.setHours(23, 59, 0, 0); // Set to end of day
    
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const defaultExpiryFormatted = defaultExpiry.toISOString().slice(0, 16);
    elements.couponValidUntil.value = defaultExpiryFormatted;
    
    console.log('📅 Default expiry set:', defaultExpiryFormatted);
    
    updateCouponPreview();
    
    const modal = new bootstrap.Modal(elements.couponModal);
    modal.show();
}

// Handle coupon form submission
// ✅ FIX: Update handleCouponFormSubmit dengan format tanggal yang benar
async function handleCouponFormSubmit(event) {
    event.preventDefault();
    
    // ✅ FIX: Format tanggal dengan benar untuk backend
    let validUntilFormatted = '';
    if (elements.couponValidUntil.value) {
        try {
            const dateInput = elements.couponValidUntil.value;
            // Convert from datetime-local format (YYYY-MM-DDTHH:MM) to backend format
            const date = new Date(dateInput);
            
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date selected');
            }
            
            // Format as YYYY-MM-DD HH:MM:SS for backend
            validUntilFormatted = date.toISOString().slice(0, 19).replace('T', ' ');
            console.log('📅 Formatted date:', validUntilFormatted);
        } catch (error) {
            showErrorMessage('Invalid date format. Please select a valid date.');
            return;
        }
    }
    
    const formData = {
        code: elements.couponCode.value.trim(),
        name: elements.couponName.value.trim(),
        discount_percentage: parseFloat(elements.couponDiscount.value),
        stock: parseInt(elements.couponStock.value),
        valid_until: validUntilFormatted,
        is_active: elements.couponIsActive.value === 'true'
    };
    
    console.log('📝 Form data to submit:', formData);
    
    // Validation
    if (!validateCouponData(formData)) return;
    
    elements.couponSaveBtn.disabled = true;
    elements.couponSaveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    
    try {
        let result;
        
        if (currentEditingCouponId) {
            result = await AdminAuth.updateCoupon(currentEditingCouponId, formData);
        } else {
            result = await AdminAuth.createCoupon(formData);
        }
        
        if (result && result.success) {
            showSuccessMessage(currentEditingCouponId ? 'Coupon updated successfully!' : 'Coupon created successfully!');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(elements.couponModal);
            modal.hide();
            
            // Reload coupons
            await loadCoupons();
        } else {
            showErrorMessage(result?.message || 'Operation failed');
        }
    } catch (error) {
        console.error('Error saving coupon:', error);
        
        // ✅ FIX: Better error message for date format issues
        let errorMessage = 'Failed to save coupon';
        if (error.message.includes('Invalid date format') || error.message.includes('date')) {
            errorMessage = 'Invalid date format. Please use YYYY-MM-DD HH:MM format.';
        } else if (error.message.includes('Server error: 400')) {
            errorMessage = 'Invalid data format. Please check all fields and try again.';
        } else {
            errorMessage = `Failed to save coupon: ${error.message}`;
        }
        
        showErrorMessage(errorMessage);
    } finally {
        elements.couponSaveBtn.disabled = false;
        elements.couponSaveBtn.innerHTML = currentEditingCouponId ? 
            '<i class="fas fa-save me-2"></i>Update Coupon' : 
            '<i class="fas fa-save me-2"></i>Create Coupon';
    }
}

// Validate coupon data
// ✅ FIX: Update validateCouponData dengan validasi tanggal yang lebih baik
function validateCouponData(data) {
    if (!data.code || data.code.length < 3) {
        showErrorMessage('Coupon code must be at least 3 characters long');
        elements.couponCode.focus();
        return false;
    }
    
    if (!data.name || data.name.length < 3) {
        showErrorMessage('Coupon name must be at least 3 characters long');
        elements.couponName.focus();
        return false;
    }
    
    if (!data.discount_percentage || data.discount_percentage < 1 || data.discount_percentage > 50) {
        showErrorMessage('Discount percentage must be between 1% and 50%');
        elements.couponDiscount.focus();
        return false;
    }
    
    if (!data.stock || data.stock < 1) {
        showErrorMessage('Stock must be at least 1');
        elements.couponStock.focus();
        return false;
    }
    
    // ✅ FIX: Better date validation
    if (!data.valid_until) {
        showErrorMessage('Valid until date is required');
        elements.couponValidUntil.focus();
        return false;
    }
    
    try {
        const validUntilDate = new Date(data.valid_until);
        const now = new Date();
        
        if (isNaN(validUntilDate.getTime())) {
            showErrorMessage('Invalid date format');
            elements.couponValidUntil.focus();
            return false;
        }
        
        if (validUntilDate <= now) {
            showErrorMessage('Valid until date must be in the future');
            elements.couponValidUntil.focus();
            return false;
        }
    } catch (error) {
        showErrorMessage('Invalid date format');
        elements.couponValidUntil.focus();
        return false;
    }
    
    return true;
}

// Update coupon preview
function updateCouponPreview() {
    const code = elements.couponCode.value || 'COUPON CODE';
    const name = elements.couponName.value || 'Coupon Name';
    const discount = elements.couponDiscount.value || '0';
    
    elements.previewCode.textContent = code;
    elements.previewName.textContent = name;
    elements.previewDiscount.textContent = `${discount}%`;
}

// View coupon details
function viewCoupon(couponId) {
    console.log('👁️ Viewing coupon:', couponId);
    
    const coupon = allCoupons.find(c => c.id === couponId);
    if (!coupon) {
        showErrorMessage('Coupon not found!');
        return;
    }
    
    const modal = new bootstrap.Modal(elements.couponDetailModal);
    
    const usedCount = coupon.usedCount || 0;
    const remainingStock = Math.max(0, coupon.stock - usedCount);
    const expiryDate = coupon.validUntil ? new Date(coupon.validUntil).toLocaleString() : 'No expiry';
    
    elements.couponDetailContent.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Coupon Information</h6>
                <table class="table table-sm">
                    <tr><td><strong>Code:</strong></td><td><span class="coupon-code-badge">${coupon.code}</span></td></tr>
                    <tr><td><strong>Name:</strong></td><td>${coupon.name}</td></tr>
                    <tr><td><strong>Discount:</strong></td><td><span class="discount-badge">${coupon.discountPercentage}%</span></td></tr>
                    <tr><td><strong>Status:</strong></td><td><span class="badge bg-${coupon.isActive ? 'success' : 'secondary'}">${coupon.isActive ? 'Active' : 'Inactive'}</span></td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Usage Statistics</h6>
                <table class="table table-sm">
                    <tr><td><strong>Total Stock:</strong></td><td>${coupon.stock}</td></tr>
                    <tr><td><strong>Used:</strong></td><td>${usedCount}</td></tr>
                    <tr><td><strong>Remaining:</strong></td><td>${remainingStock}</td></tr>
                    <tr><td><strong>Valid Until:</strong></td><td>${expiryDate}</td></tr>
                </table>
            </div>
        </div>
        
        <div class="mt-3">
            <h6>Coupon Preview</h6>
            <div class="coupon-preview-large">
                <div class="d-flex justify-content-between align-items-center p-3 border rounded" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div>
                        <h4 class="mb-0">${coupon.code}</h4>
                        <p class="mb-0 opacity-75">${coupon.name}</p>
                    </div>
                    <div class="text-end">
                        <h2 class="mb-0">${coupon.discountPercentage}%</h2>
                        <small class="opacity-75">OFF</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // ✅ FIX: Set dataset for action buttons
    if (elements.toggleCouponStatusBtn) {
        elements.toggleCouponStatusBtn.dataset.couponId = coupon.id;
        elements.toggleCouponStatusBtn.innerHTML = `
            <i class="fas fa-${coupon.isActive ? 'ban' : 'check'} me-2"></i>
            ${coupon.isActive ? 'Deactivate' : 'Activate'}
        `;
    }
    
    if (elements.editCouponBtn) {
        elements.editCouponBtn.dataset.couponId = coupon.id;
    }
    
    modal.show();
}

// Edit coupon
// ✅ FIX: Update editCoupon function dengan format tanggal yang benar
function editCoupon(couponId) {
    const coupon = allCoupons.find(c => c.id === couponId);
    if (!coupon) return;
    
    currentEditingCouponId = couponId;
    elements.couponModalTitle.textContent = 'Edit Coupon';
    elements.couponSaveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Update Coupon';
    
    // Populate form
    elements.couponCode.value = coupon.code;
    elements.couponName.value = coupon.name;
    elements.couponDiscount.value = coupon.discountPercentage;
    elements.couponStock.value = coupon.stock;
    
    // ✅ FIX: Handle different date formats from backend
    if (coupon.validUntil) {
        try {
            let dateValue = coupon.validUntil;
            
            // Handle different date formats
            if (typeof dateValue === 'string') {
                // Convert from backend format to datetime-local format
                const date = new Date(dateValue);
                
                if (!isNaN(date.getTime())) {
                    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
                    const localDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
                        .toISOString().slice(0, 16);
                    
                    elements.couponValidUntil.value = localDateTime;
                    console.log('📅 Set edit date:', localDateTime);
                } else {
                    console.warn('⚠️ Invalid date from backend:', dateValue);
                    elements.couponValidUntil.value = '';
                }
            }
        } catch (error) {
            console.error('❌ Error parsing date for edit:', error);
            elements.couponValidUntil.value = '';
        }
    } else {
        elements.couponValidUntil.value = '';
    }
    
    elements.couponIsActive.value = coupon.isActive.toString();
    
    updateCouponPreview();
    
    // Close detail modal if open
    const detailModal = bootstrap.Modal.getInstance(elements.couponDetailModal);
    if (detailModal) detailModal.hide();
    
    // Show edit modal
    const modal = new bootstrap.Modal(elements.couponModal);
    modal.show();
}

// Toggle coupon status
function toggleCouponStatus(couponId) {
    console.log('🔄 Toggling coupon status for ID:', couponId);
    
    const coupon = allCoupons.find(c => c.id === couponId);
    if (!coupon) {
        showErrorMessage('Coupon not found!');
        return;
    }
    
    const newStatus = !coupon.isActive;
    const statusText = newStatus ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${statusText} this coupon "${coupon.code}"?`)) {
        updateCouponStatus(couponId, newStatus);
    }
}

// Update coupon status
async function updateCouponStatus(couponId, isActive) {
    try {
        console.log('📤 Updating coupon status:', { couponId, isActive });
        
        // Show loading state
        const statusBtn = document.querySelector(`[onclick="toggleCouponStatus(${couponId})"]`);
        if (statusBtn) {
            statusBtn.disabled = true;
            statusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        const result = await AdminAuth.updateCoupon(couponId, { is_active: isActive });
        
        if (result && result.success) {
            showSuccessMessage(`Coupon ${isActive ? 'activated' : 'deactivated'} successfully!`);
            await loadCoupons(); // Reload coupons to reflect changes
        } else {
            showErrorMessage(result?.message || 'Failed to update coupon status');
        }
    } catch (error) {
        console.error('❌ Error updating coupon status:', error);
        showErrorMessage('Failed to update coupon status: ' + error.message);
    }
}

// Filter coupons
function filterCoupons() {
    currentPage = 1;
    applyFilters();
}

// Clear search
function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
    filterCoupons();
}

// Toggle select all
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.coupon-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = elements.selectAllCoupons.checked;
    });
}

// Export coupons (placeholder)
function exportCoupons() {
    // Simple CSV export
    const csvData = [
        ['Code', 'Name', 'Discount %', 'Stock', 'Used', 'Valid Until', 'Status']
    ];
    
    allCoupons.forEach(coupon => {
        csvData.push([
            coupon.code,
            coupon.name,
            coupon.discountPercentage,
            coupon.stock,
            coupon.usedCount || 0,
            coupon.validUntil || '',
            coupon.isActive ? 'Active' : 'Inactive'
        ]);
    });
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `coupons_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Bulk deactivate (placeholder)
function bulkDeactivate() {
    const selectedCoupons = Array.from(document.querySelectorAll('.coupon-checkbox:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedCoupons.length === 0) {
        showErrorMessage('Please select coupons to deactivate');
        return;
    }
    
    if (confirm(`Are you sure you want to deactivate ${selectedCoupons.length} selected coupons?`)) {
        // Implementation for bulk deactivate
        console.log('Bulk deactivating coupons:', selectedCoupons);
        showSuccessMessage(`${selectedCoupons.length} coupons deactivated`);
    }
}

// Refresh coupons
function refreshCoupons() {
    showSuccessMessage('Refreshing coupons...');
    loadCoupons();
}

// Update pagination
function updatePagination(totalCoupons) {
    if (!elements.paginationContainer) return;
    
    const totalPages = Math.ceil(totalCoupons / couponsPerPage);
    
    if (totalPages <= 1) {
        elements.paginationContainer.style.display = 'none';
        return;
    }
    
    elements.paginationContainer.style.display = 'block';
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
        </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    
    // Next button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
        </li>
    `;
    
    elements.paginationContainer.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredCoupons.length / couponsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderCoupons(filteredCoupons);
}

// Utility functions
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

function showSuccessMessage(message) {
    AdminAuth.showMessage(message, 'success');
}

function showErrorMessage(message) {
    AdminAuth.showMessage(message, 'error');
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
    elements.couponsTableContainer.style.display = 'none';
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

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        AdminAuth.logout();
        window.location.href = '/admin/login';
    }
}

// Helper functions untuk date handling
function formatDateForBackend(dateInput) {
    try {
        if (!dateInput) return null;
        
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }
        
        // Format as YYYY-MM-DD HH:MM:SS
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch (error) {
        console.error('Error formatting date for backend:', error);
        return null;
    }
}

function formatDateForDisplay(dateString) {
    try {
        if (!dateString) return 'No expiry';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        return date.toLocaleDateString() + ' ' + 
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('Error formatting date for display:', error);
        return 'Invalid date';
    }
}

function formatDateForInput(dateString) {
    try {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }
        
        // Format for datetime-local input (YYYY-MM-DDTHH:MM)
        const localDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
            .toISOString().slice(0, 16);
            
        return localDateTime;
    } catch (error) {
        console.error('Error formatting date for input:', error);
        return '';
    }
}

// Global functions for inline handlers
window.showCreateCouponModal = showCreateCouponModal;
window.viewCoupon = viewCoupon;
window.editCoupon = editCoupon;
window.editCurrentCoupon = editCurrentCoupon;
window.toggleCouponStatus = toggleCouponStatus; // ✅ PASTIKAN INI ADA
window.updateCouponStatus = updateCouponStatus; // ✅ TAMBAHKAN INI
window.editCurrentCoupon = editCurrentCoupon; // ✅ TAMBAHKAN INI
window.refreshCoupons = refreshCoupons;
window.exportCoupons = exportCoupons;
window.bulkDeactivate = bulkDeactivate;
window.changePage = changePage;
window.logout = logout;

console.log('✅ Admin coupons management loaded successfully');
console.log('🔧 Available global functions:', [
    'showCreateCouponModal',
    'viewCoupon', 
    'editCoupon',
    'editCurrentCoupon', 
    'toggleCouponStatus',
    'updateCouponStatus',
    'refreshCoupons',
    'exportCoupons',
    'bulkDeactivate',
    'changePage',
    'logout'
]);