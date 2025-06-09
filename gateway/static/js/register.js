document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');
    const termsCheckbox = document.getElementById('terms');
    const newsletterCheckbox = document.getElementById('newsletter');
    const registerBtn = document.getElementById('register-btn');
    const registerBtnText = document.getElementById('register-btn-text');
    const registerSpinner = document.getElementById('register-spinner');
    const alertContainer = document.getElementById('register-alert');
    const alertMessage = document.getElementById('alert-message');

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

    if (toggleConfirmPasswordBtn) {
        toggleConfirmPasswordBtn.addEventListener('click', function() {
            const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            confirmPasswordInput.setAttribute('type', type);
            
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }

    // Real-time validation
    usernameInput.addEventListener('input', function() {
        FormValidator.clearFieldError('username');
        if (this.value && !FormValidator.validateUsername(this.value)) {
            FormValidator.showFieldError('username', 'Username must be 3-20 characters long');
        }
    });

    emailInput.addEventListener('input', function() {
        FormValidator.clearFieldError('email');
        if (this.value && !FormValidator.validateEmail(this.value)) {
            FormValidator.showFieldError('email', 'Please enter a valid email address');
        }
    });

    passwordInput.addEventListener('input', function() {
        FormValidator.clearFieldError('password');
        if (this.value && !FormValidator.validatePassword(this.value)) {
            FormValidator.showFieldError('password', 'Password must be at least 6 characters long');
        }
        
        // Also validate confirm password if it has a value
        if (confirmPasswordInput.value) {
            validatePasswordMatch();
        }
    });

    confirmPasswordInput.addEventListener('input', function() {
        validatePasswordMatch();
    });

    // Password match validation
    function validatePasswordMatch() {
        FormValidator.clearFieldError('confirm-password');
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (confirmPassword && password !== confirmPassword) {
            FormValidator.showFieldError('confirm-password', 'Passwords do not match');
            return false;
        }
        return true;
    }

    // Terms checkbox validation
    termsCheckbox.addEventListener('change', function() {
        FormValidator.clearFieldError('terms');
    });

    // Show alert function
    function showAlert(message, type = 'danger') {
        alertMessage.textContent = message;
        alertContainer.className = `alert alert-${type} alert-dismissible fade show`;
        alertContainer.style.display = 'block';
        
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
        registerBtn.disabled = loading;
        registerBtnText.style.display = loading ? 'none' : 'inline';
        registerSpinner.style.display = loading ? 'inline-block' : 'none';
        
        if (loading) {
            registerBtn.classList.add('pe-none');
        } else {
            registerBtn.classList.remove('pe-none');
        }
    }

    // Handle form submission
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        FormValidator.clearAllErrors('register-form');
        hideAlert();

        // Get form data
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const acceptTerms = termsCheckbox.checked;
        const subscribeNewsletter = newsletterCheckbox.checked;

        // Validate inputs
        let hasErrors = false;

        if (!username) {
            FormValidator.showFieldError('username', 'Username is required');
            hasErrors = true;
        } else if (!FormValidator.validateUsername(username)) {
            FormValidator.showFieldError('username', 'Username must be 3-20 characters long');
            hasErrors = true;
        }

        if (!email) {
            FormValidator.showFieldError('email', 'Email is required');
            hasErrors = true;
        } else if (!FormValidator.validateEmail(email)) {
            FormValidator.showFieldError('email', 'Please enter a valid email address');
            hasErrors = true;
        }

        if (!password) {
            FormValidator.showFieldError('password', 'Password is required');
            hasErrors = true;
        } else if (!FormValidator.validatePassword(password)) {
            FormValidator.showFieldError('password', 'Password must be at least 6 characters long');
            hasErrors = true;
        }

        if (!confirmPassword) {
            FormValidator.showFieldError('confirm-password', 'Please confirm your password');
            hasErrors = true;
        } else if (password !== confirmPassword) {
            FormValidator.showFieldError('confirm-password', 'Passwords do not match');
            hasErrors = true;
        }

        if (!acceptTerms) {
            FormValidator.showFieldError('terms', 'You must accept the terms and conditions');
            hasErrors = true;
        }

        if (hasErrors) {
            return;
        }

        // Set loading state
        setLoadingState(true);

        try {
            console.log('Attempting registration for:', { username, email, subscribeNewsletter });
            
            // Call register API
            const result = await AuthService.register(username, email, password);
            
            console.log('Registration successful:', result);
            
            // Show success message
            showAlert('Registration successful! Redirecting to dashboard...', 'success');
            
            // Clear form
            registerForm.reset();
            
            // UPDATED: Redirect to dashboard after successful registration
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            
        } catch (error) {
            console.error('Registration error:', error);
            setLoadingState(false);
            
            // Show error message
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('Username already exists') || 
                error.message.includes('username') && error.message.includes('exist')) {
                errorMessage = 'This username is already taken. Please choose a different one.';
                FormValidator.showFieldError('username', 'Username already exists');
                usernameInput.focus();
            } else if (error.message.includes('Email already exists') || 
                       error.message.includes('email') && error.message.includes('exist')) {
                errorMessage = 'This email is already registered. Please use a different email or try logging in.';
                FormValidator.showFieldError('email', 'Email already exists');
                emailInput.focus();
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('GraphQL')) {
                errorMessage = 'Server error. Please try again later.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showAlert(errorMessage, 'danger');
        }
    });

    // Enhanced form validation feedback
    function setupFormValidation() {
        // Username validation feedback
        usernameInput.addEventListener('blur', function() {
            const username = this.value.trim();
            if (username) {
                if (FormValidator.validateUsername(username)) {
                    this.classList.remove('is-invalid');
                    this.classList.add('is-valid');
                } else {
                    this.classList.remove('is-valid');
                    this.classList.add('is-invalid');
                    FormValidator.showFieldError('username', 'Username must be 3-20 characters long');
                }
            }
        });

        // Email validation feedback
        emailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            if (email) {
                if (FormValidator.validateEmail(email)) {
                    this.classList.remove('is-invalid');
                    this.classList.add('is-valid');
                } else {
                    this.classList.remove('is-valid');
                    this.classList.add('is-invalid');
                    FormValidator.showFieldError('email', 'Please enter a valid email address');
                }
            }
        });

        // Password validation feedback
        passwordInput.addEventListener('blur', function() {
            const password = this.value;
            if (password) {
                if (FormValidator.validatePassword(password)) {
                    this.classList.remove('is-invalid');
                    this.classList.add('is-valid');
                } else {
                    this.classList.remove('is-valid');
                    this.classList.add('is-invalid');
                    FormValidator.showFieldError('password', 'Password must be at least 6 characters long');
                }
            }
        });

        // Confirm password validation feedback
        confirmPasswordInput.addEventListener('blur', function() {
            validatePasswordMatch();
            const password = passwordInput.value;
            const confirmPassword = this.value;
            if (confirmPassword && password === confirmPassword) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    }

    // Initialize form validation
    setupFormValidation();

    // Focus on username field when page loads
    usernameInput.focus();

    console.log('Register page initialized with Flask routing');
});