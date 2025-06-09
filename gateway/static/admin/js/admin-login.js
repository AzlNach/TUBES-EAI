/**
 * Admin Login JavaScript
 * Handles admin authentication
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    if (AdminAuth.isLoggedIn() && AdminAuth.isAdmin()) {
        window.location.href = '/admin';
        return;
    }
    
    initializeLoginPage();
});

function initializeLoginPage() {
    const loginForm = document.getElementById('admin-login-form');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const togglePasswordBtn = document.getElementById('admin-toggle-password');
    const rememberMeCheckbox = document.getElementById('admin-remember-me');
    const loginBtn = document.getElementById('admin-login-btn');
    const loginBtnText = document.getElementById('admin-login-btn-text');
    const loginSpinner = document.getElementById('admin-login-spinner');
    const alertContainer = document.getElementById('admin-login-alert');
    const alertMessage = document.getElementById('admin-alert-message');
    
    // Show demo credentials in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const demoCredentials = document.getElementById('demo-credentials');
        if (demoCredentials) {
            demoCredentials.style.display = 'block';
        }
    }
    
    // Toggle password visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }
    
    // Form validation
    emailInput.addEventListener('blur', function() {
        validateEmail(this.value.trim());
    });
    
    passwordInput.addEventListener('blur', function() {
        validatePassword(this.value);
    });
    
    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        hideAlert();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        // Validate inputs
        if (!validateEmail(email) || !validatePassword(password)) {
            return;
        }
        
        try {
            setLoadingState(true);
            
            console.log('Attempting admin login for:', email);
            
            const result = await AdminAuth.login(email, password);
            
            if (result.success) {
                showAlert('Login successful! Redirecting to dashboard...', 'success');
                
                // Handle remember me
                if (rememberMeCheckbox.checked) {
                    localStorage.setItem('admin_remember_me', 'true');
                }
                
                // Redirect to admin dashboard
                setTimeout(() => {
                    window.location.href = '/admin';
                }, 1500);
            } else {
                throw new Error('Login failed');
            }
            
        } catch (error) {
            console.error('Admin login error:', error);
            setLoadingState(false);
            
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.message.includes('Invalid credentials') || 
                error.message.includes('Invalid email or password')) {
                errorMessage = 'Invalid email or password. Please check your credentials.';
            } else if (error.message.includes('Admin access required')) {
                errorMessage = 'Admin access required. Please contact system administrator.';
            } else if (error.message.includes('Network')) {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            showAlert(errorMessage, 'danger');
            emailInput.focus();
        }
    });
    
    // Focus on email field
    emailInput.focus();
    
    // Auto-fill demo credentials if demo parameter is present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
        emailInput.value = 'admin@cinema.com';
        passwordInput.value = 'admin123';
        showAlert('Demo credentials loaded. Click Sign In to proceed.', 'info');
    }
}

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    const emailInput = document.getElementById('admin-email');
    if (!isValid && email) {
        emailInput.classList.add('is-invalid');
        return false;
    } else {
        emailInput.classList.remove('is-invalid');
        return true;
    }
}

function validatePassword(password) {
    const isValid = password && password.length >= 6;
    
    const passwordInput = document.getElementById('admin-password');
    if (!isValid && password) {
        passwordInput.classList.add('is-invalid');
        return false;
    } else {
        passwordInput.classList.remove('is-invalid');
        return true;
    }
}

// Show alert
function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('admin-login-alert');
    const alertMessage = document.getElementById('admin-alert-message');
    const alertElement = alertContainer.querySelector('.alert');
    
    alertMessage.textContent = message;
    alertElement.className = `alert alert-${type}`;
    alertContainer.style.display = 'block';
    
    // Auto hide success messages
    if (type === 'success') {
        setTimeout(() => {
            hideAlert();
        }, 3000);
    }
}

// Hide alert
function hideAlert() {
    const alertContainer = document.getElementById('admin-login-alert');
    alertContainer.style.display = 'none';
}

// Set loading state
function setLoadingState(loading) {
    const loginBtn = document.getElementById('admin-login-btn');
    const loginBtnText = document.getElementById('admin-login-btn-text');
    const loginSpinner = document.getElementById('admin-login-spinner');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    
    if (loading) {
        loginBtn.disabled = true;
        loginBtnText.style.display = 'none';
        loginSpinner.style.display = 'inline-block';
        emailInput.disabled = true;
        passwordInput.disabled = true;
    } else {
        loginBtn.disabled = false;
        loginBtnText.style.display = 'inline';
        loginSpinner.style.display = 'none';
        emailInput.disabled = false;
        passwordInput.disabled = false;
    }
}

console.log('Admin login page initialized');