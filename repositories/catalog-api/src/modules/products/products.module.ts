import { Module } from '@nestjs/common';
import { CatalogGrpcController } from './controllers/catalog.grpc.controller.js';
import { ProductsController } from './controllers/products.controller.js';
import { ProductsRepository } from './repository/products.repository.js';
import { ProductsService } from './services/products.service.js';

@Module({
  controllers: [ProductsController, CatalogGrpcController],
  providers: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
