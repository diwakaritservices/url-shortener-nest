import { Test, TestingModule } from '@nestjs/testing';
import { DomainEventName } from './domain-event.constants';
import { DomainEventPublisher } from './domain-event.publisher';
import { RedisStreamService } from '../redis/redis-stream.service';

describe('DomainEventPublisher', () => {
  let publisher: DomainEventPublisher;
  let redisStreamService: {
    publishDomainEvent: jest.Mock;
  };

  beforeEach(async () => {
    redisStreamService = {
      publishDomainEvent: jest.fn().mockResolvedValue('123-0'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainEventPublisher,
        {
          provide: RedisStreamService,
          useValue: redisStreamService,
        },
      ],
    }).compile();

    publisher = module.get(DomainEventPublisher);
  });

  it('publishes domain events to the Redis stream without blocking callers', () => {
    publisher.publish(DomainEventName.UserLoggedIn, {
      user: { id: 'user-1', email: 'user@example.com', name: null },
      mfaUsed: false,
    });

    expect(redisStreamService.publishDomainEvent).toHaveBeenCalledWith(
      DomainEventName.UserLoggedIn,
      expect.stringContaining('"email":"user@example.com"'),
    );
  });

  it('publishes OTP events without adding occurredAt', () => {
    publisher.publish(DomainEventName.VerificationOtpRequested, {
      email: 'user@example.com',
      otp: '123456',
    });

    expect(redisStreamService.publishDomainEvent).toHaveBeenCalledWith(
      DomainEventName.VerificationOtpRequested,
      JSON.stringify({ email: 'user@example.com', otp: '123456' }),
    );
  });

  it('swallows stream failures without throwing', async () => {
    redisStreamService.publishDomainEvent.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    expect(() =>
      publisher.publish(DomainEventName.UserLoggedIn, {
        user: { id: 'user-1', email: 'user@example.com' },
        mfaUsed: false,
      }),
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
  });
});
