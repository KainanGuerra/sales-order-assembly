import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import { SearchProductsQuerySchema, type SearchProductsQuery } from '../dto/search-products.dto.js';
import { ProductsService } from '../services/products.service.js';

@Controller('products')
@UseGuards(InnerAuthGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // Search by name (fuzzy, accent-insensitive) or by exact EAN/SKU; without
  // text, browse the catalog by name.
  @Get()
  async search(@Query({ schema: SearchProductsQuerySchema }) query: SearchProductsQuery) {
    const { q, ...rest } = query;
    return { items: await (q === undefined ? this.service.browse(rest) : this.service.search({ ...rest, q })) };
  }
}
