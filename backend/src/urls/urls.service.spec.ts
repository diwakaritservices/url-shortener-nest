import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
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
    findOneAndUpdate: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      create: jest.fn(),
      exists: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlsService,
        {
          provide: getModelToken(ShortUrl.name),
          useValue: model,
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
});
