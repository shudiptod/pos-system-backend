import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN'] as const;
export type UserRole = (typeof ROLES)[number];

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').$type<UserRole>().default('MANAGER').notNull(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(ROLES),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
