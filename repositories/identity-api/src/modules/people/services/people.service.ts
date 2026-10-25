import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderPlacedEvent, OrderRejectedEvent } from 'contracts';
import { ENV, type Env } from '../../../config/env.js';
import type { ClientView, LoginOptions, UserProfile, ValidatePick } from '../dto/people.dto.js';
import { PeopleRepository, type ClientRow, type SellerRow } from '../repository/people.repository.js';
import { availableCreditCents, canAccessPortfolio, effectivePriceTable, type Actor } from '../rules.js';

@Injectable()
export class PeopleService {
  constructor(
    private readonly repository: PeopleRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // The login screen lists everyone the visitor can pick. No credentials: the
  // challenge simulates the login by choosing a person.
  async loginOptions(): Promise<LoginOptions> {
    const [supervisors, sellers] = await Promise.all([
      this.repository.listSupervisors(),
      this.repository.listSellers(),
    ]);
    return {
      supervisors: supervisors.map(({ id, name }) => ({ id, name })),
      sellers: sellers.map(({ id, name }) => ({ id, name })),
    };
  }

  // Called by the BFF before it creates a session.
  async validatePick({ role, id }: ValidatePick): Promise<UserProfile> {
    if (role === 'SELLER') {
      const seller = await this.repository.findSeller(id);
      if (!seller) {
        throw new NotFoundException(`Seller ${id} not found`);
      }
      return {
        role,
        id: seller.id,
        name: seller.name,
        supervisorId: seller.supervisorId,
        discountLimitBp: seller.discountLimitBp,
      };
    }
    const supervisor = await this.repository.findSupervisor(id);
    if (!supervisor) {
      throw new NotFoundException(`Supervisor ${id} not found`);
    }
    return { role, id: supervisor.id, name: supervisor.name };
  }

  async listPortfolio(actor: Actor, sellerId: string): Promise<ClientView[]> {
    const seller = await this.requireSeller(sellerId);
    if (!canAccessPortfolio(actor, seller)) {
      throw new ForbiddenException('This portfolio belongs to another seller');
    }
    const clients = await this.repository.listClientsBySeller(sellerId);
    const holds = await this.repository.holdsByClient(clients.map((c) => c.id), new Date());
    return clients.map((client) => this.toClientView(client, holds.get(client.id) ?? 0));
  }

  async getClientFor(actor: Actor, clientId: string): Promise<ClientView> {
    const client = await this.requireClient(clientId);
    const seller = await this.requireSeller(client.sellerId);
    if (!canAccessPortfolio(actor, seller)) {
      // Same answer as a missing client, so ids cannot be probed.
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return this.toClientView(client, await this.holdsOf(client.id));
  }

  // Service-to-service reads (orders-api): the caller is trusted, no actor.
  async findClient(clientId: string): Promise<ClientView | null> {
    const client = await this.repository.findClient(clientId);
    return client ? this.toClientView(client, await this.holdsOf(client.id)) : null;
  }

  // ---- Credit ------------------------------------------------------------

  // Holds credit for an order about to be saved. null when the client is unknown.
  async reserveCredit(clientId: string, orderId: string, amountCents: number) {
    return this.repository.reserve({
      clientId,
      orderId,
      amountCents,
      ttlSeconds: this.env.RESERVATION_TTL_SECONDS,
      now: new Date(),
    });
  }

  async releaseCredit(orderId: string): Promise<void> {
    await this.repository.release(orderId);
  }

  // OrderPlaced: the order exists now (sent, or waiting for a supervisor), so its
  // hold becomes permanent until the order is rejected.
  async confirmPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.repository.confirm({
      orderId: event.orderId,
      clientId: event.clientId,
      amountCents: event.totalCents,
      now: new Date(),
    });
  }

  // OrderRejected: the credit goes back.
  async releaseRejected(event: OrderRejectedEvent): Promise<void> {
    await this.repository.release(event.orderId);
  }

  async findSeller(sellerId: string): Promise<SellerRow | null> {
    return this.repository.findSeller(sellerId);
  }

  private async requireSeller(id: string): Promise<SellerRow> {
    const seller = await this.repository.findSeller(id);
    if (!seller) {
      throw new NotFoundException(`Seller ${id} not found`);
    }
    return seller;
  }

  private async requireClient(id: string): Promise<ClientRow> {
    const client = await this.repository.findClient(id);
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  private async holdsOf(clientId: string): Promise<number> {
    return (await this.repository.holdsByClient([clientId], new Date())).get(clientId) ?? 0;
  }

  // creditUsedCents is what is spoken for: what the client had already used,
  // plus the orders that were sent and the holds that have not expired.
  private toClientView(client: ClientRow, heldCents: number): ClientView {
    const table = effectivePriceTable(client, this.env.DEFAULT_PRICE_TABLE_ID);
    const creditUsedCents = client.creditUsedCents + heldCents;
    return {
      id: client.id,
      tradeName: client.tradeName,
      legalName: client.legalName,
      cnpj: client.cnpj,
      city: client.city,
      state: client.state,
      sellerId: client.sellerId,
      priceTableId: table.priceTableId,
      priceTableFallback: table.fallback,
      creditLimitCents: client.creditLimitCents,
      creditUsedCents,
      creditAvailableCents: availableCreditCents({ creditLimitCents: client.creditLimitCents, creditUsedCents }),
    };
  }
}
