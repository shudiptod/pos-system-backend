import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isBanned: boolean('is_banned').default(false),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  label: text('label'), // Optional in DB
  street: text('street'),
  area: text('area'),
  city: text('city'),
  division: text('division'),
  postalCode: text('postal_code'), // Consistently using postalCode
  isDefault: boolean('is_default').default(false),
});

// --- 1. Base Customer Registration Schema ---
export const registerCustomerSchema = z.object({
  phone: z.string().min(11, "Valid phone number required"),
  name: z.string().min(2, "Name required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().min(5).email("Invalid email address"),
  avatarUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

// --- 2. Address Schema (Aligned with Shipping Component) ---
export const createAddressSchema = z.object({
  label: z.string().optional(), // Label is now optional
  street: z.string().min(3, "Street/House details are required"),
  division: z.string().min(1, "Division is required"),
  city: z.string().min(1, "District/City is required"),
  area: z.string().min(1, "Area/Upazila is required"),
  postalCode: z.string().min(4, "Valid postal code required"),
  isDefault: z.boolean().optional().default(false),
});

// --- 3. Update Customer Profile Schema ---
export const updateCustomerSchema = registerCustomerSchema
  .partial()
  .omit({ password: true })
  .extend({
    address: createAddressSchema.optional(),
  });

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;