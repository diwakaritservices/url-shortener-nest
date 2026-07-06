import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { DomainEventConsumerService } from './domain-event.consumer.service';
import { DomainEventPublisher } from './domain-event.publisher';
import { AdminNotificationHandler } from './handlers/admin-notification.handler';
import { UserNotificationHandler } from './handlers/user-notification.handler';

@Module({
  imports: [RedisModule, MailModule, UsersModule],
  providers: [
    DomainEventPublisher,
    DomainEventConsumerService,
    AdminNotificationHandler,
    UserNotificationHandler,
  ],
  exports: [DomainEventPublisher],
})
export class NotificationsModule {}
