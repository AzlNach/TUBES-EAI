// ✅ SIMPLE PAYMENTS JS - Copy dari bookings.js dan sesuaikan
let allPayments = [];
let filteredPayments = [];
let currentPage = 1;
const paymentsPerPage = 10;

let elements = {};

document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});

function initializePage() {
    if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) {
        window.location.href = '/admin/login';
        return;
    }
    
    cacheElements();
    setupEventListeners();
    loadPayments();
}

function cacheElements() {
    elements = {
        loadingContainer: document.getElementById('payments-loading-container'),
        paymentsTableContainer: document.getElementById('payments-table-container'),
        paymentsTableBody: document.getElementById('payments-table-body'),
        emptyState: document.getElementById('payments-empty-state'),
        errorState: document.getElementById('payments-error-state'),
        errorMessage: document.getElementById('payments-error-message'),
        
        // Filters
        statusFilter: document.getElementById('payment-status-filter'),
        dateFilter: document.getElementById('payment-date-filter'),
        searchInput: document.getElementById('payment-search-input'),
        clearSearch: document.getElementById('payment-clear-search'),
        
        // Stats
        totalPaymentsCount: document.getElementById('total-payments-count'),
        successPaymentsCount: document.getElementById('success-payments-count'),
        pendingPaymentsCount: document.getElementById('pending-payments-count'),
        failedPaymentsCount: document.getElementById('failed-payments-count'),
        
        // Pagination
        paginationContainer: document.getElementById('payments-pagination')
    };
}

function setupEventListeners() {
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    if (elements.clearSearch) {
        elements.clearSearch.addEventListener('click', clearSearch);
    }
    
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', applyFilters);
    }
    
    if (elements.dateFilter) {
        elements.dateFilter.addEventListener('change', applyFilters);
    }
}

async function loadPayments() {
    try {
        showLoadingState();
        
        console.log('Loading payments for admin...');
        const payments = await AdminAuth.getPayments();
        
        if (payments && payments.length > 0) {
            allPayments = payments;
            updateStats(payments);
            applyFilters();
        } else {
            allPayments = [];
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading payments:', error);
        showErrorState('Failed to load payments. Please try again.');
    }
}

function updateStats(payments) {
    const totalPayments = payments.length;
    const successPayments = payments.filter(p => p.status === 'success').length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const failedPayments = payments.filter(p => p.status === 'failed').length;
    
    if (elements.totalPaymentsCount) {
        elements.totalPaymentsCount.textContent = totalPayments;
    }
    
    if (elements.successPaymentsCount) {
        elements.successPaymentsCount.textContent = successPayments;
    }
    
    if (elements.pendingPaymentsCount) {
        elements.pendingPaymentsCount.textContent = pendingPayments;
    }
    
    if (elements.failedPaymentsCount) {
        elements.failedPaymentsCount.textContent = failedPayments;
    }
}

function applyFilters() {
    const searchTerm = elements.searchInput?.value.toLowerCase() || '';
    const selectedStatus = elements.statusFilter?.value || '';
    const selectedDate = elements.dateFilter?.value || '';
    
    filteredPayments = allPayments.filter(payment => {
        const matchesSearch = !searchTerm || 
            payment.id.toString().includes(searchTerm) ||
            payment.userId.toString().includes(searchTerm) ||
            payment.bookingId.toString().includes(searchTerm);
            
        const matchesStatus = !selectedStatus || payment.status === selectedStatus;
        
        const matchesDate = !selectedDate || 
            payment.createdAt?.startsWith(selectedDate);
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    renderPayments(filteredPayments);
}

function renderPayments(payments) {
    if (!payments || payments.length === 0) {
        showEmptyState();
        return;
    }
    
    hideAllStates();
    elements.paymentsTableContainer.style.display = 'block';
    
    elements.paymentsTableBody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * paymentsPerPage;
    const endIndex = startIndex + paymentsPerPage;
    const paginatedPayments = payments.slice(startIndex, endIndex);
    
    paginatedPayments.forEach(payment => {
        const row = createPaymentRow(payment);
        elements.paymentsTableBody.appendChild(row);
    });
    
    updatePagination(payments.length);
}

function createPaymentRow(payment) {
    const row = document.createElement('tr');
    
    const paymentDate = payment.createdAt ? 
        new Date(payment.createdAt).toLocaleDateString() : 'N/A';
    
    const statusClass = {
        'success': 'success',
        'pending': 'warning',
        'failed': 'danger'
    }[payment.status] || 'secondary';
    
    row.innerHTML = `
        <td>#${payment.id}</td>
        <td>User ID: ${payment.userId || 'N/A'}</td>
        <td>Booking ID: ${payment.bookingId || 'N/A'}</td>
        <td>$${payment.amount || '0.00'}</td>
        <td>${payment.paymentMethod || 'N/A'}</td>
        <td><span class="badge bg-${statusClass}">${payment.status}</span></td>
        <td>${paymentDate}</td>
        <td>
            <div class="btn-group btn-group-sm" role="group">
                <button type="button" class="btn btn-outline-info" onclick="viewPayment(${payment.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

function updatePagination(totalPayments) {
    if (!elements.paginationContainer) return;
    
    const totalPages = Math.ceil(totalPayments / paymentsPerPage);
    
    if (totalPages <= 1) {
        elements.paginationContainer.style.display = 'none';
        return;
    }
    
    elements.paginationContainer.style.display = 'block';
    
    let paginationHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    
    elements.paginationContainer.innerHTML = paginationHTML;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderPayments(filteredPayments);
}

function handleSearch() {
    currentPage = 1;
    applyFilters();
}

function clearSearch() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
    currentPage = 1;
    applyFilters();
}

function viewPayment(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (payment) {
        const details = `
Payment Details:

ID: ${payment.id}
User ID: ${payment.userId || 'N/A'}
Booking ID: ${payment.bookingId || 'N/A'}
Amount: $${payment.amount || '0.00'}
Method: ${payment.paymentMethod || 'N/A'}
Status: ${payment.status}
Created: ${payment.createdAt ? new Date(payment.createdAt).toLocaleString() : 'N/A'}
Updated: ${payment.updatedAt ? new Date(payment.updatedAt).toLocaleString() : 'N/A'}
        `;
        alert(details);
    }
}

function refreshPayments() {
    console.log('Refreshing payments...');
    loadPayments();
}

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
    elements.paymentsTableContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
}

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

// Global functions
window.viewPayment = viewPayment;
window.refreshPayments = refreshPayments;
window.changePage = changePage;

console.log('Admin payments management loaded');