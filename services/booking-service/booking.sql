USE booking_db;

-- Drop existing tables
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS bookings;

-- Create bookings table with new structure
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    showtime_id INT NOT NULL,
    status ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    total_price DECIMAL(10, 2),
    booking_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_booking_seat (booking_id, seat_number)
);