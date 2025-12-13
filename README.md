# 🛒 E-Commerce Backend API

A robust, type-safe backend API for an e-commerce platform built with **Node.js**, **Express**, **TypeScript**, and **Drizzle ORM**.

---

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

---

## 1️⃣ Prerequisites

* Node.js (**v18 or higher**)
* PostgreSQL Database

---

## 2️⃣ Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd ecommerce-backend-api
npm install
```

---

## 3️⃣ Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=5001
DATABASE_URL=postgres://user:password@localhost:5432/ecommerce_db
JWT_SECRET=your_super_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 4️⃣ Database Setup

Run the migrations to create tables and seed the initial **Admin** user.

### Step 1: Push Schema to Database

```bash
npm run migrate
```

### Step 2: Seed Super Admin

You must provide an email and password as arguments:

```bash
# Usage: npm run seed:admin -- <email> <password>
npm run seed:admin -- admin@store.com admin123
```

---

## 5️⃣ Running the Application

### Development Mode (Hot Reload)

```bash
npm run dev
```

Server runs at:

```
http://localhost:5001
```

### Production Build

```bash
npm run build
npm start
```

---

## 📚 API Documentation

### 👤 Customer Authentication & Profile

**Base URL:** `/api/customers`

| Method | Endpoint    | Description                           | Auth Required  |
| ------ | ----------- | ------------------------------------- | -------------- |
| POST   | `/register` | Register a new customer               | ❌ No           |
| POST   | `/login`    | Login and receive a JWT token         | ❌ No           |
| PATCH  | `/update`   | Update profile info or add an address | ✅ Yes (Bearer) |

---

## 🔍 Endpoint Examples (cURL)

### 1️⃣ Register Customer

**POST** `/register`

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "01700000000",
    "password": "password123"
  }'
```

---

### 2️⃣ Login Customer

**POST** `/login`

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

> **Note:** Copy the token from the response to use in the requests below.

---

### 3️⃣ Update Profile & Add Address

**PATCH** `/update`

```bash
curl -X PATCH http://localhost:5001/api/auth/update \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "phone": "01900000000",
    "address": {
      "label": "Work",
      "street": "123 Tech Park",
      "city": "Dhaka",
      "isDefault": true
    }
  }'
```

---



## 📜 NPM Scripts

```bash
npm run dev          # Runs the server in development mode
npm run build        # Compiles TypeScript to JavaScript
npm start            # Runs the compiled JavaScript code
npm run migrate      # Pushes schema changes to the database
npm run seed:admin   # Creates the initial admin account (requires args)
```

---

## ✅ Notes

* Ensure PostgreSQL is running before starting the server
* Always keep `.env` out of version control
* Use **Bearer Token** authentication for protected routes



### 🛍️ Products & Categories

**Base URL:** `/api/products`

| Method  | Endpoint        | Description                            | Auth Required |
| :------ | :-------------- | :------------------------------------- | :------------ |
| `POST`  | `/categories`   | Create a new category                  | ✅ Yes (Admin) |
| `GET`   | `/categories`   | Get all categories                     | ❌ No          |
| `POST`  | `/`             | Create a new product with variants     | ✅ Yes (Admin) |
| `GET`   | `/`             | List products (Filter, Sort, Paginate) | ❌ No          |
| `GET`   | `/:id`          | Get single product details             | ❌ No          |
| `PATCH` | `/variants/:id` | Update a specific product variant      | ✅ Yes (Admin) |

---

## 🔍 Endpoint Examples (cURL)

### 1️⃣ Create Category (Admin)

**POST** `/categories`

```bash
curl -X POST http://localhost:5001/api/products/categories \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Men",
    "slug": "men-fashion",
    "imagePath": "https://example.com/men.jpg"
  }'
```

---

### 2️⃣ Get All Categories

**GET** `/categories`

```bash
curl "http://localhost:5001/api/products/categories"
```

---

### 3️⃣ Create Product (Admin)

**POST** `/`

Creates a product and its initial variants in one transaction.

```bash
curl -X POST http://localhost:5001/api/products \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Premium Cotton T-Shirt",
    "description": "High quality cotton",
    "categoryId": "YOUR_CATEGORY_UUID",
    "slug": "premium-cotton-t-shirt",
    "basePrice": 1500,
    "images": ["https://example.com/tshirt.jpg"],
    "isPublished": true,
    "variants": [
      {
        "title": "Blue / M",
        "sku": "TSH-BL-M",
        "price": 1500,
        "stock": 100,
        "options": { "color": "Blue", "size": "M" }
      }
    ]
  }'
```

---

### 4️⃣ Get All Products (Public)

**GET** `/`

Supports pagination, sorting, and filtering.

```bash
# Example: Page 1, Sort by Price Low-High, Search "Shirt"
curl "http://localhost:5001/api/products?page=1&limit=10&sort=price_asc&search=shirt"
```

---

### 5️⃣ Get Single Product

**GET** `/:id`

```bash
curl "http://localhost:5001/api/products/YOUR_PRODUCT_UUID"
```

---

### 6️⃣ Update Variant (Admin)

**PATCH** `/variants/:id`

```bash
curl -X PATCH http://localhost:5001/api/products/variants/YOUR_VARIANT_UUID \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 1400,
    "stock": 95
  }'
```

