import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrderPlacedEvent, OrderSubmittedEvent, RejectionReasonCode } from 'contracts';
import { ENV, type Env } from '../../../config/env.js';
import type { Actor } from '../../../shared/actor.js';
import { CATALOG_GATEWAY, type CatalogGateway } from '../clients/catalog.client.js';
import { IDENTITY_GATEWAY, type IdentityGateway } from '../clients/identity.client.js';
import { ORDER_EVENTS_PUBLISHER, type OrderEventsPublisher } from '../clients/order-events.publisher.js';
import {
  calculateOrder,
  type ApprovalReason,
  type CatalogProduct,
  type InitialOrderStatus,
  type OrderCalculation,
} from '../domain/order-rules.js';
import { decideApprove, decideReject, type OrderStatus } from '../domain/order-status.js';
import type { CalculateOrderDto, RejectOrderDto, SubmitOrderDto } from '../dto/orders.dto.js';
import { buildRepeatDraft, type CurrentProduct } from '../domain/repeat-order.js';
import type {
  CalculationView,
  HistoryStepView,
  OrderItemView,
  OrderSummaryView,
  OrderView,
  PendingOrderView,
  RepeatDraftView,
} from '../dto/orders.view.js';
import { OrdersRepository, type OrderRow, type OrderWithItems } from '../repository/orders.repository.js';

interface QuotedProduct extends CatalogProduct {
  sku: string;
}

interface Prepared {
  client: { id: string; tradeName: string; priceTableId: string; priceTableFallback: boolean };
  sellerName: string;
  supervisorId: string;
  products: Map<string, QuotedProduct>;
  calculation: OrderCalculation;
}

