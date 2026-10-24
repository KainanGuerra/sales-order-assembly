import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { CATALOG_PROTO_PATH } from 'contracts';
import { SALES_CATALOG_V1_PACKAGE_NAME } from 'contracts/catalog';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

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

  await app.startAllMicroservices();
  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`catalog-api: http ${env.PORT}, grpc ${env.GRPC_PORT}`);
}

await bootstrap();
