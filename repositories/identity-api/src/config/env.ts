import { z } from 'zod';

// All configuration comes from the environment and is validated at startup, so
// a missing or malformed value fails the boot instead of a later request.
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  GRPC_PORT: z.coerce.number().int().positive().default(50051),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be set, the service cannot start without a database'),
  // Schema the service owns. Tests point this at a separate schema.
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('identity'),
  // Shared with the BFF and orders-api. Never exposed to the browser.
  INNER_AUTH: z.string().min(16, 'INNER_AUTH must be at least 16 characters'),
  // Used for a client that has no price table of its own. The tables belong to
  // the catalog; identity only knows the id.
  DEFAULT_PRICE_TABLE_ID: z.string().min(1).default('TP01'),
  SEED_FILE: z.string().default('/data/seed.json'),
});

export type Env = z.infer<typeof EnvSchema>;

export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
}
