document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('admin-login-form');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const togglePasswordBtn = document.getElementById('admin-toggle-password');
    const loginBtn = document.getElementById('admin-login-btn');
    const loginBtnText = document.getElementById('admin-login-btn-text');
    const loginSpinner = document.getElementById('admin-login-spinner');
    const alertContainer = document.getElementById('admin-login-alert');
    const alertMessage = document.getElementById('admin-alert-message');
    const rememberMeCheckbox = document.getElementById('admin-remember-me');

    // Check if already logged in as admin
    if (AdminAuth.isLoggedIn() && AdminAuth.isAdmin()) {
        console.log('Admin already logged in, redirecting to dashboard...');
        window.location.href = '/admin';
        return;
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

    // Show alert function
    function showAlert(message, type = 'danger') {
        const alertIcon = alertContainer.querySelector('.alert-icon');
        
        // Set appropriate icon based on type
        const iconClass = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-triangle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        }[type] || 'fas fa-info-circle';
        
        alertIcon.className = `alert-icon ${iconClass}`;
        alertMessage.textContent = message;
        alertContainer.className = `alert-container alert-${type}`;
        alertContainer.style.display = 'block';
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            hideAlert();
        }, 5000);
    }

    // Hide alert function
    function hideAlert() {
        alertContainer.style.display = 'none';
    }

    // Set loading state
    function setLoadingState(loading) {
        loginBtn.disabled = loading;
        loginBtnText.style.display = loading ? 'none' : 'inline';
        loginSpinner.style.display = loading ? 'inline-block' : 'none';
        
        // Disable form inputs during loading
        emailInput.disabled = loading;
        passwordInput.disabled = loading;
        if (togglePasswordBtn) togglePasswordBtn.disabled = loading;
        if (rememberMeCheckbox) rememberMeCheckbox.disabled = loading;
    }

    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        hideAlert();

        // Get form data
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!email) {
            showAlert('Email is required', 'error');
            emailInput.focus();
            return;
        }

        if (!password) {
            showAlert('Password is required', 'error');
            passwordInput.focus();
            return;
        }

        // Set loading state
        setLoadingState(true);

        try {
            console.log('Attempting admin login for:', email);
            
            // Call admin login API
            const result = await AdminAuth.login(email, password);
            
            console.log('Admin login successful:', result);
            
            // Show success message
            showAlert('Login successful! Redirecting to admin dashboard...', 'success');
            
            // Handle remember me
            if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                localStorage.setItem('admin_remember_me', 'true');
            } else {
                localStorage.removeItem('admin_remember_me');
            }
            
            // Clear form for security
            loginForm.reset();
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1500);
            
        } catch (error) {
            console.error('Admin login error:', error);
            setLoadingState(false);
            
            // Show error message with specific handling
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.message.includes('Invalid credentials') || 
                error.message.includes('Invalid email or password')) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else if (error.message.includes('Admin privileges required')) {
                errorMessage = 'Access denied. Only administrators can access this portal.';
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('GraphQL') || error.message.includes('server')) {
                errorMessage = 'Server error. Please try again in a few moments.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showAlert(errorMessage, 'error');
        }
    });

    // Handle Enter key in password field
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    // Handle Enter key in email field
    emailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus();
        }
    });

    // Auto-hide alerts when user starts typing
    emailInput.addEventListener('focus', hideAlert);
    passwordInput.addEventListener('focus', hideAlert);

    // Focus on email field when page loads
    emailInput.focus();

    console.log('Admin login page initialized');
});