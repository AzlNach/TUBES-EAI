CREATE DATABASE IF NOT EXISTS user_db;

USE user_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO users (username, email, hashed_password) VALUES 
('admin', 'admin@cinema.com', 'pbkdf2:sha256:260000$abc123$hash_here'),
('john_doe', 'john@email.com', 'pbkdf2:sha256:260000$def456$hash_here')
ON DUPLICATE KEY UPDATE username=username;