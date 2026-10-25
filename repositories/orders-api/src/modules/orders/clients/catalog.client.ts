import { Inject, Injectable } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { CATALOG_SERVICE_NAME, type CatalogServiceClient, type ProductQuote } from 'contracts/catalog';
import { ENV, type Env } from '../../../config/env.js';
import { callUpstream, innerAuthMetadata } from './upstream.js';

export const CATALOG_PACKAGE = Symbol('CATALOG_PACKAGE');

// What the order needs from the catalog; tests replace it with a fake.
export interface CatalogGateway {
  getProducts(priceTableId: string, productIds: string[]): Promise<ProductQuote[]>;
}
export const CATALOG_GATEWAY = Symbol('CATALOG_GATEWAY');

@Injectable()
export class GrpcCatalogClient implements CatalogGateway {
  private readonly service: CatalogServiceClient;

  constructor(
    @Inject(CATALOG_PACKAGE) client: ClientGrpc,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.service = client.getService<CatalogServiceClient>(CATALOG_SERVICE_NAME);
  }

  async getProducts(priceTableId: string, productIds: string[]): Promise<ProductQuote[]> {
    if (productIds.length === 0) {
      return [];
    }
    // One call for every line, not one per line.
    const response = await callUpstream(
      'catalog-api',
      this.service.getProducts({ priceTableId, productIds }, innerAuthMetadata(this.env.INNER_AUTH)),
      this.env.GRPC_TIMEOUT_MS,
    );
    return response?.products ?? [];
  }
}
