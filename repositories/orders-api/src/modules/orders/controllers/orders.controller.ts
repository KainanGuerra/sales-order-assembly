import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../../shared/decorators/current-actor.decorator.js';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import type { Actor } from '../../../shared/actor.js';
import {
  CalculateOrderSchema,
  ListOrdersQuerySchema,
  OrderIdSchema,
  RejectOrderSchema,
  SubmitOrderSchema,
  type CalculateOrderDto,
  type ListOrdersQuery,
  type RejectOrderDto,
  type SubmitOrderDto,
} from '../dto/orders.dto.js';
import { OrdersService } from '../services/orders.service.js';

@Controller('orders')
@UseGuards(InnerAuthGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // Totals and every reason the order cannot be sent. Saves nothing.
  @Post('calculate')
  @HttpCode(200)
  calculate(@CurrentActor() actor: Actor, @Body({ schema: CalculateOrderSchema }) dto: CalculateOrderDto) {
    return this.service.calculate(actor, dto);
  }

  // Sends the order. Repeating the same orderId returns the same order.
  @Post()
  submit(@CurrentActor() actor: Actor, @Body({ schema: SubmitOrderSchema }) dto: SubmitOrderDto) {
    return this.service.submit(actor, dto);
  }

  // A client's history, newest first. Declared before ":id" so it is not read as an id.
  @Get()
  async list(@CurrentActor() actor: Actor, @Query({ schema: ListOrdersQuerySchema }) query: ListOrdersQuery) {
    return { items: await this.service.listClientOrders(actor, query.clientId, query.limit) };
  }

  // The supervisor's list. Declared before ":id" so "pending-approval" is not read as an id.
  @Get('pending-approval')
  async pendingApproval(@CurrentActor() actor: Actor) {
    return { items: await this.service.pendingApprovals(actor) };
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', { schema: OrderIdSchema }) id: string) {
    return this.service.getOrder(actor, id);
  }

  // A draft that repeats this order. Saves nothing.
  @Get(':id/repeat')
  repeat(@CurrentActor() actor: Actor, @Param('id', { schema: OrderIdSchema }) id: string) {
    return this.service.repeatDraft(actor, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentActor() actor: Actor, @Param('id', { schema: OrderIdSchema }) id: string) {
    return this.service.approve(actor, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentActor() actor: Actor,
    @Param('id', { schema: OrderIdSchema }) id: string,
    @Body({ schema: RejectOrderSchema }) dto: RejectOrderDto,
  ) {
    return this.service.reject(actor, id, dto);
  }
}
