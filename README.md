# Cinema Microservices Project

This project is designed to implement a microservices architecture for a cinema system. The system consists of several independent services that communicate with each other using GraphQL as the API layer. Each service is containerized using Docker, and MySQL is used as the database for data storage.

## Project Structure

The project is organized into the following main components:

- **services/**: Contains all the microservices for the cinema system.
  - **user-service/**: Manages user accounts and authentication.
  - **cinema-service/**: Manages cinema information.
  - **movie-service/**: Manages movie details.
  - **booking-service/**: Handles ticket bookings.
  - **payment-service/**: Manages payment processing.
  - **coupon-service/**: Manages discount coupons.

- **gateway/**: Acts as the API gateway, routing requests to the appropriate microservices.

- **database/**: Contains SQL scripts for initializing the MySQL database.

- **docker-compose.yml**: Defines the services and orchestrates the deployment of all microservices and the API gateway.

## Features

### User Service
- **Admin Features**: CRUD operations for managing user data.
- **User Features**: Registration, login, and profile viewing.

### Cinema Service
- **Admin Features**: CRUD operations for managing cinema data.
- **User Features**: Viewing a list of cinemas.

### Movie Service
- **Admin Features**: CRUD operations for managing movie data.
- **User Features**: Viewing a list of movies.

### Booking Service
- **Admin Features**: Viewing a list of bookings.
- **User Features**: CRUD operations for ticket bookings.

### Payment Service
- **Admin Features**: Viewing payment records and updating payment statuses.
- **User Features**: CRUD operations for payments.

### Coupon Service
- **Admin Features**: CRUD operations for managing coupon data.
- **User Features**: Viewing available coupons.

## Technology Stack
- **Programming Language**: Python
- **Frameworks**: Flask, FastAPI, or Django (to be determined based on service requirements)
- **Database**: MySQL
- **API Layer**: GraphQL
- **Containerization**: Docker

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd cinema-microservices
   ```

2. Build and run the services using Docker Compose:
   ```
   docker-compose up --build
   ```

3. Access the API gateway at `http://localhost:<gateway-port>`.

## Testing

Each service should have its own set of unit and integration tests to ensure functionality. Testing strategies should be defined for both individual services and the overall system integration.

## Documentation

Further documentation for each service, including API endpoints and usage examples, will be provided in the respective service directories.

## Assumptions

- Each service will have its own database schema, but they may share a common MySQL instance.
- Authentication and authorization mechanisms will be implemented to secure the services.

This README provides an overview of the cinema microservices project and serves as a guide for developers and contributors.