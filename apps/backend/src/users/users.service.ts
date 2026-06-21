import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiKey, ApiKeyDocument } from '../api-keys/schemas/api-key.schema';
import { ShortUrl, ShortUrlDocument } from '../urls/schemas/short-url.schema';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ShortUrl.name)
    private readonly shortUrlModel: Model<ShortUrlDocument>,
    @InjectModel(ApiKey.name)
    private readonly apiKeyModel: Model<ApiKeyDocument>,
  ) {}

  async create(
    email: string,
    passwordHash: string,
    options?: { emailVerified?: boolean },
  ): Promise<UserDocument> {
    try {
      return await this.userModel.create({
        email: this.normalizeEmail(email),
        passwordHash,
        emailVerified: options?.emailVerified ?? false,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIdWithMfaSecrets(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+totpSecret +mfaPendingSecret').exec();
  }

  async findByEmailWithMfaSecrets(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: this.normalizeEmail(email) })
      .select('+totpSecret +mfaPendingSecret')
      .exec();
  }

  async updateName(userId: string, name: string | null): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { name }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async markEmailVerified(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { emailVerified: true }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { passwordHash }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async setMfaPendingSecret(
    userId: string,
    pendingSecret: string,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { mfaPendingSecret: pendingSecret },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async enableMfa(userId: string, totpSecret: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          mfaEnabled: true,
          totpSecret,
          mfaPendingSecret: null,
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async disableMfa(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          mfaEnabled: false,
          totpSecret: null,
          mfaPendingSecret: null,
        },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteAccountAndData(userId: string): Promise<void> {
    const ownerObjectId = new Types.ObjectId(userId);

    await Promise.all([
      this.shortUrlModel.deleteMany({ ownerId: ownerObjectId }).exec(),
      this.apiKeyModel.deleteMany({ ownerId: ownerObjectId }).exec(),
    ]);

    const deletedUser = await this.userModel.findByIdAndDelete(userId).exec();

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
