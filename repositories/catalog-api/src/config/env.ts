import { z } from 'zod';

// All configuration comes from the environment and is validated at startup, so
// a missing or malformed value fails the boot instead of a later request.
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  GRPC_PORT: z.coerce.number().int().positive().default(50052),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be set, the service cannot start without a database'),
  // Schema the service owns. Tests point this at a separate schema.
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('catalog'),
  // Shared secret the BFF and orders-api send. Never exposed to the browser.
  INNER_AUTH: z.string().min(16, 'INNER_AUTH must be at least 16 characters'),
  // When on: an active product missing from the client's price table is shown
  // disabled with the reason, and an inactive product appears on an exact
  // EAN/SKU match. When off, both are hidden.
  SHOW_UNAVAILABLE_PRODUCTS: z.stringbool().default(true),
  SEED_FILE: z.string().default('/data/seed.json'),
  RABBITMQ_URL: z.string().min(1).default('amqp://rabbitmq:5672'),
  // Deliveries a failing event gets before the broker dead-letters it.
  CONSUMER_MAX_DELIVERIES: z.coerce.number().int().min(1).default(5),
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
