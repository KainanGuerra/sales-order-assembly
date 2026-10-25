import { z } from 'zod';

// All configuration comes from the environment and is validated at startup, so
// a missing or malformed value fails the boot instead of a later request.
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3004),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be set, the service cannot start without a database'),
  // Schema the service owns. Tests point this at a separate schema.
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('notifications'),
  // Shared with the BFF. Never exposed to a browser.
  INNER_AUTH: z.string().min(16, 'INNER_AUTH must be at least 16 characters'),
  RABBITMQ_URL: z.string().min(1).default('amqp://rabbitmq:5672'),
  // Redeliveries of one failing event before the broker dead-letters it. The
  // broker counts redeliveries, so the number of attempts is this plus one.
  CONSUMER_MAX_DELIVERIES: z.coerce.number().int().min(1).default(5),
  // A quiet stream is kept open by a ping this often, so proxies do not close it.
  STREAM_HEARTBEAT_SECONDS: z.coerce.number().int().positive().default(25),
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
