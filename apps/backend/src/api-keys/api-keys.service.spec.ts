import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { DomainEventName } from '../notifications/domain-event.constants';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './schemas/api-key.schema';

describe('ApiKeysService', () => {
  const ownerId = new Types.ObjectId().toString();
  let service: ApiKeysService;
  let model: {
    create: jest.Mock;
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let usersService: {
    findById: jest.Mock;
  };
  let domainEventPublisher: {
    publish: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      create: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    usersService = {
      findById: jest.fn(),
    };
    domainEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: getModelToken(ApiKey.name),
          useValue: model,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: DomainEventPublisher,
          useValue: domainEventPublisher,
        },
      ],
    }).compile();

    service = module.get(ApiKeysService);
  });

  it('creates an API key and returns the raw secret once', async () => {
    model.create.mockImplementation(async (payload: { keyPrefix: string }) => ({
      _id: new Types.ObjectId(),
      ownerId: new Types.ObjectId(ownerId),
      keyPrefix: payload.keyPrefix,
      name: 'CI key',
      createdAt: new Date('2026-06-20T12:00:00.000Z'),
      lastUsedAt: null,
    }));

    const response = await service.createForUser(ownerId, { name: 'CI key' });

    expect(response.name).toBe('CI key');
    expect(response.apiKey.startsWith('lnk_')).toBe(true);
    expect(response.keyPrefix).toBe(response.apiKey.slice(0, 12));
    expect(domainEventPublisher.publish).toHaveBeenCalledWith(
      DomainEventName.ApiKeyCreated,
      expect.objectContaining({
        userId: ownerId,
        apiKeyName: 'CI key',
      }),
    );
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: new Types.ObjectId(ownerId),
        name: 'CI key',
      }),
    );
  });

  it('authenticates a valid API key', async () => {
    const rawKey = 'lnk_testkey123456789012345678901234567';
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        ownerId: new Types.ObjectId(ownerId),
      }),
    });
    usersService.findById.mockResolvedValue({
      _id: new Types.ObjectId(ownerId),
      email: 'user@example.com',
    });

    await expect(service.authenticate(rawKey)).resolves.toEqual({
      ownerId,
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        keyHash: createHash('sha256').update(rawKey).digest('hex'),
        revokedAt: null,
      },
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects invalid API keys', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.authenticate('lnk_invalidkey123456789012345678901'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
