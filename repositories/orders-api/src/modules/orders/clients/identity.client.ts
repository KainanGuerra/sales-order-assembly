import { Inject, Injectable } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { IDENTITY_SERVICE_NAME, type Client, type IdentityServiceClient, type Seller } from 'contracts/identity';
import { ENV, type Env } from '../../../config/env.js';
import { callUpstream, innerAuthMetadata } from './upstream.js';

export const IDENTITY_PACKAGE = Symbol('IDENTITY_PACKAGE');

// What the order needs from identity; tests replace it with a fake.
export interface IdentityGateway {
  getClient(clientId: string): Promise<Client | null>;
  getSeller(sellerId: string): Promise<Seller | null>;
  // Holds credit for an order about to be saved (atomic in identity). The hold
  // frees itself if the order is never confirmed.
  reserveCredit(clientId: string, orderId: string, amountCents: number): Promise<CreditReservation>;
  releaseCredit(orderId: string): Promise<void>;
}

export interface CreditReservation {
  reserved: boolean;
  availableCents: number;
}
export const IDENTITY_GATEWAY = Symbol('IDENTITY_GATEWAY');

@Injectable()
export class GrpcIdentityClient implements IdentityGateway {
  private readonly service: IdentityServiceClient;

  constructor(
    @Inject(IDENTITY_PACKAGE) client: ClientGrpc,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.service = client.getService<IdentityServiceClient>(IDENTITY_SERVICE_NAME);
  }

  async getClient(clientId: string): Promise<Client | null> {
    const response = await callUpstream(
      'identity-api',
      this.service.getClient({ clientId }, innerAuthMetadata(this.env.INNER_AUTH)),
      this.env.GRPC_TIMEOUT_MS,
    );
    return response?.client ?? null;
  }

  async getSeller(sellerId: string): Promise<Seller | null> {
    const response = await callUpstream(
      'identity-api',
      this.service.getSeller({ sellerId }, innerAuthMetadata(this.env.INNER_AUTH)),
      this.env.GRPC_TIMEOUT_MS,
    );
    return response?.seller ?? null;
  }

  async reserveCredit(clientId: string, orderId: string, amountCents: number): Promise<CreditReservation> {
    const response = await callUpstream(
      'identity-api',
      this.service.reserveCredit({ clientId, orderId, amountCents }, innerAuthMetadata(this.env.INNER_AUTH)),
      this.env.GRPC_TIMEOUT_MS,
    );
    // NOT_FOUND means the client vanished between the two calls; nothing was held.
    return { reserved: response?.reserved ?? false, availableCents: response?.availableCents ?? 0 };
  }

  async releaseCredit(orderId: string): Promise<void> {
    await callUpstream('identity-api', this.service.releaseCredit({ orderId }, innerAuthMetadata(this.env.INNER_AUTH)), this.env.GRPC_TIMEOUT_MS);
  }
}
