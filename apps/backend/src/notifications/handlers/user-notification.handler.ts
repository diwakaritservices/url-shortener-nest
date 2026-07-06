import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { USER_NOTIFICATIONS_GROUP } from '../../redis/stream.constants';
import { DomainEventName } from '../domain-event.constants';
import type { DomainEventHandler } from '../domain-event.handler';
import type { DomainEventPayload } from '../domain-event.types';

@Injectable()
export class UserNotificationHandler implements DomainEventHandler {
  readonly consumerGroup = USER_NOTIFICATIONS_GROUP;
  private readonly logger = new Logger(UserNotificationHandler.name);

  constructor(
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  supports(event: DomainEventName): boolean {
    return event !== DomainEventName.UserRegistered &&
      event !== DomainEventName.UrlShortened;
  }

  async handle(
    event: DomainEventName,
    payload: DomainEventPayload[DomainEventName],
  ): Promise<void> {
    switch (event) {
      case DomainEventName.UserLoggedIn: {
        const data = payload as DomainEventPayload[DomainEventName.UserLoggedIn];

        await this.mailService.sendUserSignedInNotification({
          ...data.user,
          mfaUsed: data.mfaUsed,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.VerificationOtpRequested: {
        const data =
          payload as DomainEventPayload[DomainEventName.VerificationOtpRequested];

        await this.mailService.sendVerificationOtp(data.email, data.otp);
        return;
      }
      case DomainEventName.PasswordResetOtpRequested: {
        const data =
          payload as DomainEventPayload[DomainEventName.PasswordResetOtpRequested];

        await this.mailService.sendPasswordResetOtp(data.email, data.otp);
        return;
      }
      case DomainEventName.ApiKeyCreated: {
        await this.handleApiKeyEvent(
          payload as DomainEventPayload[DomainEventName.ApiKeyCreated],
          'created',
        );
        return;
      }
      case DomainEventName.ApiKeyRevoked: {
        await this.handleApiKeyEvent(
          payload as DomainEventPayload[DomainEventName.ApiKeyRevoked],
          'revoked',
        );
        return;
      }
      case DomainEventName.MfaEnabled: {
        const data = payload as DomainEventPayload[DomainEventName.MfaEnabled];

        await this.mailService.sendUserMfaEnabledNotification({
          ...data.user,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.MfaDisabled: {
        const data = payload as DomainEventPayload[DomainEventName.MfaDisabled];

        await this.mailService.sendUserMfaDisabledNotification({
          ...data.user,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.PasswordChanged: {
        const data =
          payload as DomainEventPayload[DomainEventName.PasswordChanged];

        await this.mailService.sendUserPasswordChangedNotification({
          ...data.user,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.ProfileUpdated: {
        const data =
          payload as DomainEventPayload[DomainEventName.ProfileUpdated];

        await this.mailService.sendUserProfileUpdatedNotification({
          ...data.user,
          previousName: data.previousName ?? null,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.AccountExported: {
        const data =
          payload as DomainEventPayload[DomainEventName.AccountExported];

        await this.mailService.sendUserAccountExportedNotification({
          ...data.user,
          linkCount: data.linkCount,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      case DomainEventName.AccountDeleted: {
        const data =
          payload as DomainEventPayload[DomainEventName.AccountDeleted];

        await this.mailService.sendUserAccountDeletedNotification({
          ...data.user,
          occurredAt: new Date(data.occurredAt),
        });
        return;
      }
      default:
        this.logger.warn(`Unhandled user event: ${event}`);
    }
  }

  private async handleApiKeyEvent(
    payload: DomainEventPayload[DomainEventName.ApiKeyCreated],
    action: 'created' | 'revoked',
  ): Promise<void> {
    const user = await this.usersService.findById(payload.userId);

    if (!user) {
      this.logger.warn(
        `Skipping API key ${action} email; user ${payload.userId} not found`,
      );
      return;
    }

    const notificationPayload = {
      email: user.email,
      name: user.name ?? null,
      apiKeyName: payload.apiKeyName,
      keyPrefix: payload.keyPrefix,
      occurredAt: new Date(payload.occurredAt),
    };

    if (action === 'created') {
      await this.mailService.sendUserApiKeyCreatedNotification(
        notificationPayload,
      );
      return;
    }

    await this.mailService.sendUserApiKeyRevokedNotification(notificationPayload);
  }
}
