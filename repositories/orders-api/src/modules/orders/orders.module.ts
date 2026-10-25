import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CATALOG_PROTO_PATH, IDENTITY_PROTO_PATH } from 'contracts';
import { SALES_CATALOG_V1_PACKAGE_NAME } from 'contracts/catalog';
import { SALES_IDENTITY_V1_PACKAGE_NAME } from 'contracts/identity';
import { ENV, type Env } from '../../config/env.js';
import { CATALOG_GATEWAY, CATALOG_PACKAGE, GrpcCatalogClient } from './clients/catalog.client.js';
import { IDENTITY_GATEWAY, IDENTITY_PACKAGE, GrpcIdentityClient } from './clients/identity.client.js';
import {
  ORDER_EVENTS_PUBLISHER,
  RABBITMQ_CLIENT,
  RabbitOrderEventsPublisher,
} from './clients/order-events.publisher.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersRepository } from './repository/orders.repository.js';
import { OrdersService } from './services/orders.service.js';

// Exchange the order events are published to. Each consumer binds its own,
// explicitly named queue to it (<service>-api-<event>).
export const ORDER_EVENTS_EXCHANGE = 'orders.events';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: CATALOG_PACKAGE,
        inject: [ENV],
        useFactory: (env: Env) => ({
          transport: Transport.GRPC,
          options: { package: SALES_CATALOG_V1_PACKAGE_NAME, protoPath: CATALOG_PROTO_PATH, url: env.CATALOG_GRPC_URL },
        }),
      },
      {
        name: IDENTITY_PACKAGE,
        inject: [ENV],
        useFactory: (env: Env) => ({
          transport: Transport.GRPC,
          options: { package: SALES_IDENTITY_V1_PACKAGE_NAME, protoPath: IDENTITY_PROTO_PATH, url: env.IDENTITY_GRPC_URL },
        }),
      },
      {
        name: RABBITMQ_CLIENT,
        inject: [ENV],
        useFactory: (env: Env) => ({
          transport: Transport.RMQ,
          options: {
            urls: [env.RABBITMQ_URL],
            exchange: ORDER_EVENTS_EXCHANGE,
            exchangeType: 'topic',
            wildcards: true,
            queue: 'orders-api-publisher',
            persistent: true,
          },
        }),
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    { provide: CATALOG_GATEWAY, useClass: GrpcCatalogClient },
    { provide: IDENTITY_GATEWAY, useClass: GrpcIdentityClient },
    { provide: ORDER_EVENTS_PUBLISHER, useClass: RabbitOrderEventsPublisher },
  ],
})
export class OrdersModule {}
