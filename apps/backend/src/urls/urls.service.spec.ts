import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import { ShortUrl } from './schemas/short-url.schema';
import { createShortIdGenerator } from './short-id-generator';
import { UrlsService } from './urls.service';

const nanoidMock = jest.fn(() => 'AbC123xYz9');

jest.mock('./short-id-generator', () => ({
  createShortIdGenerator: jest.fn(() => Promise.resolve(nanoidMock)),
}));

describe('UrlsService', () => {
  const ownerId = new Types.ObjectId().toString();
  const shortId = 'clear-river-123';
  const shortUrl = {
    _id: new Types.ObjectId(),
    fullUrl: 'https://example.com',
    shortId,
    archivedAt: new Date('2026-06-17T18:00:00.000Z'),
  };

  let service: UrlsService;
  let model: {
    create: jest.Mock;
    exists: jest.Mock;
    findOne: jest.Mock;
    findOneAndDelete: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let redisService: {
    del: jest.Mock;
    expire: jest.Mock;
    get: jest.Mock;
    setEx: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      create: jest.fn(),
      exists: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    redisService = {
      del: jest.fn().mockResolvedValue(undefined),
      expire: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlsService,
        {
          provide: getModelToken(ShortUrl.name),
          useValue: model,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: DomainEventPublisher,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'SHORT_URL_CACHE_TTL_SECONDS' ? '43200' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(UrlsService);
  });

  it('generates scalable 10 character Base62 short IDs with Nano ID', async () => {
    model.exists.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    model.create.mockImplementation((payload: { shortId: string }) =>
      Promise.resolve({
        _id: new Types.ObjectId(),
        fullUrl: 'https://example.com',
        archivedAt: null,
        ...payload,
      }),
    );

    const result = await service.create(ownerId, {
      fullUrl: 'https://example.com',
    });

    expect(createShortIdGenerator).toHaveBeenCalledWith(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      10,
    );
    expect(result.shortId).toBe('AbC123xYz9');
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shortId: 'AbC123xYz9',
      }),
    );
  });

  it('archives a user-owned short URL', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(shortUrl),
    });

    const result = await service.archiveForUser(ownerId, shortId);
    const [, update] = model.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: { archivedAt: Date } },
      unknown,
    ];

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        ownerId: new Types.ObjectId(ownerId),
        shortId,
      },
      {
        $set: {
          archivedAt: update.$set.archivedAt,
        },
      },
      { returnDocument: 'after' },
    );
    expect(update.$set.archivedAt).toBeInstanceOf(Date);
    expect(redisService.del).toHaveBeenCalledWith('short-url:clear-river-123');
    expect(result).toEqual({
      id: shortUrl._id.toString(),
      fullUrl: shortUrl.fullUrl,
      shortId,
      isArchived: true,
      archivedAt: '2026-06-17T18:00:00.000Z',
    });
  });

  it('throws when archiving a missing short URL', async () => {
    model.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.archiveForUser(ownerId, shortId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('resolves a cached short URL and refreshes its inactivity TTL', async () => {
    redisService.get.mockResolvedValue('https://cached.example.com');

    const result = await service.resolve(shortId);

    expect(model.findOne).not.toHaveBeenCalled();
    expect(redisService.get).toHaveBeenCalledWith('short-url:clear-river-123');
    expect(redisService.expire).toHaveBeenCalledWith(
      'short-url:clear-river-123',
      43200,
    );
    expect(result).toEqual({
      id: shortId,
      fullUrl: 'https://cached.example.com',
      shortId,
      isArchived: false,
      archivedAt: null,
    });
  });

  it('caches only the full URL after resolving from MongoDB', async () => {
    model.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...shortUrl, archivedAt: null }),
    });

    const result = await service.resolve(shortId);

    expect(model.findOne).toHaveBeenCalledWith({
      shortId,
      archivedAt: null,
    });
    expect(redisService.setEx).toHaveBeenCalledWith(
      'short-url:clear-river-123',
      43200,
      'https://example.com',
    );
    expect(result).toEqual({
      id: shortUrl._id.toString(),
      fullUrl: 'https://example.com',
      shortId,
      isArchived: false,
      archivedAt: null,
    });
  });

  it('deletes the cached short URL when removing a URL', async () => {
    model.findOneAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(shortUrl),
    });

    await service.removeForUser(ownerId, shortId);

    expect(redisService.del).toHaveBeenCalledWith('short-url:clear-river-123');
  });
});
