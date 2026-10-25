import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { CATALOG_PROTO_PATH } from 'contracts';
import { SALES_CATALOG_V1_PACKAGE_NAME } from 'contracts/catalog';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { assertDeadLetterTopology, DEAD_LETTER_EXCHANGE } from './shared/messaging/topology.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // Same process, two doors: HTTP for the BFF, gRPC for orders-api.
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: SALES_CATALOG_V1_PACKAGE_NAME,
      protoPath: CATALOG_PROTO_PATH,
      url: `0.0.0.0:${env.GRPC_PORT}`,
    },
  });

  // Orders' events on a queue of our own: quorum, with a delivery limit, so a
  // message that keeps failing is dead-lettered instead of looping forever.
  const queue = 'catalog-api-order-events';
  await assertDeadLetterTopology(env.RABBITMQ_URL, queue);
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [env.RABBITMQ_URL],
      queue,
      exchange: 'orders.events',
      exchangeType: 'topic',
      wildcards: true,
      noAck: false,
      prefetchCount: 1,
      queueOptions: {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-delivery-limit': env.CONSUMER_MAX_DELIVERIES,
          'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
          'x-dead-letter-routing-key': queue,
          'x-dead-letter-strategy': 'at-least-once',
          overflow: 'reject-publish',
        },
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`catalog-api: http ${env.PORT}, grpc ${env.GRPC_PORT}`);
}

await bootstrap();
