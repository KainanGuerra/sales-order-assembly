import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../db/database.module.js';
import { notifications } from '../../../db/schema.js';
import { CLOSED_BY_A_DECISION, type PlannedNotification } from '../domain/plan.js';

export type NotificationRow = typeof notifications.$inferSelect;

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Adds the notifications that are not there yet. The same event delivered
  // twice finds the same (order, person, kind) and adds nothing. Returns the
  // people who got a new one, so only they are told something changed.
  async createMany(planned: PlannedNotification[]): Promise<string[]> {
    if (planned.length === 0) {
      return [];
    }
    const inserted = await this.db
      .insert(notifications)
      .values(planned)
      .onConflictDoNothing()
      .returning({ recipientId: notifications.recipientId });
    return [...new Set(inserted.map((row) => row.recipientId))];
  }

  // The order was decided: what asked for a decision is closed. Returns the
  // people it concerned.
  async resolveForOrder(orderId: string, at: Date): Promise<string[]> {
    const closed = await this.db
      .update(notifications)
      .set({ resolvedAt: at })
      .where(and(eq(notifications.orderId, orderId), inArray(notifications.kind, CLOSED_BY_A_DECISION), isNull(notifications.resolvedAt)))
      .returning({ recipientId: notifications.recipientId });
    return [...new Set(closed.map((row) => row.recipientId))];
  }

  // A person's notifications, newest first. Nobody else's.
  list(recipientId: string, limit: number): Promise<NotificationRow[]> {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, recipientId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async unreadCount(recipientId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)));
    return row?.count ?? 0;
  }

  // Marks one of their own as read. False when it is not theirs or does not exist.
  async markRead(id: string, recipientId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, ${at.toISOString()}::timestamptz)` })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)))
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async markAllRead(recipientId: string, at: Date): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  }
}
