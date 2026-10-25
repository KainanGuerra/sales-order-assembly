import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrderSubmittedEvent } from 'contracts';
import { ENV, type Env } from '../../../config/env.js';
import type { Actor } from '../../../shared/actor.js';
import { CATALOG_GATEWAY, type CatalogGateway } from '../clients/catalog.client.js';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../clients/identity.client.js';
import { ORDER_EVENTS_PUBLISHER, type OrderEventsPublisher } from '../clients/order-events.publisher.js';
import {
  calculateOrder,
  type ApprovalReason,
  type CatalogProduct,
  type OrderCalculation,
  type OrderStatus,
} from '../domain/order-rules.js';
import type { CalculateOrderDto, SubmitOrderDto } from '../dto/orders.dto.js';
import type { CalculationView, OrderItemView, OrderView } from '../dto/orders.view.js';
import { OrdersRepository, type OrderWithItems } from '../repository/orders.repository.js';

interface QuotedProduct extends CatalogProduct {
  sku: string;
}

interface Prepared {
  client: { id: string; tradeName: string; priceTableId: string; priceTableFallback: boolean };
  supervisorId: string;
  products: Map<string, QuotedProduct>;
  calculation: OrderCalculation;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    @Inject(IDENTITY_GATEWAY) private readonly identity: IdentityGateway,
    @Inject(CATALOG_GATEWAY) private readonly catalog: CatalogGateway,
    @Inject(ORDER_EVENTS_PUBLISHER) private readonly publisher: OrderEventsPublisher,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // What the order would look like, with every reason it cannot be sent.
  // Nothing is saved.
  async calculate(actor: Actor, dto: CalculateOrderDto): Promise<CalculationView> {
    const { client, calculation } = await this.prepare(actor, dto);
    return { ...calculation, client };
  }

  async submit(actor: Actor, dto: SubmitOrderDto): Promise<OrderView> {
    // The same order id again returns the order that was already saved.
    const existing = await this.repository.findById(dto.orderId);
    if (existing) {
      return this.replay(actor, existing);
    }

    const { client, supervisorId, products, calculation } = await this.prepare(actor, dto);
    if (!calculation.canSubmit) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        code: 'ORDER_NOT_SUBMITTABLE',
        message: 'The order breaks at least one rule and was not sent',
        calculation: { ...calculation, client },
      });
    }

    const inserted = await this.repository.insert(
      {
        id: dto.orderId,
        sellerId: actor.id,
        clientId: client.id,
        priceTableId: client.priceTableId,
        status: calculation.status,
        subtotalCents: calculation.subtotalCents,
        orderDiscountBp: calculation.orderDiscountBp,
        orderDiscountCents: calculation.orderDiscountCents,
        totalCents: calculation.totalCents,
        approvalReasons: calculation.approvalReasons,
      },
      calculation.lines.map((line) => ({
        orderId: dto.orderId,
        productId: line.productId,
        sku: products.get(line.productId)!.sku,
        description: line.description!,
        unit: line.unit,
        quantityInput: line.quantityInput,
        quantityUnits: line.quantityUnits!,
        packFactor: line.packFactor!,
        unitPriceCents: line.unitPriceCents!,
        discountBp: line.discountBp,
        grossCents: line.grossCents!,
        netCents: line.netCents!,
      })),
    );

    const saved = await this.repository.findById(dto.orderId);
    if (!saved) {
      throw new Error(`Order ${dto.orderId} was not found right after being saved`);
    }
    if (!inserted) {
      // Another request with the same id won the race.
      return this.replay(actor, saved);
    }

    await this.publisher.publishSubmitted(this.toSubmittedEvent(saved, supervisorId));
    return toOrderView(saved);
  }

  async getOrder(actor: Actor, orderId: string): Promise<OrderView> {
    const found = await this.repository.findById(orderId);
    // Someone else's order answers like a missing one.
    if (!found || actor.role !== 'SELLER' || found.order.sellerId !== actor.id) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return toOrderView(found);
  }

  private replay(actor: Actor, found: OrderWithItems): OrderView {
    if (actor.role !== 'SELLER' || found.order.sellerId !== actor.id) {
      throw new NotFoundException(`Order ${found.order.id} not found`);
    }
    return toOrderView(found);
  }

  private async prepare(actor: Actor, dto: CalculateOrderDto): Promise<Prepared> {
    if (actor.role !== 'SELLER') {
      throw new ForbiddenException('Only a seller can build an order');
    }

    const client = await this.identity.getClient(dto.clientId);
    // A client of another seller answers like a missing one, so ids cannot be probed.
    if (!client || client.sellerId !== actor.id) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }
    const seller = await this.identity.getSeller(actor.id);
    if (!seller) {
      throw new ForbiddenException('Unknown seller');
    }

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const quotes = await this.catalog.getProducts(client.priceTableId, productIds);
    const products = new Map<string, QuotedProduct>(
      quotes.map((quote) => [
        quote.productId,
        {
          productId: quote.productId,
          sku: quote.sku,
          description: quote.description,
          active: quote.active,
          packFactor: quote.packFactor,
          multipleOnly: quote.multipleOnly,
          hasPrice: quote.hasPrice,
          unitPriceCents: quote.unitPriceCents,
        },
      ]),
    );

    const calculation = calculateOrder(dto, products, {
      sellerDiscountLimitBp: seller.discountLimitBp,
      maxDiscountBp: this.env.MAX_DISCOUNT_BP,
      minimumOrderCents: this.env.MIN_ORDER_CENTS,
    });

    return {
      client: {
        id: client.id,
        tradeName: client.tradeName,
        priceTableId: client.priceTableId,
        priceTableFallback: client.priceTableFallback,
      },
      supervisorId: seller.supervisorId,
      products,
      calculation,
    };
  }

  private toSubmittedEvent({ order, items }: OrderWithItems, supervisorId: string): OrderSubmittedEvent {
    return {
      orderId: order.id,
      clientId: order.clientId,
      sellerId: order.sellerId,
      supervisorId,
      status: order.status as OrderStatus,
      totalCents: order.totalCents,
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantityUnits })),
      submittedAt: order.createdAt.toISOString(),
    };
  }
}

export function toOrderView({ order, items }: OrderWithItems): OrderView {
  return {
    id: order.id,
    status: order.status as OrderStatus,
    sellerId: order.sellerId,
    clientId: order.clientId,
    priceTableId: order.priceTableId,
    subtotalCents: order.subtotalCents,
    orderDiscountBp: order.orderDiscountBp,
    orderDiscountCents: order.orderDiscountCents,
    totalCents: order.totalCents,
    approvalReasons: order.approvalReasons as ApprovalReason[],
    createdAt: order.createdAt.toISOString(),
    items: items.map(
      (item): OrderItemView => ({
        productId: item.productId,
        sku: item.sku,
        description: item.description,
        unit: item.unit as 'UNIT' | 'PACK',
        quantityInput: item.quantityInput,
        quantityUnits: item.quantityUnits,
        packFactor: item.packFactor,
        unitPriceCents: item.unitPriceCents,
        discountBp: item.discountBp,
        grossCents: item.grossCents,
        netCents: item.netCents,
      }),
    ),
  };
}
