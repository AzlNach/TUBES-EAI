CREATE DATABASE IF NOT EXISTS booking_db;

USE booking_db;

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    cinema_id INT NOT NULL,
    showtime VARCHAR(50) NOT NULL,
    seats TEXT,
    total_price DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'PENDING',
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);