import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/notifications.controller.js';
import { OrderEventsController } from './controllers/order-events.controller.js';
import { NotificationsRepository } from './repository/notifications.repository.js';
import { NotificationsBroadcaster } from './services/broadcaster.js';
import { NotificationsService } from './services/notifications.service.js';

@Module({
  controllers: [NotificationsController, OrderEventsController],
  providers: [NotificationsService, NotificationsRepository, NotificationsBroadcaster],
})
export class NotificationsModule {}
