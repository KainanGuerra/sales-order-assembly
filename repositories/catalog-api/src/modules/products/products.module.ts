import { Module } from '@nestjs/common';
import { CatalogGrpcController } from './controllers/catalog.grpc.controller.js';
import { OrderEventsController } from './controllers/order-events.controller.js';
import { ProductsController } from './controllers/products.controller.js';
import { ProductStatsRepository } from './repository/product-stats.repository.js';
import { ProductsRepository } from './repository/products.repository.js';
import { ProductStatsService } from './services/product-stats.service.js';
import { ProductsService } from './services/products.service.js';

@Module({
  controllers: [ProductsController, CatalogGrpcController, OrderEventsController],
  providers: [ProductsService, ProductsRepository, ProductStatsService, ProductStatsRepository],
})
export class ProductsModule {}
