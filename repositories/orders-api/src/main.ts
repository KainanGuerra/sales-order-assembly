import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`orders-api: http ${env.PORT}`);
}

await bootstrap();
