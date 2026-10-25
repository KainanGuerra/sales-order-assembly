import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// All configuration comes from the environment and is validated at startup, so
// a missing or malformed value fails the boot instead of a later request.
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3003),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be set, the service cannot start without a database'),
  // Schema the service owns. Tests point this at a separate schema.
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('orders'),
  // Shared with the BFF; sent to catalog and identity on every call. Never exposed to a browser.
  INNER_AUTH: z.string().min(16, 'INNER_AUTH must be at least 16 characters'),
  CATALOG_GRPC_URL: z.string().min(1).default('catalog-api:50052'),
  IDENTITY_GRPC_URL: z.string().min(1).default('identity-api:50051'),
  // Deadline for every gRPC call; a slower answer is treated as "unavailable".
  GRPC_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  RABBITMQ_URL: z.string().min(1).default('amqp://rabbitmq:5672'),
  // The slice of the sample data this service imports at start: next to the code, in
  // the image too (the same trick as the migrations folder).
  SEED_FILE: z.string().default(fileURLToPath(new URL('../../seed/seed.json', import.meta.url))),
  // Price table of a client that has none of its own (used for imported orders).
  DEFAULT_PRICE_TABLE_ID: z.string().min(1).default('TP01'),
  // Orders below this net total cannot be sent (R$ 300.00).
  MIN_ORDER_CENTS: z.coerce.number().int().nonnegative().default(30_000),
  // Global ceiling on the discount a seller may give without approval, in basis
  // points. The effective limit is the smaller of this and the seller's own.
  MAX_DISCOUNT_BP: z.coerce.number().int().min(0).max(10_000).default(1_000),
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
