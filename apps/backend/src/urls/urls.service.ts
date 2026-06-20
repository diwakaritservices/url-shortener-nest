import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { ShortUrl, ShortUrlDocument } from './schemas/short-url.schema';
import {
  createShortIdGenerator,
  type ShortIdGenerator,
} from './short-id-generator';

export interface ShortUrlResponse {
  id: string;
  fullUrl: string;
  shortId: string;
  isArchived: boolean;
  archivedAt: string | null;
}

interface DuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

@Injectable()
export class UrlsService {
  private readonly shortIdAlphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private readonly generatedShortIdLength = 10;
  private readonly shortUrlCacheKeyPrefix = 'short-url';
  private readonly shortUrlCacheTtlSeconds: number;
  private shortIdGenerator?: ShortIdGenerator;
  private shortIdGeneratorPromise?: Promise<ShortIdGenerator>;

  constructor(
    @InjectModel(ShortUrl.name)
    private readonly shortUrlModel: Model<ShortUrlDocument>,
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    this.shortUrlCacheTtlSeconds =
      Number(configService.get<string>('SHORT_URL_CACHE_TTL_SECONDS')) ||
      43_200;
  }

  async create(
    ownerId: string,
    createUrlDto: CreateUrlDto,
  ): Promise<ShortUrlResponse> {
    const shortId =
      createUrlDto.shortId?.trim() ?? (await this.generateShortId());

    try {
      const shortUrl = await this.shortUrlModel.create({
        fullUrl: createUrlDto.fullUrl,
        shortId,
        ownerId: new Types.ObjectId(ownerId),
      });

      return this.toResponse(shortUrl);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        await this.throwDuplicateCreateError(
          error,
          ownerId,
          createUrlDto.fullUrl,
        );
      }

      throw error;
    }
  }

  async findAllForUser(
    ownerId: string,
    archived = false,
  ): Promise<ShortUrlResponse[]> {
    const urls = await this.shortUrlModel
      .find({
        ownerId: new Types.ObjectId(ownerId),
        archivedAt: archived ? { $ne: null } : null,
      })
      .sort({ createdAt: -1 })
      .exec();

    return urls.map((url) => this.toResponse(url));
  }

  async findOneForUser(
    ownerId: string,
    shortId: string,
  ): Promise<ShortUrlResponse> {
    const shortUrl = await this.shortUrlModel
      .findOne({
        ownerId: new Types.ObjectId(ownerId),
        shortId,
      })
      .exec();

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    return this.toResponse(shortUrl);
  }

  async removeForUser(
    ownerId: string,
    shortId: string,
  ): Promise<ShortUrlResponse> {
    const shortUrl = await this.shortUrlModel
      .findOneAndDelete({
        ownerId: new Types.ObjectId(ownerId),
        shortId,
      })
      .exec();

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    await this.deleteCachedShortUrl(shortId);

    return this.toResponse(shortUrl);
  }

  async archiveForUser(
    ownerId: string,
    shortId: string,
  ): Promise<ShortUrlResponse> {
    const shortUrl = await this.shortUrlModel
      .findOneAndUpdate(
        {
          ownerId: new Types.ObjectId(ownerId),
          shortId,
        },
        {
          $set: {
            archivedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    await this.deleteCachedShortUrl(shortId);

    return this.toResponse(shortUrl);
  }

  async unarchiveForUser(
    ownerId: string,
    shortId: string,
  ): Promise<ShortUrlResponse> {
    const shortUrl = await this.shortUrlModel
      .findOneAndUpdate(
        {
          ownerId: new Types.ObjectId(ownerId),
          shortId,
        },
        {
          $set: {
            archivedAt: null,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    await this.deleteCachedShortUrl(shortId);

    return this.toResponse(shortUrl);
  }

  async resolve(shortId: string): Promise<ShortUrlResponse> {
    const cacheKey = this.buildShortUrlCacheKey(shortId);
    const cachedFullUrl = await this.redisService.get(cacheKey);

    if (cachedFullUrl) {
      await this.redisService.expire(cacheKey, this.shortUrlCacheTtlSeconds);

      return {
        id: shortId,
        fullUrl: cachedFullUrl,
        shortId,
        isArchived: false,
        archivedAt: null,
      };
    }

    const shortUrl = await this.shortUrlModel
      .findOne({ shortId, archivedAt: null })
      .exec();

    if (!shortUrl) {
      throw new NotFoundException('Short URL not found');
    }

    await this.redisService.setEx(
      cacheKey,
      this.shortUrlCacheTtlSeconds,
      shortUrl.fullUrl,
    );

    return this.toResponse(shortUrl);
  }

  private async generateShortId(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const shortId = await this.buildGeneratedShortId();
      const existingUrl = await this.shortUrlModel.exists({ shortId }).exec();

      if (!existingUrl) {
        return shortId;
      }
    }

    throw new ConflictException('Unable to generate a unique short ID');
  }

  private async buildGeneratedShortId(): Promise<string> {
    const generator = await this.getShortIdGenerator();

    return generator();
  }

  private async getShortIdGenerator(): Promise<ShortIdGenerator> {
    if (!this.shortIdGenerator) {
      this.shortIdGeneratorPromise ??= createShortIdGenerator(
        this.shortIdAlphabet,
        this.generatedShortIdLength,
      );
      this.shortIdGenerator = await this.shortIdGeneratorPromise;
    }

    return this.shortIdGenerator;
  }

  private toResponse(shortUrl: ShortUrlDocument): ShortUrlResponse {
    return {
      id: shortUrl._id.toString(),
      fullUrl: shortUrl.fullUrl,
      shortId: shortUrl.shortId,
      isArchived: Boolean(shortUrl.archivedAt),
      archivedAt: shortUrl.archivedAt?.toISOString() ?? null,
    };
  }

  private isDuplicateKeyError(error: unknown): error is DuplicateKeyError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private async throwDuplicateCreateError(
    error: DuplicateKeyError,
    ownerId: string,
    fullUrl: string,
  ): Promise<never> {
    if (this.isDuplicateFullUrlForOwnerError(error)) {
      const existingUrl = await this.shortUrlModel
        .findOne({
          ownerId: new Types.ObjectId(ownerId),
          fullUrl,
        })
        .exec();

      if (existingUrl) {
        throw new ConflictException({
          statusCode: 409,
          message: 'You have already shortened this URL',
          existingUrl: this.toResponse(existingUrl),
        });
      }
    }

    throw new ConflictException('Short ID is already in use');
  }

  private isDuplicateFullUrlForOwnerError(error: DuplicateKeyError): boolean {
    return Boolean(error.keyPattern?.ownerId && error.keyPattern?.fullUrl);
  }

  private buildShortUrlCacheKey(shortId: string): string {
    return `${this.shortUrlCacheKeyPrefix}:${shortId}`;
  }

  private async deleteCachedShortUrl(shortId: string): Promise<void> {
    await this.redisService.del(this.buildShortUrlCacheKey(shortId));
  }
}
