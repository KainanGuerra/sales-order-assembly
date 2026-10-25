import { status } from '@grpc/grpc-js';
import { Controller, UseGuards } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  IdentityServiceControllerMethods,
  type GetClientRequest,
  type GetClientResponse,
  type GetSellerRequest,
  type GetSellerResponse,
  type IdentityServiceController,
  type ReleaseCreditRequest,
  type ReleaseCreditResponse,
  type ReserveCreditRequest,
  type ReserveCreditResponse,
} from 'contracts/identity';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import { PeopleService } from '../services/people.service.js';

@Controller()
@IdentityServiceControllerMethods()
@UseGuards(InnerAuthGuard)
export class IdentityGrpcController implements IdentityServiceController {
  constructor(private readonly service: PeopleService) {}

  async getClient(request: GetClientRequest): Promise<GetClientResponse> {
    const client = await this.service.findClient(request.clientId);
    if (!client) {
      throw new RpcException({ code: status.NOT_FOUND, message: `Client ${request.clientId} not found` });
    }
    return {
      client: {
        id: client.id,
        tradeName: client.tradeName,
        sellerId: client.sellerId,
        priceTableId: client.priceTableId,
        priceTableFallback: client.priceTableFallback,
        creditLimitCents: client.creditLimitCents,
        creditUsedCents: client.creditUsedCents,
      },
    };
  }

  async getSeller(request: GetSellerRequest): Promise<GetSellerResponse> {
    const seller = await this.service.findSeller(request.sellerId);
    if (!seller) {
      throw new RpcException({ code: status.NOT_FOUND, message: `Seller ${request.sellerId} not found` });
    }
    return {
      seller: {
        id: seller.id,
        name: seller.name,
        supervisorId: seller.supervisorId,
        discountLimitBp: seller.discountLimitBp,
      },
    };
  }

  async reserveCredit(request: ReserveCreditRequest): Promise<ReserveCreditResponse> {
    // Shape errors are the caller's bug, not a business answer.
    if (!isUuid(request.orderId) || !Number.isInteger(request.amountCents) || request.amountCents <= 0) {
      throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'orderId must be a UUID and amountCents a positive integer' });
    }
    const result = await this.service.reserveCredit(request.clientId, request.orderId, request.amountCents);
    if (!result) {
      throw new RpcException({ code: status.NOT_FOUND, message: `Client ${request.clientId} not found` });
    }
    return { reserved: result.reserved, availableCents: result.availableCents };
  }

  async releaseCredit(request: ReleaseCreditRequest): Promise<ReleaseCreditResponse> {
    if (!isUuid(request.orderId)) {
      throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'orderId must be a UUID' });
    }
    await this.service.releaseCredit(request.orderId);
    return {};
  }
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
