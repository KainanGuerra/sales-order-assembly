import { Controller, Get, HttpCode, MessageEvent, Param, ParseUUIDPipe, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable, interval, map, merge, startWith } from 'rxjs';
import { ENV, type Env } from '../../../config/env.js';
import type { Actor } from '../../../shared/actor.js';
import { CurrentActor } from '../../../shared/decorators/current-actor.decorator.js';
import { InnerAuthGuard } from '../../../shared/guards/inner-auth.guard.js';
import { NotificationsBroadcaster } from '../services/broadcaster.js';
import { NotificationsService } from '../services/notifications.service.js';
import { Inject } from '@nestjs/common';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;

// Everything here is about the person who is acting: nobody reads or changes
// another person's notifications.
@Controller('notifications')
@UseGuards(InnerAuthGuard)
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly broadcaster: NotificationsBroadcaster,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    const size = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    return this.service.list(actor, size);
  }

  @Get('unread-count')
  async unreadCount(@CurrentActor() actor: Actor) {
    return { count: await this.service.unreadCount(actor) };
  }

  // Declared before ':id' routes so "stream" is never taken for an id.
  // A "changed" event says the list is stale (the screen asks again); "ping" is
  // a heartbeat so proxies do not close an idle connection.
  @Sse('stream')
  stream(@CurrentActor() actor: Actor): Observable<MessageEvent> {
    const changed = this.broadcaster.changesFor(actor.id).pipe(map((): MessageEvent => ({ type: 'changed', data: '' })));
    const heartbeat = interval(this.env.STREAM_HEARTBEAT_SECONDS * 1000).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
    // The first event tells a (re)connecting screen to read the list now, so
    // anything missed while it was disconnected is picked up.
    return merge(changed, heartbeat).pipe(startWith<MessageEvent>({ type: 'changed', data: '' }));
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentActor() actor: Actor) {
    return { marked: await this.service.markAllRead(actor) };
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentActor() actor: Actor, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.service.markRead(actor, id);
  }
}
