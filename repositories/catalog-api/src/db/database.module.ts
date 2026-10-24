import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export const POOL = Symbol('POOL');
export const DB = Symbol('DB');

// <project root>/drizzle, whether running from src/ (tests) or dist/.
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      inject: [ENV],
      useFactory: (env: Env) =>
        // The schema is chosen by the connection's search_path, so the same
        // unqualified tables work in "catalog" and in the test schema.
        new Pool({ connectionString: env.DATABASE_URL, options: `-c search_path=${env.DB_SCHEMA},public` }),
    },
    {
      provide: DB,
      inject: [POOL, ENV],
      // Async on purpose: every consumer waits for the migrations, so nothing
      // queries a schema that is still being created. The migrator records
      // what it applied in a table and only runs the pending migrations.
      useFactory: async (pool: Pool, env: Env): Promise<Database> => {
        const db = drizzle(pool, { schema });
        await migrate(db, { migrationsFolder, migrationsSchema: env.DB_SCHEMA });
        new Logger('Database').log(`Migrations applied on schema "${env.DB_SCHEMA}"`);
        return db;
      },
    },
  ],
  exports: [DB, POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
