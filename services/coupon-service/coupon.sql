USE coupon_db;

CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    discount_percentage DECIMAL(5, 2) NOT NULL,
    valid_until DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    used_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);