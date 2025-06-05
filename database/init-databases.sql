-- Create all databases for microservices
CREATE DATABASE IF NOT EXISTS user_db;
CREATE DATABASE IF NOT EXISTS movie_db;
CREATE DATABASE IF NOT EXISTS cinema_db;
CREATE DATABASE IF NOT EXISTS booking_db;
CREATE DATABASE IF NOT EXISTS payment_db;
CREATE DATABASE IF NOT EXISTS coupon_db;

-- Create user if not exists and grant permissions
CREATE USER IF NOT EXISTS 'user'@'%' IDENTIFIED BY 'password';

-- Grant permissions to user for all databases
GRANT ALL PRIVILEGES ON user_db.* TO 'user'@'%';
GRANT ALL PRIVILEGES ON movie_db.* TO 'user'@'%';
GRANT ALL PRIVILEGES ON cinema_db.* TO 'user'@'%';
GRANT ALL PRIVILEGES ON booking_db.* TO 'user'@'%';
GRANT ALL PRIVILEGES ON payment_db.* TO 'user'@'%';
GRANT ALL PRIVILEGES ON coupon_db.* TO 'user'@'%';

FLUSH PRIVILEGES;