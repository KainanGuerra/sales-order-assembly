import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { clients, sellers, supervisors } from '../../../db/schema.js';

export type SellerRow = typeof sellers.$inferSelect;
export type SupervisorRow = typeof supervisors.$inferSelect;
export type ClientRow = typeof clients.$inferSelect;

@Injectable()
export class PeopleRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  listSupervisors(): Promise<SupervisorRow[]> {
    return this.db.select().from(supervisors).orderBy(asc(supervisors.name));
  }

  listSellers(): Promise<SellerRow[]> {
    return this.db.select().from(sellers).orderBy(asc(sellers.name));
  }

  async findSupervisor(id: string): Promise<SupervisorRow | null> {
    const [row] = await this.db.select().from(supervisors).where(eq(supervisors.id, id));
    return row ?? null;
  }

  async findSeller(id: string): Promise<SellerRow | null> {
    const [row] = await this.db.select().from(sellers).where(eq(sellers.id, id));
    return row ?? null;
  }

  listClientsBySeller(sellerId: string): Promise<ClientRow[]> {
    return this.db.select().from(clients).where(eq(clients.sellerId, sellerId)).orderBy(asc(clients.tradeName));
  }

  async findClient(id: string): Promise<ClientRow | null> {
    const [row] = await this.db.select().from(clients).where(eq(clients.id, id));
    return row ?? null;
  }
}
