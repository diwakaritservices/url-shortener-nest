import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;
  private blockingClient: RedisClientType | null = null;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient({
      socket: {
        reconnectStrategy: false,
        connectTimeout: 5_000,
      },
      url:
        this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:8765',
    });

    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(`Redis unavailable: ${this.getErrorMessage(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.blockingClient?.isOpen) {
      await this.blockingClient.quit();
    }

    if (!this.client.isOpen) {
      return;
    }

    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    if (!this.client.isOpen) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Redis get failed: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    try {
      await this.client.setEx(key, seconds, value);
    } catch (error) {
      this.logger.warn(`Redis set failed: ${this.getErrorMessage(error)}`);
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      this.logger.warn(`Redis expire failed: ${this.getErrorMessage(error)}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis delete failed: ${this.getErrorMessage(error)}`);
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client.isOpen) {
      return -2;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.warn(`Redis ttl failed: ${this.getErrorMessage(error)}`);
      return -2;
    }
  }

  getClient(): RedisClientType | null {
    return this.client.isOpen ? this.client : null;
  }

  async getBlockingClient(): Promise<RedisClientType | null> {
    if (!this.client.isOpen) {
      return null;
    }

    if (!this.blockingClient) {
      this.blockingClient = this.client.duplicate();
      await this.blockingClient.connect();
    }

    return this.blockingClient.isOpen ? this.blockingClient : null;
  }

  isConnected(): boolean {
    return this.client.isOpen;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown Redis error';
  }
}
