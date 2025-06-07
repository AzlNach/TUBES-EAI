USE cinema_db;

-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS seat_statuses;
DROP TABLE IF EXISTS showtimes;
DROP TABLE IF EXISTS auditoriums;
DROP TABLE IF EXISTS cinemas;

-- Create cinemas table
CREATE TABLE IF NOT EXISTS cinemas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 100
);

-- Create auditoriums table
CREATE TABLE IF NOT EXISTS auditoriums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cinema_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    seat_layout JSON,
    FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
);

-- Create showtimes table
CREATE TABLE IF NOT EXISTS showtimes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT NOT NULL,
    auditorium_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (auditorium_id) REFERENCES auditoriums(id) ON DELETE CASCADE
);

-- Create seat_statuses table
CREATE TABLE IF NOT EXISTS seat_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    showtime_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    status ENUM('AVAILABLE', 'BOOKED', 'RESERVED') NOT NULL DEFAULT 'AVAILABLE',
    booking_id INT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_seat_showtime (showtime_id, seat_number)
);

-- Insert sample data
INSERT INTO cinemas (name, city, capacity) VALUES
('Cinema XXI Grand Mall', 'Jakarta Selatan', 150),
('Cinema XXI Plaza Indonesia', 'Jakarta Pusat', 200),
('Cinepolis Lippo Mall', 'Jakarta Barat', 180),
('CGV Blitz Grand Indonesia', 'Jakarta Pusat', 220),
('Cinema XXI Kelapa Gading', 'Jakarta Utara', 160);

-- Insert sample auditoriums
INSERT INTO auditoriums (cinema_id, name, seat_layout) VALUES
(1, 'Theater 1', '{"seats": [{"number": "A1"}, {"number": "A2"}, {"number": "A3"}]}'),
(1, 'Theater 2', '{"seats": [{"number": "A1"}, {"number": "A2"}, {"number": "A3"}]}'),
(2, 'Theater 1', '{"seats": [{"number": "A1"}, {"number": "A2"}, {"number": "A3"}]}');