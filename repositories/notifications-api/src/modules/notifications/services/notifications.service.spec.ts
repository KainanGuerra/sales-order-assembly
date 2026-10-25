import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Database } from '../../../db/database.module.js';
import * as schema from '../../../db/schema.js';
import { NotificationsRepository } from '../repository/notifications.repository.js';
import { NotificationsBroadcaster } from './broadcaster.js';
import { NotificationsService } from './notifications.service.js';

// Runs against the Postgres from docker compose, in the "notifications_test"
// schema. Skipped when no database is given:
//   TEST_DATABASE_URL=postgres://notifications_role:<password>@127.0.0.1:5432/sales pnpm test
const url = process.env.TEST_DATABASE_URL;
const TEST_SCHEMA = 'notifications_test';

const ORDER = '3f8c2d0e-8a53-4c6a-9d7c-1b6c1d2f6a10';
const OTHER_ORDER = '9b1d7e52-0c6f-4a52-8f0e-5a3b8f7c2d11';
const seller = { id: 'V01', role: 'SELLER' as const };
const supervisor = { id: 'S01', role: 'SUPERVISOR' as const };
const otherSeller = { id: 'V02', role: 'SELLER' as const };

const ref = (orderId = ORDER) => ({
  orderId,
  sellerId: 'V01',
  supervisorId: 'S01',
  clientId: 'C001',
  clientTradeName: 'Mercadinho São José',
  totalCents: 30_343,
});
const items = [{ productId: 'P001', quantity: 12 }];
const at = '2026-10-24T12:00:00.000Z';

