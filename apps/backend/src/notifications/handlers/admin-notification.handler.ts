import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { ADMIN_NOTIFICATIONS_GROUP } from '../../redis/stream.constants';
import { DomainEventName } from '../domain-event.constants';
import type { DomainEventHandler } from '../domain-event.handler';
import type { DomainEventPayload } from '../domain-event.types';

@Injectable()
export class AdminNotificationHandler implements DomainEventHandler {
  readonly consumerGroup = ADMIN_NOTIFICATIONS_GROUP;
  private readonly logger = new Logger(AdminNotificationHandler.name);

  constructor(
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  supports(event: DomainEventName): boolean {
    return (
      event === DomainEventName.UserRegistered ||
      event === DomainEventName.UserLoggedIn ||
      event === DomainEventName.UrlShortened
    );
  }

  async handle(
    event: DomainEventName,
    payload: DomainEventPayload[DomainEventName],
  ): Promise<void> {
    switch (event) {
      case DomainEventName.UserRegistered: {
        const data =
          payload as DomainEventPayload[DomainEventName.UserRegistered];

        await this.mailService.sendAdminUserRegisteredNotification({
          ...data.user,
          emailVerified: data.emailVerified,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.UserLoggedIn: {
        const data = payload as DomainEventPayload[DomainEventName.UserLoggedIn];

        await this.mailService.sendAdminUserSignedInNotification({
          ...data.user,
          mfaUsed: data.mfaUsed,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.UrlShortened: {
        const data = payload as DomainEventPayload[DomainEventName.UrlShortened];
        const owner = await this.usersService.findById(data.ownerId);
        const ownerEmail = owner?.email ?? 'unknown';

        await this.mailService.sendAdminUrlShortenedNotification({
          ownerId: data.ownerId,
          ownerEmail,
          ownerName: owner?.name ?? null,
          fullUrl: data.fullUrl,
          shortId: data.shortId,
          publicShortUrl: data.publicShortUrl,
          customShortId: data.customShortId,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      default:
        this.logger.warn(`Unhandled admin event: ${event}`);
    }
  }
}
