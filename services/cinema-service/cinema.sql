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

-- Create showtimes table with start_time as VARCHAR for string storage
CREATE TABLE IF NOT EXISTS showtimes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT NOT NULL,
    auditorium_id INT NOT NULL,
    start_time VARCHAR(50) NOT NULL,  -- Changed from DATETIME to VARCHAR
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
(1, 'Theater 1', '{"seats": [{"number": "A1"}, {"number": "A2"}, {"number": "A3"}, {"number": "A4"}, {"number": "A5"}]}'),
(1, 'Theater 2', '{"seats": [{"number": "B1"}, {"number": "B2"}, {"number": "B3"}, {"number": "B4"}, {"number": "B5"}]}'),
(2, 'Theater 1', '{"seats": [{"number": "C1"}, {"number": "C2"}, {"number": "C3"}, {"number": "C4"}, {"number": "C5"}]}'),
(3, 'Theater 1', '{"seats": [{"number": "D1"}, {"number": "D2"}, {"number": "D3"}, {"number": "D4"}, {"number": "D5"}]}'),
(4, 'Theater 1', '{"seats": [{"number": "E1"}, {"number": "E2"}, {"number": "E3"}, {"number": "E4"}, {"number": "E5"}]}');

-- Insert sample showtimes with string format start_time
INSERT INTO showtimes (movie_id, auditorium_id, start_time, price) VALUES
(1, 1, '2024-12-25T10:00:00', 50000.00),
(1, 1, '2024-12-25T13:00:00', 55000.00),
(1, 1, '2024-12-25T16:00:00', 60000.00),
(1, 1, '2024-12-25T19:00:00', 65000.00),
(1, 2, '2024-12-25T11:00:00', 50000.00),
(1, 2, '2024-12-25T14:00:00', 55000.00),
(1, 2, '2024-12-25T17:00:00', 60000.00),
(1, 2, '2024-12-25T20:00:00', 65000.00),
(1, 3, '2024-12-26T10:30:00', 50000.00),
(1, 3, '2024-12-26T13:30:00', 55000.00),
(1, 3, '2024-12-26T16:30:00', 60000.00),
(1, 3, '2024-12-26T19:30:00', 65000.00);