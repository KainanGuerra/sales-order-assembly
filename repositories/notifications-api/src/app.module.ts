import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './config/env.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
class ConfigModule {}

@Module({
  imports: [ConfigModule, DatabaseModule, NotificationsModule],
  controllers: [HealthController],
})
export class AppModule {}
