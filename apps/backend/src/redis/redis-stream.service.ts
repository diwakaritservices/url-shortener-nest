import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import {
  DOMAIN_EVENTS_DLQ_STREAM,
  DOMAIN_EVENTS_MAX_LEN,
  DOMAIN_EVENTS_STREAM,
} from './stream.constants';

export interface StreamMessage {
  id: string;
  type: string;
  payload: string;
  deliveryCount: number;
}

@Injectable()
export class RedisStreamService {
  private readonly logger = new Logger(RedisStreamService.name);
  private readonly consumerId: string;

  constructor(
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    this.consumerId =
      configService.get<string>('STREAM_CONSUMER_NAME') ??
      `backend-${process.pid}`;
  }

  getConsumerId(): string {
    return this.consumerId;
  }

  getDomainEventsStream(): string {
    return DOMAIN_EVENTS_STREAM;
  }

  getDeadLetterStream(): string {
    return DOMAIN_EVENTS_DLQ_STREAM;
  }

  isAvailable(): boolean {
    return this.redisService.isConnected();
  }

  async publishDomainEvent(type: string, payload: string): Promise<string | null> {
    const client = this.redisService.getClient();

    if (!client) {
      this.logger.warn(
        `Redis unavailable: domain event not published (${type})`,
      );
      return null;
    }

    try {
      return await client.xAdd(
        DOMAIN_EVENTS_STREAM,
        '*',
        { type, payload },
        {
          TRIM: {
            strategy: 'MAXLEN',
            strategyModifier: '~',
            threshold: DOMAIN_EVENTS_MAX_LEN,
          },
        },
      );
    } catch (error) {
      this.logger.warn(
        `Stream publish failed: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  async ensureConsumerGroup(stream: string, group: string): Promise<void> {
    const client = this.redisService.getClient();

    if (!client) {
      return;
    }

    try {
      await client.xGroupCreate(stream, group, '0', { MKSTREAM: true });
    } catch (error) {
      const message = this.getErrorMessage(error);

      if (!message.includes('BUSYGROUP')) {
        this.logger.warn(
          `Failed to create consumer group ${group}: ${message}`,
        );
      }
    }
  }

  async readGroupMessages(
    stream: string,
    group: string,
    count: number,
    blockMs: number,
  ): Promise<StreamMessage[]> {
    const client = this.redisService.getClient();

    if (!client) {
      return [];
    }

    try {
      const response = await client.xReadGroup(
        group,
        this.consumerId,
        [{ key: stream, id: '>' }],
        { COUNT: count, BLOCK: blockMs },
      );

      return this.parseReadGroupResponse(response);
    } catch (error) {
      this.logger.warn(`Stream read failed: ${this.getErrorMessage(error)}`);
      return [];
    }
  }

  async claimStaleMessages(
    stream: string,
    group: string,
    idleMs: number,
    count: number,
  ): Promise<StreamMessage[]> {
    const client = this.redisService.getClient();

    if (!client) {
      return [];
    }

    try {
      const pending = await client.xPendingRange(stream, group, '-', '+', count);

      if (pending.length === 0) {
        return [];
      }

      const staleIds = pending
        .filter((entry) => entry.millisecondsSinceLastDelivery >= idleMs)
        .map((entry) => entry.id);

      if (staleIds.length === 0) {
        return [];
      }

      const claimed = await client.xClaim(
        stream,
        group,
        this.consumerId,
        idleMs,
        staleIds,
      );

      return this.parseClaimedMessages(claimed);
    } catch (error) {
      this.logger.warn(`Stream claim failed: ${this.getErrorMessage(error)}`);
      return [];
    }
  }

  async getDeliveryCount(
    stream: string,
    group: string,
    messageId: string,
  ): Promise<number> {
    const client = this.redisService.getClient();

    if (!client) {
      return 0;
    }

    try {
      const pending = await client.xPendingRange(
        stream,
        group,
        messageId,
        messageId,
        1,
      );

      return pending[0]?.deliveriesCounter ?? 0;
    } catch {
      return 0;
    }
  }

  async acknowledge(
    stream: string,
    group: string,
    messageId: string,
  ): Promise<void> {
    const client = this.redisService.getClient();

    if (!client) {
      return;
    }

    try {
      await client.xAck(stream, group, messageId);
    } catch (error) {
      this.logger.warn(`Stream ack failed: ${this.getErrorMessage(error)}`);
    }
  }

  async moveToDeadLetter(
    message: StreamMessage,
    consumerGroup: string,
    errorMessage: string,
  ): Promise<void> {
    const client = this.redisService.getClient();

    if (!client) {
      return;
    }

    try {
      await client.xAdd(DOMAIN_EVENTS_DLQ_STREAM, '*', {
        originalId: message.id,
        type: message.type,
        payload: message.payload,
        consumerGroup,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Dead-letter publish failed: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private parseReadGroupResponse(
    response: Awaited<
      ReturnType<NonNullable<ReturnType<RedisService['getClient']>>['xReadGroup']>
    > | null,
  ): StreamMessage[] {
    if (!response) {
      return [];
    }

    const messages: StreamMessage[] = [];

    for (const streamEntry of response) {
      for (const message of streamEntry.messages) {
        const parsed = this.toStreamMessage(message);

        if (parsed) {
          messages.push(parsed);
        }
      }
    }

    return messages;
  }

  private parseClaimedMessages(
    messages: Awaited<
      ReturnType<NonNullable<ReturnType<RedisService['getClient']>>['xClaim']>
    >,
  ): StreamMessage[] {
    return messages
      .map((message) => (message ? this.toStreamMessage(message) : null))
      .filter((message): message is StreamMessage => message !== null);
  }

  private toStreamMessage(message: {
    id: string;
    message: Record<string, string>;
  }): StreamMessage | null {
    const type = message.message.type;
    const payload = message.message.payload;

    if (!type || !payload) {
      return null;
    }

    return {
      id: message.id,
      type,
      payload,
      deliveryCount: 0,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown Redis stream error';
  }
}
