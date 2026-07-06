import { Injectable, Logger } from '@nestjs/common';
import { RedisStreamService } from '../redis/redis-stream.service';
import { DomainEventName } from './domain-event.constants';
import type {
  DomainEventPayload,
  PublishDomainEventPayload,
} from './domain-event.types';

@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger(DomainEventPublisher.name);

  constructor(private readonly redisStreamService: RedisStreamService) {}

  publish<E extends DomainEventName>(
    event: E,
    payload: PublishDomainEventPayload<E>,
  ): void {
    const data = this.buildEventPayload(event, payload);

    void this.enqueue(event, data);
  }

  private buildEventPayload<E extends DomainEventName>(
    event: E,
    payload: PublishDomainEventPayload<E>,
  ): DomainEventPayload[E] {
    if (
      event === DomainEventName.VerificationOtpRequested ||
      event === DomainEventName.PasswordResetOtpRequested
    ) {
      return payload as DomainEventPayload[E];
    }

    return {
      ...payload,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    } as DomainEventPayload[E];
  }

  private enqueue(
    event: DomainEventName,
    data: DomainEventPayload[DomainEventName],
  ): Promise<void> {
    return this.redisStreamService
      .publishDomainEvent(event, JSON.stringify(data))
      .then(() => undefined)
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown stream error';

        this.logger.error(
          `Failed to publish domain event (${event}): ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
  }
}
