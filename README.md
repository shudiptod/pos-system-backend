🛒 E-commerce Backend API
A robust backend API for an e-commerce platform built with Node.js, Express, Drizzle ORM, and PostgreSQL.

🚀 Getting Started
Follow these steps to set up the project locally for development.

1. Prerequisites
Ensure you have the following installed:

Node.js (v18+ recommended)

PostgreSQL database

2. Installation
Clone the repository and install dependencies:

Bash

git clone <repository-url>
cd ecommerce-backend-api
npm install
3. Environment Setup
Create a .env file in the root directory and configure your variables:

Code snippet

PORT=5001
DATABASE_URL=postgres://user:password@localhost:5432/ecommerce_db
JWT_SECRET=your_super_secret_key_here
# Add other keys like SUPABASE_URL if needed
4. Database Setup
Run migrations to create tables and seed the initial admin user:

Bash

# Generate and push schema changes to the database
npm run migrate

# Seed the initial Super Admin user (Check src/db/seed-admin.ts for default credentials)
npm run seed:admin
5. Running the App
Development Mode: Runs with ts-node-dev for hot-reloading.

Bash

npm run dev
Server runs on http://localhost:5001

Production Build: Compiles TypeScript to JavaScript and runs the optimized build.

Bash

npm run build
npm start
📚 API Documentation
👤 Customer Authentication & Profile
Base URL: /api/auth (or /api/customers depending on your route prefix)

1. Register Customer
Create a new customer account.

Endpoint: POST /register

Public

Request Body:

JSON

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "01700000000",
  "password": "securepassword123"
}
Response (201 Created):

JSON

{
  "success": true,
  "message": "User registered successfully!",
  "user": { "id": "uuid...", "email": "..." }
}
2. Login Customer
Authenticate a user to receive a Bearer token.

Endpoint: POST /login

Public

Request Body:

JSON

{
  "email": "john@example.com",
  "password": "securepassword123"
}
Response (200 OK):

JSON

{
  "success": true,
  "token": "eyJhbGciOiJIUzI...", 
  "user": { "id": "uuid...", "email": "..." }
}
⚠️ Note: Copy the token for subsequent requests.

3. Update Profile & Add Address
Update personal info or add a shipping address in a single request.

Endpoint: PATCH /update

Auth Required: Yes (Bearer Token)

Headers: Authorization: Bearer <YOUR_TOKEN>

Request Body (All fields optional):

JSON

{
  "name": "John Updated",
  "phone": "01900000000",
  "address": {
    "label": "Home",
    "street": "123 Main Street",
    "city": "Dhaka",
    "area": "Gulshan 1",
    "isDefault": true
  }
}
Response (200 OK):

JSON

{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { ... },
    "address": { ... }
  }
}
4. Get Full Profile
Retrieve customer details along with all saved addresses.

Endpoint: GET /profile

Auth Required: Yes (Bearer Token)

Headers: Authorization: Bearer <YOUR_TOKEN>

Response (200 OK):

JSON

{
  "success": true,
  "data": {
    "id": "uuid...",
    "name": "John Doe",
    "email": "john@example.com",
    "addresses": [
      {
        "id": "addr-uuid...",
        "label": "Home",
        "street": "123 Main St",
        "city": "Dhaka",
        "isDefault": true
      }
    ]
  }
}
