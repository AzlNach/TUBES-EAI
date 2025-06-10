USE user_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(128) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER', -- ← Fixed comma here
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- For development only - use plain text passwords
INSERT INTO users (username, email, hashed_password, role) VALUES 
('admin', 'admin@cinema.com', 'admin123', 'ADMIN')
ON DUPLICATE KEY UPDATE 
    username = VALUES(username),
    hashed_password = VALUES(hashed_password),
    role = VALUES(role);

INSERT INTO users (username, email, hashed_password, role) VALUES 
('demo_user', 'demo@cinema.com', 'demo123', 'USER')
ON DUPLICATE KEY UPDATE 
    username = VALUES(username),
    hashed_password = VALUES(hashed_password),
    role = VALUES(role);

    