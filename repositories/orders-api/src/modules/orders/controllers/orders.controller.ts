import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../../shared/decorators/current-actor.decorator.js';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import type { Actor } from '../../../shared/actor.js';
import { CalculateOrderSchema, SubmitOrderSchema, type CalculateOrderDto, type SubmitOrderDto } from '../dto/orders.dto.js';
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

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.getOrder(actor, id);
  }
}
