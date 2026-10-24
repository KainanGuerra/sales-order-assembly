import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './config/env.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { PeopleModule } from './modules/people/people.module.js';
import { SeedModule } from './modules/seed/seed.module.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
class ConfigModule {}

@Module({
  imports: [ConfigModule, DatabaseModule, PeopleModule, SeedModule],
  controllers: [HealthController],
})
export class AppModule {}
