// src/db/index.ts
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
dotenv.config();

import { admins } from '../models/admin.model';
import { products } from '../models/product.model';
import { customers } from '../models/customer.model';

const connectionString = process.env.DATABASE_URL


const client = postgres(connectionString as string, {
  prepare: false,
});

export const db = drizzle(client, {
  schema: {
    admins,
    products,
    customers
  },
});

        