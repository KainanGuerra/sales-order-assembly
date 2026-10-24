import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentActor } from '../../../shared/decorators/current-actor.decorator.js';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import { ValidatePickSchema, type ValidatePick } from '../dto/people.dto.js';
import type { Actor } from '../rules.js';
import { PeopleService } from '../services/people.service.js';

@Controller()
@UseGuards(InnerAuthGuard)
export class PeopleController {
  constructor(private readonly service: PeopleService) {}

  // Who can be picked on the login screen.
  @Get('login-options')
  loginOptions() {
    return this.service.loginOptions();
  }

  // The BFF asks this before creating a session for the picked person.
  @Post('sessions/validate')
  @HttpCode(200)
  validate(@Body({ schema: ValidatePickSchema }) pick: ValidatePick) {
    return this.service.validatePick(pick);
  }

  @Get('sellers/:sellerId/clients')
  async portfolio(@CurrentActor() actor: Actor, @Param('sellerId') sellerId: string) {
    return { items: await this.service.listPortfolio(actor, sellerId) };
  }

  @Get('clients/:clientId')
  client(@CurrentActor() actor: Actor, @Param('clientId') clientId: string) {
    return this.service.getClientFor(actor, clientId);
  }
}
