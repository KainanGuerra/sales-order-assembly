import { Injectable, NotFoundException } from '@nestjs/common';
import type { OrderApprovedEvent, OrderPlacedEvent, OrderRejectedEvent, OrderSubmittedEvent } from 'contracts';
import type { Actor } from '../../../shared/actor.js';
import { planApproved, planPlaced, planRejected, planSubmitted, type Plan } from '../domain/plan.js';
import { NotificationsRepository, type NotificationRow } from '../repository/notifications.repository.js';
import { NotificationsBroadcaster } from './broadcaster.js';

export interface NotificationView {
  id: string;
  kind: string;
  orderId: string;
  data: unknown;
  createdAt: string;
  read: boolean;
  resolved: boolean;
}

const toView = (row: NotificationRow): NotificationView => ({
  id: row.id,
  kind: row.kind,
  orderId: row.orderId,
  data: row.data,
  createdAt: row.createdAt.toISOString(),
  read: row.readAt !== null,
  resolved: row.resolvedAt !== null,
});

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly broadcaster: NotificationsBroadcaster,
  ) {}

  // ---- what the events do -------------------------------------------------

  onPlaced(event: OrderPlacedEvent) {
    return this.carryOut(planPlaced(event));
  }

  onSubmitted(event: OrderSubmittedEvent) {
    return this.carryOut(planSubmitted(event));
  }

  onApproved(event: OrderApprovedEvent) {
    return this.carryOut(planApproved(event));
  }

  onRejected(event: OrderRejectedEvent) {
    return this.carryOut(planRejected(event));
  }

  // Creates what is new, closes what the decision closes, and tells the people
  // it concerns, once, after the change is saved.
  private async carryOut(plan: Plan): Promise<void> {
    const created = await this.repository.createMany(plan.create);
    const closed = plan.resolveOrderId ? await this.repository.resolveForOrder(plan.resolveOrderId, new Date()) : [];
    this.broadcaster.notifyChanged([...new Set([...created, ...closed])]);
  }

  // ---- what the person sees -----------------------------------------------

  async list(actor: Actor, limit: number): Promise<NotificationView[]> {
    return (await this.repository.list(actor.id, limit)).map(toView);
  }

  unreadCount(actor: Actor): Promise<number> {
    return this.repository.unreadCount(actor.id);
  }

  async markRead(actor: Actor, id: string): Promise<void> {
    // Someone else's notification answers like a missing one.
    if (!(await this.repository.markRead(id, actor.id, new Date()))) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    this.broadcaster.notifyChanged([actor.id]);
  }

  async markAllRead(actor: Actor): Promise<number> {
    const count = await this.repository.markAllRead(actor.id, new Date());
    if (count > 0) {
      this.broadcaster.notifyChanged([actor.id]);
    }
    return count;
  }
}
