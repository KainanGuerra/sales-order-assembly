import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok' };
  }
}
