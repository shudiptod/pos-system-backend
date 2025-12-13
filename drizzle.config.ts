import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in .env file or dotenv is not working');
}

console.log('Loaded DATABASE_URL:', process.env.DATABASE_URL);

export default defineConfig({
  out: './drizzle',
  schema: './src/models/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});