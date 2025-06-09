USE payment_db;

-- Drop and recreate the payments table with new status enum
DROP TABLE IF EXISTS payments;

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    booking_id INT NOT NULL UNIQUE,  -- Ensure one payment per booking
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CREDIT_CARD',
    status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',  -- Only 3 statuses
    payment_proof_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_booking_id (booking_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);