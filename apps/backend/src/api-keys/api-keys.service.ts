import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiKeySummary, CreateApiKeyResponse } from '@url-shortener/shared';
import { createHash, randomBytes } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { DomainEventName } from '../notifications/domain-event.constants';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';

@Injectable()
export class ApiKeysService {
  private readonly keyPrefix = 'lnk_';

  constructor(
    @InjectModel(ApiKey.name)
    private readonly apiKeyModel: Model<ApiKeyDocument>,
    private readonly usersService: UsersService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async createForUser(
    ownerId: string,
    createApiKeyDto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponse> {
    const { rawKey, keyHash, keyPrefix } = this.generateKeyMaterial();
    const apiKey = await this.apiKeyModel.create({
      ownerId: new Types.ObjectId(ownerId),
      keyHash,
      keyPrefix,
      name: createApiKeyDto.name?.trim() || 'Default',
    });

    this.domainEventPublisher.publish(DomainEventName.ApiKeyCreated, {
      userId: ownerId,
      apiKeyName: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
    });

    return {
      ...this.toSummary(apiKey),
      apiKey: rawKey,
    };
  }

  async listForUser(ownerId: string): Promise<ApiKeySummary[]> {
    const apiKeys = await this.apiKeyModel
      .find({
        ownerId: new Types.ObjectId(ownerId),
        revokedAt: null,
      })
      .sort({ createdAt: -1 })
      .exec();

    return apiKeys.map((apiKey) => this.toSummary(apiKey));
  }

  async revokeForUser(ownerId: string, apiKeyId: string): Promise<ApiKeySummary> {
    const apiKey = await this.apiKeyModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(apiKeyId),
          ownerId: new Types.ObjectId(ownerId),
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    this.domainEventPublisher.publish(DomainEventName.ApiKeyRevoked, {
      userId: ownerId,
      apiKeyName: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
    });

    return this.toSummary(apiKey);
  }

  async authenticate(rawKey: string): Promise<{ ownerId: string }> {
    if (!rawKey.startsWith(this.keyPrefix)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.apiKeyModel
      .findOneAndUpdate(
        {
          keyHash,
          revokedAt: null,
        },
        {
          $set: {
            lastUsedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const user = await this.usersService.findById(apiKey.ownerId.toString());

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    return {
      ownerId: user._id.toString(),
    };
  }

  private generateKeyMaterial(): {
    rawKey: string;
    keyHash: string;
    keyPrefix: string;
  } {
    const rawKey = `${this.keyPrefix}${randomBytes(32).toString('base64url')}`;

    return {
      rawKey,
      keyHash: this.hashKey(rawKey),
      keyPrefix: rawKey.slice(0, 12),
    };
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private toSummary(apiKey: ApiKeyDocument): ApiKeySummary {
    return {
      id: apiKey._id.toString(),
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      createdAt: apiKey.createdAt.toISOString(),
      lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    };
  }
}
