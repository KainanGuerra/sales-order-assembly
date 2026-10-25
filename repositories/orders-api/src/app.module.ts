import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './config/env.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { OrdersModule } from './modules/orders/orders.module.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
class ConfigModule {}

@Module({
  imports: [ConfigModule, DatabaseModule, OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}
