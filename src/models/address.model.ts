import { pgTable, uuid, text, boolean } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { customers } from './customer.model';

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  label: text('label'),
  street: text('street').notNull(),
  city: text('city').notNull(),
  state: text('state'),
  zipCode: text('zip_code'),
  country: text('country').default('bangladesh'),
  isDefault: boolean('is_default').default(false),
});

export const createAddressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(5),
  city: z.string().min(2),
  state: z.string().optional(),
  zipCode: z.string().regex(/^\d{6}$/),
  country: z.string().default('bangladesh'),
  isDefault: z.boolean().optional(),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;