import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { DomainEventName } from '../domain-event.constants';
import { AdminNotificationHandler } from './admin-notification.handler';
import { UserNotificationHandler } from './user-notification.handler';

describe('Domain event handlers', () => {
  let adminHandler: AdminNotificationHandler;
  let userHandler: UserNotificationHandler;
  let mailService: {
    sendAdminUserSignedInNotification: jest.Mock;
    sendUserSignedInNotification: jest.Mock;
  };

  beforeEach(async () => {
    mailService = {
      sendAdminUserSignedInNotification: jest.fn().mockResolvedValue(undefined),
      sendUserSignedInNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminNotificationHandler,
        UserNotificationHandler,
        {
          provide: MailService,
          useValue: mailService,
        },
        {
          provide: UsersService,
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    adminHandler = module.get(AdminNotificationHandler);
    userHandler = module.get(UserNotificationHandler);
  });

  it('routes USER_LOGGED_IN to both subscriber groups', async () => {
    const payload = {
      user: { id: 'user-1', email: 'user@example.com', name: 'User' },
      mfaUsed: true,
      occurredAt: '2026-07-06T10:00:00.000Z',
    };

    expect(adminHandler.supports(DomainEventName.UserLoggedIn)).toBe(true);
    expect(userHandler.supports(DomainEventName.UserLoggedIn)).toBe(true);

    await adminHandler.handle(DomainEventName.UserLoggedIn, payload);
    await userHandler.handle(DomainEventName.UserLoggedIn, payload);

    expect(mailService.sendAdminUserSignedInNotification).toHaveBeenCalled();
    expect(mailService.sendUserSignedInNotification).toHaveBeenCalled();
  });

  it('keeps admin and user subscribers independent for registration', () => {
    expect(adminHandler.supports(DomainEventName.UserRegistered)).toBe(true);
    expect(userHandler.supports(DomainEventName.UserRegistered)).toBe(false);
  });
});
