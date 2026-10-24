import { defineConfig } from 'drizzle-kit';

// Used only to generate migrations (no database connection needed):
//   pnpm db:generate
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