const PENDING_LIST_LIMIT = 100;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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

    const { client, sellerName, supervisorId, products, calculation } = await this.prepare(actor, dto);
    if (!calculation.canSubmit) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        code: 'ORDER_NOT_SUBMITTABLE',
        message: 'The order breaks at least one rule and was not sent',
        calculation: { ...calculation, client },
      });
    }

    // Hold the credit before saving, in one atomic step in identity. The check
    // in calculate was advisory; this is the one that two orders sent together
    // cannot both pass. The order id is the key, so a retry holds nothing extra.
    if (calculation.totalCents > 0) {
      const reservation = await this.identity.reserveCredit(client.id, dto.orderId, calculation.totalCents);
      if (!reservation.reserved) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'ORDER_NOT_SUBMITTABLE',
          message: 'The order does not fit in the credit available',
          calculation: {
            ...calculation,
            blockers: [...calculation.blockers, 'CREDIT_EXCEEDED'],
            availableCreditCents: reservation.availableCents,
            canSubmit: false,
            client,
          },
        });
      }
    }

    const inserted = await this.saveOrReleaseCredit(dto.orderId, () =>
      this.repository.insert(
        {
          id: dto.orderId,
          sellerId: actor.id,
          sellerName,
          supervisorId,
          clientId: client.id,
          clientTradeName: client.tradeName,
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
        { status: calculation.status, actor: `user:${actor.id}` },
      ),
    );

    const saved = await this.repository.findById(dto.orderId);
    if (!saved) {
      throw new Error(`Order ${dto.orderId} was not found right after being saved`);
    }
    if (!inserted) {
      // Another request with the same id won the race.
      return this.replay(actor, saved);
    }

    await this.publisher.publishPlaced(placedEvent(saved));
    // An order within the limit is sent straight away.
    if (saved.order.status === 'SUBMITTED') {
      await this.publisher.publishSubmitted(submittedEvent(saved, saved.order.createdAt));
    }
    return toOrderView(saved);
  }

  // The seller who sent the order, or the supervisor who has to decide on it.
  // Anyone else gets the answer for a missing order.
  async getOrder(actor: Actor, orderId: string): Promise<OrderView> {
    const found = await this.repository.findById(orderId);
    if (!found || !canSee(actor, found.order)) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return toOrderView(found);
  }

  // The latest orders a seller made for one client, newest first. Orders of
  // someone else are never in it.
  async listClientOrders(actor: Actor, clientId: string, limit: number): Promise<OrderSummaryView[]> {
    if (actor.role !== 'SELLER') {
      throw new ForbiddenException('Only a seller has a client history');
    }
    const rows = await this.repository.listByClient(actor.id, clientId, limit);
    const counts = await this.repository.itemCounts(rows.map((row) => row.id));
    return rows.map((row) => ({
      id: row.id,
      status: row.status as OrderStatus,
      origin: row.origin as 'SYSTEM' | 'IMPORTED',
      totalCents: row.totalCents,
      itemCount: counts.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // A draft that repeats an old order: the same products, quantities and units,
  // ordered from today's catalog and the client's current price table. A product
  // that cannot be ordered any more is left out and reported. Discounts start at
  // zero. Nothing is saved.
  async repeatDraft(actor: Actor, orderId: string): Promise<RepeatDraftView> {
    if (actor.role !== 'SELLER') {
      throw new ForbiddenException('Only a seller can repeat an order');
    }
    const found = await this.repository.findById(orderId);
    if (!found || found.order.sellerId !== actor.id) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    // The client may have moved to another seller since: then it is not theirs to order for.
    const client = await this.identity.getClient(found.order.clientId);
    if (!client || client.sellerId !== actor.id) {
      throw new NotFoundException(`Client ${found.order.clientId} not found`);
    }

    const quotes = await this.catalog.getProducts(client.priceTableId, [...new Set(found.items.map((item) => item.productId))]);
    const current = new Map<string, CurrentProduct>(
      quotes.map((quote) => [
        quote.productId,
        {
          productId: quote.productId,
          sku: quote.sku,
          description: quote.description,
          active: quote.active,
          hasPrice: quote.hasPrice,
          packFactor: quote.packFactor,
          multipleOnly: quote.multipleOnly,
        },
      ]),
    );
    const { items, skipped } = buildRepeatDraft(
      found.items.map((item) => ({
        productId: item.productId,
        description: item.description,
        unit: item.unit as 'UNIT' | 'PACK',
        quantityInput: item.quantityInput,
      })),
      current,
    );
    return { sourceOrderId: orderId, clientId: client.id, items, skipped };
  }

  async pendingApprovals(actor: Actor): Promise<PendingOrderView[]> {
    if (actor.role !== 'SUPERVISOR') {
      throw new ForbiddenException('Only a supervisor has orders to approve');
    }
    const rows = await this.repository.listPendingApproval(actor.id, PENDING_LIST_LIMIT);
    return rows.map((row) => ({
      id: row.id,
      sellerName: row.sellerName,
      clientTradeName: row.clientTradeName,
      totalCents: row.totalCents,
      approvalReasons: row.approvalReasons as ApprovalReason[],
      createdAt: row.createdAt.toISOString(),
      status: row.status as OrderStatus,
    }));
  }

  // Approving moves the order to APPROVED and then SUBMITTED in one step. The
  // credit held for it stays held. Approving twice is a repeat, not an error.
  async approve(actor: Actor, orderId: string): Promise<OrderView> {
    let found = await this.requireOfSupervisor(actor, orderId);

    // A second pass only happens if another decision landed in between.
    for (let attempt = 0; attempt < 2; attempt++) {
      const decision = decideApprove(
        found.order.status as OrderStatus,
        found.history.some((step) => step.status === 'APPROVED'),
      );
      if (decision.kind === 'already') {
        return toOrderView(found);
      }
      if (decision.kind === 'refused') {
        throw new ConflictException({ code: decision.reason, message: `The order cannot be approved: ${decision.reason}` });
      }

      if (await this.repository.applyApproval(orderId, actor.id)) {
        const done = (await this.repository.findById(orderId))!;
        const approvedAt = done.history.find((step) => step.status === 'APPROVED')!.createdAt;
        await this.publisher.publishApproved({ orderId, approvedBy: actor.id, approvedAt: approvedAt.toISOString() });
        await this.publisher.publishSubmitted(submittedEvent(done, done.history.at(-1)!.createdAt));
        return toOrderView(done);
      }
      found = (await this.repository.findById(orderId))!;
    }
    throw new ConflictException({ code: 'ORDER_CHANGED', message: 'The order changed while it was being approved' });
  }

  // Rejecting is final. The credit goes back at once (and the event makes sure of it).
  async reject(actor: Actor, orderId: string, dto: RejectOrderDto): Promise<OrderView> {
    let found = await this.requireOfSupervisor(actor, orderId);

    for (let attempt = 0; attempt < 2; attempt++) {
      const decision = decideReject(
        found.order.status as OrderStatus,
        found.history.some((step) => step.status === 'REJECTED'),
      );
      if (decision.kind === 'already') {
        return toOrderView(found);
      }
      if (decision.kind === 'refused') {
        throw new ConflictException({ code: decision.reason, message: `The order cannot be rejected: ${decision.reason}` });
      }

      const reason = { code: dto.reasonCode, text: dto.reasonText?.trim() || null };
      if (await this.repository.applyRejection(orderId, actor.id, reason)) {
        const done = (await this.repository.findById(orderId))!;
        // Best effort: if this call fails, the OrderRejected consumer releases the credit.
        await this.identity.releaseCredit(orderId).catch((error) => {
          this.logger.error(`Could not release the credit of rejected order ${orderId}; the event will`, error as Error);
        });
        await this.publisher.publishRejected({
          orderId,
          rejectedBy: actor.id,
          reasonCode: dto.reasonCode,
          ...(reason.text ? { reasonText: reason.text } : {}),
          rejectedAt: done.history.find((step) => step.status === 'REJECTED')!.createdAt.toISOString(),
        });
        return toOrderView(done);
      }
      found = (await this.repository.findById(orderId))!;
    }
    throw new ConflictException({ code: 'ORDER_CHANGED', message: 'The order changed while it was being rejected' });
  }

  private async requireOfSupervisor(actor: Actor, orderId: string): Promise<OrderWithItems> {
    if (actor.role !== 'SUPERVISOR') {
      throw new ForbiddenException('Only a supervisor can approve or reject an order');
    }
    const found = await this.repository.findById(orderId);
    // Another team's order answers like a missing one.
    if (!found || found.order.supervisorId !== actor.id) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return found;
  }

  // If the order cannot be saved, the credit held for it goes back at once
  // instead of waiting for the hold to expire.
  private async saveOrReleaseCredit<T>(orderId: string, save: () => Promise<T>): Promise<T> {
    try {
      return await save();
    } catch (error) {
      await this.identity.releaseCredit(orderId).catch((releaseError) => {
        this.logger.error(`Could not release the credit held for order ${orderId}; it will lapse by itself`, releaseError as Error);
      });
      throw error;
    }
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
      availableCreditCents: Math.max(0, client.creditLimitCents - client.creditUsedCents),
    });

    return {
      client: {
        id: client.id,
        tradeName: client.tradeName,
        priceTableId: client.priceTableId,
        priceTableFallback: client.priceTableFallback,
      },
      sellerName: seller.name,
      supervisorId: seller.supervisorId,
      products,
      calculation,
    };
  }
}

function canSee(actor: Actor, order: OrderRow): boolean {
  return actor.role === 'SELLER' ? order.sellerId === actor.id : order.supervisorId === actor.id;
}

function placedEvent({ order, items }: OrderWithItems): OrderPlacedEvent {
  return {
    orderId: order.id,
    clientId: order.clientId,
    sellerId: order.sellerId,
    supervisorId: order.supervisorId,
    status: order.status as InitialOrderStatus,
    totalCents: order.totalCents,
    items: items.map((item) => ({ productId: item.productId, quantity: item.quantityUnits })),
    placedAt: order.createdAt.toISOString(),
  };
}

function submittedEvent({ order, items }: OrderWithItems, at: Date): OrderSubmittedEvent {
  return {
    orderId: order.id,
    clientId: order.clientId,
    sellerId: order.sellerId,
    totalCents: order.totalCents,
    items: items.map((item) => ({ productId: item.productId, quantity: item.quantityUnits })),
    submittedAt: at.toISOString(),
  };
}

export function toOrderView({ order, items, history }: OrderWithItems): OrderView {
  return {
    id: order.id,
    status: order.status as OrderStatus,
    sellerId: order.sellerId,
    sellerName: order.sellerName,
    supervisorId: order.supervisorId,
    clientId: order.clientId,
    clientTradeName: order.clientTradeName,
    priceTableId: order.priceTableId,
    origin: order.origin as 'SYSTEM' | 'IMPORTED',
    subtotalCents: order.subtotalCents,
    orderDiscountBp: order.orderDiscountBp,
    orderDiscountCents: order.orderDiscountCents,
    totalCents: order.totalCents,
    approvalReasons: order.approvalReasons as ApprovalReason[],
    rejection: order.rejectionReasonCode
      ? { code: order.rejectionReasonCode as RejectionReasonCode, text: order.rejectionReasonText }
      : null,
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
    history: history.map(
      (step): HistoryStepView => ({
        status: step.status as OrderStatus,
        actor: step.actor,
        reasonCode: step.reasonCode,
        reasonText: step.reasonText,
        at: step.createdAt.toISOString(),
      }),
    ),
  };
}
