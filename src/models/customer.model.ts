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
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  label: text('label').notNull(),
  street: text('street').notNull(),
  city: text('city').notNull(),
  area: text('area'),
  isDefault: boolean('is_default').default(false),
});



// 1. Base Customer Registration Schema
export const registerCustomerSchema = z.object({
  phone: z.string().min(10, "Phone required"),
  name: z.string().min(2, "Name required"),
  password: z.string().min(6),
  email: z.string().min(5).email("Invalid email address"),
  avatarUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

// 2. Address Schema
export const createAddressSchema = z.object({
  label: z.string().min(1).default("Home"),
  street: z.string().min(3, "Street is too short"),
  city: z.string().min(2, "City is required"),
  area: z.string().optional(),
  isDefault: z.boolean().optional(),
});


export const updateCustomerSchema = registerCustomerSchema
  .partial()                  
  .omit({ password: true })
  .extend({
    address: createAddressSchema.optional(),
  });


export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;