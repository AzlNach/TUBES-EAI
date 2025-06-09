document.addEventListener('DOMContentLoaded', function() {
    // Initialize authentication check
    updateNavigation();
    
    // Define isLoggedIn variable that was missing
    const isLoggedIn = AuthService.isLoggedIn();
    
    // Intersection Observer untuk animasi yang smooth
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible-element');
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Load movies and cinemas dengan animasi terpisah
    loadFeaturedMovies();
    loadPopularCinemas();

    // Smooth scrolling untuk internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navbar scroll effect
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScrollTop = scrollTop;
    });

    // Load featured movies - UPDATED to use public/authenticated based on login status
    async function loadFeaturedMovies() {
        const container = document.getElementById('featured-movies');
        const moviesSection = container.closest('section');
        moviesSection.classList.add('movies-section');
        
        try {
            // Show loading
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading movies...</span>
                    </div>
                    <p class="mt-3">Loading featured movies...</p>
                </div>
            `;

            console.log('Fetching movies for display...');
            
            // UPDATED: Use helper method that handles public/authenticated access
            const movies = await AuthService.getMoviesForDisplay();
            
            console.log('Movies received:', movies);
            
            if (movies && movies.length > 0) {
                // Batasi ke 6 film untuk featured
                const featuredMovies = movies.slice(0, 6);
                
                container.innerHTML = '';
                featuredMovies.forEach((movie, index) => {
                    const movieCard = createMovieCard(movie, index);
                    container.appendChild(movieCard);
                    
                    movieCard.classList.add('hidden-element');
                    observer.observe(movieCard);
                });
                
                console.log(`Successfully loaded ${featuredMovies.length} movies`);
            } else {
                console.log('No movies received from service');
                container.innerHTML = `
                    <div class="col-12 text-center">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            No movies available at the moment.
                            <br><small>Please try refreshing the page.</small>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading movies:', error);
            container.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Unable to load movies at the moment.
                        <br><small>Error: ${error.message}</small>
                        ${!AuthService.isLoggedIn() ? 
                            '<br><a href="/login" class="btn btn-primary btn-sm mt-2"><i class="fas fa-sign-in-alt me-1"></i>Login to access full content</a>' : 
                            '<br><small>Please try again later.</small>'
                        }
                    </div>
                </div>
            `;
        }
    }

    // Load popular cinemas - UPDATED to use public/authenticated based on login status
    async function loadPopularCinemas() {
        const container = document.getElementById('popular-cinemas');
        const cinemasSection = container.closest('section');
        cinemasSection.classList.add('cinemas-section');
        
        try {
            // Show loading dengan delay untuk menghindari bentrok
            setTimeout(() => {
                if (container) {
                    container.innerHTML = `
                        <div class="col-12 text-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading cinemas...</span>
                            </div>
                            <p class="mt-3">Loading popular cinemas...</p>
                        </div>
                    `;
                }
            }, 500);

            console.log('Fetching cinemas for display...');

            // UPDATED: Use helper method that handles public/authenticated access
            const cinemas = await AuthService.getCinemasForDisplay();
            
            console.log('Cinemas received:', cinemas);
            
            if (cinemas && cinemas.length > 0) {
                // Batasi ke 6 cinema untuk popular
                const popularCinemas = cinemas.slice(0, 6);
                
                // Delay rendering untuk menghindari bentrok dengan movies
                setTimeout(() => {
                    if (container) {
                        container.innerHTML = '';
                        popularCinemas.forEach((cinema, index) => {
                            const cinemaCard = createCinemaCard(cinema, index);
                            container.appendChild(cinemaCard);
                            
                            cinemaCard.classList.add('hidden-element');
                            observer.observe(cinemaCard);
                        });
                        
                        console.log(`Successfully loaded ${popularCinemas.length} cinemas`);
                    }
                }, 800);
            } else {
                console.log('No cinemas received from service');
                setTimeout(() => {
                    if (container) {
                        container.innerHTML = `
                            <div class="col-12 text-center">
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    No cinemas available at the moment.
                                    <br><small>Please try refreshing the page.</small>
                                </div>
                            </div>
                        `;
                    }
                }, 800);
            }
        } catch (error) {
            console.error('Error loading cinemas:', error);
            setTimeout(() => {
                if (container) {
                    container.innerHTML = `
                        <div class="col-12 text-center">
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Unable to load cinemas at the moment.
                                <br><small>Error: ${error.message}</small>
                            </div>
                        </div>
                    `;
                }
            }, 800);
        }
    }
    
    // Create movie card - UPDATED to handle login requirement for details
    // Create movie card - UPDATED to handle login requirement for details
    function createMovieCard(movie, index) {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 mb-4';
        
        // DIPERBAIKI: Gunakan gambar movie yang sebenarnya dengan fallback
        const movieImages = {
            // Action Movies
            'Action': [
                'https://images.unsplash.com/photo-1489599735188-3ba5f42c6681?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1478720568477-b2709d36e4a6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ],
            // Drama Movies  
            'Drama': [
                'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1489599735188-3ba5f42c6681?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1485095329183-d0797cdc5676?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ],
            // Comedy Movies
            'Comedy': [
                'https://images.unsplash.com/photo-1489599735188-3ba5f42c6681?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ],
            // Horror Movies
            'Horror': [
                'https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ],
            // Sci-Fi Movies
            'Sci-Fi': [
                'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1635805737707-575885ab0820?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ],
            // Romance Movies
            'Romance': [
                'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1485095329183-d0797cdc5676?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ],
            // Thriller Movies
            'Thriller': [
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
                'https://images.unsplash.com/photo-1489599735188-3ba5f42c6681?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
            ]
        };
        
        // Default movie images jika genre tidak ditemukan
        const defaultImages = [
            'https://images.unsplash.com/photo-1489599735188-3ba5f42c6681?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
            'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
            'https://images.unsplash.com/photo-1478720568477-b2709d36e4a6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
            'https://images.unsplash.com/photo-1485095329183-d0797cdc5676?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
            'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80',
            'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80'
        ];
        
        // Pilih gambar berdasarkan genre dan index
        let posterUrl = movie.posterUrl;
        
        if (!posterUrl) {
            const genre = movie.genre || 'Default';
            const genreImages = movieImages[genre] || defaultImages;
            // Gunakan modulo untuk memilih gambar berdasarkan index
            posterUrl = genreImages[index % genreImages.length];
        }
        
        // Fallback final jika semua gagal
        const finalFallback = 'https://images.unsplash.com/photo-1489599735188-3ba5f42c6681?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=450&q=80';
        
        const rating = movie.rating ? parseFloat(movie.rating).toFixed(1) : 'N/A';
        const stars = movie.rating ? '★'.repeat(Math.round(movie.rating / 2)) : '';
        
        // FIXED: Use isLoggedIn constant defined above
        const buttonHref = isLoggedIn ? `/movies/${movie.id}` : '#';
        const buttonOnClick = isLoggedIn ? '' : 'onclick="handleLoginRequired(event, \'movie details\')"';
        const buttonClass = isLoggedIn ? 'btn btn-view' : 'btn btn-view btn-login-required';
        
        col.innerHTML = `
            <div class="card movie-card h-100">
                <img src="${posterUrl}" 
                    class="card-img-top movie-poster" 
                    alt="${movie.title}"
                    onerror="this.onerror=null; this.src='${finalFallback}'">
                <div class="card-body">
                    <h5 class="card-title">${movie.title}</h5>
                    <div class="mb-2">
                        <span class="genre-badge">${movie.genre}</span>
                    </div>
                    <p class="card-text text-muted">${movie.description || 'No description available'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-clock me-1"></i>${movie.duration} min
                        </small>
                        <div class="rating-stars">
                            ${stars} <span class="ms-1">${rating}</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <a href="${buttonHref}" class="${buttonClass}" ${buttonOnClick}>
                        <i class="fas fa-eye me-2"></i>
                        ${isLoggedIn ? 'View Details' : 'Login to View Details'}
                    </a>
                </div>
            </div>
        `;
        
        return col;
    }

    // Create cinema card - UPDATED to handle login requirement for details
    function createCinemaCard(cinema, index) {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 mb-4';
        
        const imageUrl = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80';
        
        // FIXED: Use isLoggedIn constant defined above
        const buttonHref = isLoggedIn ? `/cinemas/${cinema.id}` : '#';
        const buttonOnClick = isLoggedIn ? '' : 'onclick="handleLoginRequired(event, \'cinema details\')"';
        const buttonClass = isLoggedIn ? 'btn btn-view' : 'btn btn-view btn-login-required';
        
        col.innerHTML = `
            <div class="card cinema-card h-100">
                <img src="${imageUrl}" class="card-img-top cinema-image" alt="${cinema.name}">
                <div class="card-body">
                    <h5 class="card-title">${cinema.name}</h5>
                    <p class="card-text">
                        <i class="fas fa-map-marker-alt me-2 text-primary"></i>${cinema.city}
                    </p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-users me-1"></i>Capacity: ${cinema.capacity}
                        </small>
                        <div class="rating-stars">
                            ★★★★★ <span class="ms-1">4.5</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <a href="${buttonHref}" class="${buttonClass}" ${buttonOnClick}>
                        <i class="fas fa-building me-2"></i>
                        ${isLoggedIn ? 'View Cinema' : 'Login to View Cinema'}
                    </a>
                </div>
            </div>
        `;
        
        return col;
    }

    console.log('Main page initialized with public/authenticated access support');
});

// Global function to handle login requirement
function handleLoginRequired(event, contentType) {
    event.preventDefault();
    
    AuthService.showMessage(`Please login to access ${contentType}`, 'info');
    
    // Show a modal or redirect to login after a short delay
    setTimeout(() => {
        const confirmLogin = confirm(`You need to login to view ${contentType}. Go to login page now?`);
        if (confirmLogin) {
            window.location.href = '/login';
        }
    }, 1000);
}