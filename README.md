# 🛒 E-Commerce Backend API

A robust, type-safe backend API for an e-commerce platform built with Node.js, Express, TypeScript, and Drizzle ORM.

## 🛠 Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL
* **ORM:** Drizzle ORM
* **Authentication:** JWT & Bcrypt
* **Validation:** Zod

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### 1. Prerequisites
* Node.js (v18 or higher)
* PostgreSQL Database

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd ecommerce-backend
npm install
```

3. Environment Configuration
Create a .env file in the root directory:


```bash
PORT=5001
DATABASE_URL=postgres://user:password@localhost:5432/ecommerce_db
JWT_SECRET=your_super_secret_key
```


4. Database Setup
Run the migrations to create tables and seed the initial Admin user:



# 1. Generate and push schema to DB
```bash
npm run migrate
```

# 2. Seed default Admin user

```bash
npm run seed:admin
```


