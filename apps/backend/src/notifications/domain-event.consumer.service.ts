import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  RedisStreamService,
  type StreamMessage,
} from '../redis/redis-stream.service';
import {
  STREAM_BLOCK_MS,
  STREAM_CLAIM_IDLE_MS,
  STREAM_CONSUMER_CONCURRENCY,
  STREAM_MAX_DELIVERIES,
  STREAM_RECLAIM_INTERVAL_MS,
} from '../redis/stream.constants';
import { DomainEventName } from './domain-event.constants';
import type { DomainEventHandler } from './domain-event.handler';
import type { DomainEventPayload } from './domain-event.types';
import { AdminNotificationHandler } from './handlers/admin-notification.handler';
import { UserNotificationHandler } from './handlers/user-notification.handler';

interface ConsumerRegistration {
  handler: DomainEventHandler;
  activeCount: number;
}

@Injectable()
export class DomainEventConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DomainEventConsumerService.name);
  private readonly registrations: ConsumerRegistration[] = [];
  private running = false;
  private reclaimTimer?: NodeJS.Timeout;
  private readonly consumerTasks = new Set<Promise<void>>();

  constructor(
    private readonly redisStreamService: RedisStreamService,
    adminNotificationHandler: AdminNotificationHandler,
    userNotificationHandler: UserNotificationHandler,
  ) {
    this.registrations.push(
      { handler: adminNotificationHandler, activeCount: 0 },
      { handler: userNotificationHandler, activeCount: 0 },
    );
  }

  async onModuleInit(): Promise<void> {
    const stream = this.redisStreamService.getDomainEventsStream();

    if (!this.redisStreamService.isAvailable()) {
      this.logger.warn(
        'Redis is unavailable: domain event consumers are not running',
      );
      return;
    }

    await Promise.all(
      this.registrations.map(({ handler }) =>
        this.redisStreamService.ensureConsumerGroup(stream, handler.consumerGroup),
      ),
    );

    this.running = true;
    this.logger.log(
      `Domain event consumers started for stream "${stream}"`,
    );
    this.startConsumerLoops();
    this.reclaimTimer = setInterval(() => {
      void this.reclaimStaleMessages();
    }, STREAM_RECLAIM_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    this.running = false;

    if (this.reclaimTimer) {
      clearInterval(this.reclaimTimer);
    }
  }

  private startConsumerLoops(): void {
    for (const registration of this.registrations) {
      for (let index = 0; index < STREAM_CONSUMER_CONCURRENCY; index += 1) {
        this.trackConsumerTask(this.runConsumerLoop(registration));
      }
    }
  }

  private trackConsumerTask(task: Promise<void>): void {
    this.consumerTasks.add(task);
    void task.finally(() => {
      this.consumerTasks.delete(task);
    });
  }

  private async runConsumerLoop(
    registration: ConsumerRegistration,
  ): Promise<void> {
    const stream = this.redisStreamService.getDomainEventsStream();
    const { handler } = registration;

    while (this.running) {
      const messages = await this.redisStreamService.readGroupMessages(
        stream,
        handler.consumerGroup,
        1,
        STREAM_BLOCK_MS,
      );

      for (const message of messages) {
        registration.activeCount += 1;

        try {
          await this.processMessage(handler, message);
        } finally {
          registration.activeCount -= 1;
        }
      }
    }
  }

  private async reclaimStaleMessages(): Promise<void> {
    if (!this.running) {
      return;
    }

    const stream = this.redisStreamService.getDomainEventsStream();

    await Promise.all(
      this.registrations.map(async ({ handler }) => {
        const messages = await this.redisStreamService.claimStaleMessages(
          stream,
          handler.consumerGroup,
          STREAM_CLAIM_IDLE_MS,
          STREAM_CONSUMER_CONCURRENCY,
        );

        for (const message of messages) {
          await this.processMessage(handler, message);
        }
      }),
    );
  }

  private async processMessage(
    handler: DomainEventHandler,
    message: StreamMessage,
  ): Promise<void> {
    const stream = this.redisStreamService.getDomainEventsStream();
    const event = message.type as DomainEventName;

    if (!handler.supports(event)) {
      await this.redisStreamService.acknowledge(
        stream,
        handler.consumerGroup,
        message.id,
      );
      return;
    }

    const deliveryCount = await this.redisStreamService.getDeliveryCount(
      stream,
      handler.consumerGroup,
      message.id,
    );

    if (deliveryCount >= STREAM_MAX_DELIVERIES) {
      await this.redisStreamService.moveToDeadLetter(
        message,
        handler.consumerGroup,
        `Exceeded max deliveries (${STREAM_MAX_DELIVERIES})`,
      );
      await this.redisStreamService.acknowledge(
        stream,
        handler.consumerGroup,
        message.id,
      );
      return;
    }

    try {
      const payload = JSON.parse(
        message.payload,
      ) as DomainEventPayload[DomainEventName];

      await handler.handle(event, payload);
      this.logger.log(
        `Processed ${event} in ${handler.consumerGroup} (${message.id})`,
      );
      await this.redisStreamService.acknowledge(
        stream,
        handler.consumerGroup,
        message.id,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown handler error';

      this.logger.error(
        `Failed to process ${event} in ${handler.consumerGroup}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (deliveryCount >= STREAM_MAX_DELIVERIES) {
        await this.redisStreamService.moveToDeadLetter(
          message,
          handler.consumerGroup,
          errorMessage,
        );
        await this.redisStreamService.acknowledge(
          stream,
          handler.consumerGroup,
          message.id,
        );
      }
    }
  }
}
