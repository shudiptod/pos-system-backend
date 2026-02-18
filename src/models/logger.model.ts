import { pgTable, serial, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const appLogs = pgTable('app_logs', {
    id: serial('id').primaryKey(),
    level: text('level').notNull(), // 'info', 'error', 'warn'
    message: text('message').notNull(),
    // JSONB is perfect for storing variable e-commerce data like { "orderId": "123" }
    context: jsonb('context').$type<{
        orderId?: string;
        userId?: string;
        path?: string;
        error?: any
    }>(),
    sourceFile: text('source_file'), // e.g., 'gajitto-2026-02-18.log'
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
    return {
        // Adding indexes makes your searches in the Supabase Dashboard much faster
        levelIdx: index('level_idx').on(table.level),
        createdAtIdx: index('created_at_idx').on(table.createdAt),
    };
});

// Types for your application
export type Log = typeof appLogs.$inferSelect;
export type NewLog = typeof appLogs.$inferInsert;