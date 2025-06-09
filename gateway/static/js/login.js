document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const loginBtn = document.getElementById('login-btn');
    const loginBtnText = document.getElementById('login-btn-text');
    const loginSpinner = document.getElementById('login-spinner');
    const alertContainer = document.getElementById('login-alert');
    const alertMessage = document.getElementById('alert-message');
    const rememberMeCheckbox = document.getElementById('remember-me');

    // Check if already logged in - UPDATED: redirect to dashboard
    if (AuthService.isLoggedIn()) {
        console.log('User already logged in, redirecting to dashboard...');
        window.location.href = '/dashboard';
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

    // Real-time validation with enhanced feedback
    emailInput.addEventListener('input', function() {
        FormValidator.clearFieldError('email');
        const email = this.value.trim();
        
        if (email && !FormValidator.validateEmail(email)) {
            FormValidator.showFieldError('email', 'Please enter a valid email address');
            this.classList.remove('is-valid');
        } else if (email && FormValidator.validateEmail(email)) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
        }
    });

    passwordInput.addEventListener('input', function() {
        FormValidator.clearFieldError('password');
        const password = this.value;
        
        if (password && !FormValidator.validatePassword(password)) {
            FormValidator.showFieldError('password', 'Password must be at least 6 characters long');
            this.classList.remove('is-valid');
        } else if (password && FormValidator.validatePassword(password)) {
            this.classList.remove('is-invalid');
            this.classList.add('is-valid');
        }
    });

    // Enhanced blur validation
    emailInput.addEventListener('blur', function() {
        const email = this.value.trim();
        if (email) {
            if (FormValidator.validateEmail(email)) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
                FormValidator.clearFieldError('email');
            } else {
                this.classList.remove('is-valid');
                this.classList.add('is-invalid');
                FormValidator.showFieldError('email', 'Please enter a valid email address');
            }
        }
    });

    passwordInput.addEventListener('blur', function() {
        const password = this.value;
        if (password) {
            if (FormValidator.validatePassword(password)) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
                FormValidator.clearFieldError('password');
            } else {
                this.classList.remove('is-valid');
                this.classList.add('is-invalid');
                FormValidator.showFieldError('password', 'Password must be at least 6 characters long');
            }
        }
    });

    // Show alert function
    function showAlert(message, type = 'danger') {
        alertMessage.textContent = message;
        alertContainer.className = `alert alert-${type} alert-dismissible fade show`;
        alertContainer.style.display = 'block';
        
        // Scroll to alert if needed
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            hideAlert();
        }, 5000);
    }

    // Hide alert function
    function hideAlert() {
        alertContainer.style.display = 'none';
        alertContainer.className = 'alert alert-dismissible fade';
    }

    // Set loading state
    function setLoadingState(loading) {
        loginBtn.disabled = loading;
        loginBtnText.style.display = loading ? 'none' : 'inline';
        loginSpinner.style.display = loading ? 'inline-block' : 'none';
        
        // Disable form inputs during loading
        emailInput.disabled = loading;
        passwordInput.disabled = loading;
        togglePasswordBtn.disabled = loading;
        rememberMeCheckbox.disabled = loading;
        
        if (loading) {
            loginBtn.classList.add('pe-none');
        } else {
            loginBtn.classList.remove('pe-none');
        }
    }

    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        FormValidator.clearAllErrors('login-form');
        hideAlert();

        // Get form data
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validate inputs
        let hasErrors = false;

        if (!email) {
            FormValidator.showFieldError('email', 'Email is required');
            emailInput.classList.add('is-invalid');
            hasErrors = true;
        } else if (!FormValidator.validateEmail(email)) {
            FormValidator.showFieldError('email', 'Please enter a valid email address');
            emailInput.classList.add('is-invalid');
            hasErrors = true;
        }

        if (!password) {
            FormValidator.showFieldError('password', 'Password is required');
            passwordInput.classList.add('is-invalid');
            hasErrors = true;
        } else if (!FormValidator.validatePassword(password)) {
            FormValidator.showFieldError('password', 'Password must be at least 6 characters long');
            passwordInput.classList.add('is-invalid');
            hasErrors = true;
        }

        if (hasErrors) {
            // Focus on first invalid field
            const firstInvalidField = loginForm.querySelector('.is-invalid');
            if (firstInvalidField) {
                firstInvalidField.focus();
            }
            return;
        }

        // Set loading state
        setLoadingState(true);

        try {
            console.log('Attempting login for:', email);
            
            // Call login API
            const result = await AuthService.login(email, password);
            
            console.log('Login successful:', result);
            
            // Show success message
            showAlert('Login successful! Redirecting to dashboard...', 'success');
            
            // Handle remember me (optional - could be implemented to extend token expiry)
            if (rememberMeCheckbox.checked) {
                console.log('Remember me checked - extending session duration');
                // This could be handled on the backend to set longer token expiry
                localStorage.setItem('rememberMe', 'true');
            } else {
                localStorage.removeItem('rememberMe');
            }
            
            // Clear form for security
            loginForm.reset();
            
            // UPDATED: Always redirect to dashboard after successful login
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
            
        } catch (error) {
            console.error('Login error:', error);
            setLoadingState(false);
            
            // Show error message with specific handling
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.message.includes('Invalid credentials') || 
                error.message.includes('Invalid email or password')) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.';
                // Focus on email for retry
                emailInput.focus();
                emailInput.select();
            } else if (error.message.includes('User not found')) {
                errorMessage = 'No account found with this email address. Please check your email or register for a new account.';
                FormValidator.showFieldError('email', 'Account not found');
                emailInput.focus();
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.message.includes('GraphQL') || error.message.includes('server')) {
                errorMessage = 'Server error. Please try again in a few moments.';
            } else if (error.message.includes('Token')) {
                errorMessage = 'Authentication error. Please try logging in again.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showAlert(errorMessage, 'danger');
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

    // Handle "Forgot Password" click
    const forgotPasswordLink = document.querySelector('a[href="/forgot-password"]');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            showAlert('Forgot password functionality will be implemented soon. Please contact support for password recovery.', 'info');
        });
    }

    // Auto-fill demo credentials (for development only)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('demo') === 'true') {
            emailInput.value = 'demo@cinema.com';
            passwordInput.value = 'demo123';
            showAlert('Demo credentials loaded. Click Sign In to proceed.', 'info');
        }
    }

    // Focus on email field when page loads
    emailInput.focus();

    // Handle tab navigation
    loginForm.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            // Let default tab behavior work
            return;
        }
    });

    // Auto-hide alerts when user starts typing
    emailInput.addEventListener('focus', hideAlert);
    passwordInput.addEventListener('focus', hideAlert);

    // Clear validation states when user focuses on input
    emailInput.addEventListener('focus', function() {
        this.classList.remove('is-invalid', 'is-valid');
        FormValidator.clearFieldError('email');
    });

    passwordInput.addEventListener('focus', function() {
        this.classList.remove('is-invalid', 'is-valid');
        FormValidator.clearFieldError('password');
    });

    console.log('Login page initialized with Flask routing');
});