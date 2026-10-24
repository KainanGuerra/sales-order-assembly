import { Controller, UseGuards } from '@nestjs/common';
import {
  CatalogServiceControllerMethods,
  type CatalogServiceController,
  type GetProductsRequest,
  type GetProductsResponse,
} from 'contracts/catalog';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import { ProductsService } from '../services/products.service.js';

@Controller()
@CatalogServiceControllerMethods()
@UseGuards(InnerAuthGuard)
export class CatalogGrpcController implements CatalogServiceController {
  constructor(private readonly service: ProductsService) {}

  async getProducts(request: GetProductsRequest): Promise<GetProductsResponse> {
    const { products, unknownProductIds } = await this.service.findQuotes(request.productIds, request.priceTableId);

    return {
      products: products.map((row) => ({
        productId: row.id,
        sku: row.sku,
        ean: row.ean,
        description: row.description,
        active: row.active,
        saleUnit: row.saleUnit,
        packFactor: row.packFactor,
        multipleOnly: row.multipleOnly,
        hasPrice: row.unitPriceCents !== null,
        unitPriceCents: row.unitPriceCents ?? 0,
      })),
      unknownProductIds,
    };
  }
}