describe.skipIf(!url)('NotificationsService (real Postgres)', () => {
  let pool: Pool;
  let db: Database;
  let service: NotificationsService;
  let told: string[][];

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, options: `-c search_path=${TEST_SCHEMA},public` });
    db = drizzle(pool, { schema });
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../../../../drizzle', import.meta.url)),
      migrationsSchema: TEST_SCHEMA,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.execute(sql`truncate table notifications`);
    const broadcaster = new NotificationsBroadcaster();
    told = [];
    const original = broadcaster.notifyChanged.bind(broadcaster);
    broadcaster.notifyChanged = (ids) => {
      told.push(ids);
      original(ids);
    };
    service = new NotificationsService(new NotificationsRepository(db), broadcaster);
  });

  const kinds = async (actor: typeof seller) => (await service.list(actor, 50)).map((n) => n.kind).sort();

  it('asks the supervisor and tells the seller when an order waits for approval', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    expect(await kinds(supervisor)).toEqual(['APPROVAL_NEEDED']);
    expect(await kinds(seller)).toEqual(['ORDER_AWAITING_APPROVAL']);
    expect(told).toEqual([expect.arrayContaining(['S01', 'V01'])]);
  });

  it('says nothing for an order placed within the limit, and then tells both when it is sent', async () => {
    await service.onPlaced({ ...ref(), status: 'SUBMITTED', items, placedAt: at });
    expect(await service.list(seller, 50)).toEqual([]);
    expect(told).toEqual([[]]);

    await service.onSubmitted({ ...ref(), items, submittedAt: at });
    expect(await kinds(seller)).toEqual(['ORDER_SENT']);
    expect(await kinds(supervisor)).toEqual(['ORDER_SENT']);
  });

  it('creates nothing twice when the same event is delivered again', async () => {
    const event = { ...ref(), status: 'AWAITING_APPROVAL' as const, items, placedAt: at };
    await service.onPlaced(event);
    await service.onPlaced(event);
    expect(await service.list(supervisor, 50)).toHaveLength(1);
    expect(await service.list(seller, 50)).toHaveLength(1);
    // The second delivery changed nothing, so nobody is told.
    expect(told[1]).toEqual([]);
  });

  it('closes what asked for a decision when the order is approved, and tells the seller', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    await service.onApproved({ ...ref(), approvedBy: 'S01', approvedAt: at });

    const forSupervisor = await service.list(supervisor, 50);
    expect(forSupervisor.map((n) => [n.kind, n.resolved])).toEqual([['APPROVAL_NEEDED', true]]);
    const forSeller = await service.list(seller, 50);
    expect(forSeller.map((n) => [n.kind, n.resolved]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([
      ['ORDER_APPROVED', false],
      ['ORDER_AWAITING_APPROVAL', true],
    ]);
  });

  it('tells the seller the order was cancelled, with the reason, when it is rejected', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    await service.onRejected({ ...ref(), rejectedBy: 'S01', reasonCode: 'OTHER', reasonText: 'Cliente desistiu', rejectedAt: at });

    const cancelled = (await service.list(seller, 50)).find((n) => n.kind === 'ORDER_CANCELLED');
    expect(cancelled).toMatchObject({ resolved: false, data: { reasonCode: 'OTHER', reasonText: 'Cliente desistiu', decidedBy: 'S01' } });
    expect((await service.list(supervisor, 50))[0]).toMatchObject({ kind: 'APPROVAL_NEEDED', resolved: true });
  });

  it('only closes the notices of the order that was decided', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    await service.onPlaced({ ...ref(OTHER_ORDER), status: 'AWAITING_APPROVAL', items, placedAt: at });
    await service.onApproved({ ...ref(), approvedBy: 'S01', approvedAt: at });

    const open = (await service.list(supervisor, 50)).filter((n) => !n.resolved);
    expect(open.map((n) => n.orderId)).toEqual([OTHER_ORDER]);
  });

  it('counts only the unread ones of that person', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    expect(await service.unreadCount(supervisor)).toBe(1);
    expect(await service.unreadCount(otherSeller)).toBe(0);
  });

  it('marks one as read, and keeps the first moment it was read', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    const [notice] = await service.list(supervisor, 50);
    await service.markRead(supervisor, notice.id);
    const [{ readAt: first }] = await db.select({ readAt: schema.notifications.readAt }).from(schema.notifications).where(sql`id = ${notice.id}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.markRead(supervisor, notice.id);
    const [{ readAt: second }] = await db.select({ readAt: schema.notifications.readAt }).from(schema.notifications).where(sql`id = ${notice.id}`);

    expect(first).not.toBeNull();
    expect(second?.getTime()).toBe(first?.getTime());
    expect(await service.unreadCount(supervisor)).toBe(0);
    expect(await service.unreadCount(seller)).toBe(1);
  });

  it("does not let somebody read another person's notification: it answers as if it did not exist", async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    const [notice] = await service.list(supervisor, 50);
    await expect(service.markRead(otherSeller, notice.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.markRead(seller, notice.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.unreadCount(supervisor)).toBe(1);
  });

  it('marks all of a person as read and leaves the others alone', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    await service.onPlaced({ ...ref(OTHER_ORDER), status: 'AWAITING_APPROVAL', items, placedAt: at });
    expect(await service.markAllRead(supervisor)).toBe(2);
    expect(await service.unreadCount(supervisor)).toBe(0);
    expect(await service.unreadCount(seller)).toBe(2);
    expect(await service.markAllRead(supervisor)).toBe(0);
  });

  it('lists the newest first and respects the limit', async () => {
    await service.onPlaced({ ...ref(), status: 'AWAITING_APPROVAL', items, placedAt: at });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await service.onPlaced({ ...ref(OTHER_ORDER), status: 'AWAITING_APPROVAL', items, placedAt: at });
    const [latest] = await service.list(supervisor, 1);
    expect(latest.orderId).toBe(OTHER_ORDER);
  });
});

describe('NotificationsBroadcaster', () => {
  it('tells only the person it concerns', () => {
    const broadcaster = new NotificationsBroadcaster();
    const heard: string[] = [];
    broadcaster.changesFor('V01').subscribe(() => heard.push('V01'));
    broadcaster.changesFor('S01').subscribe(() => heard.push('S01'));
    broadcaster.notifyChanged(['S01']);
    expect(heard).toEqual(['S01']);
  });
});
