import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { MfaSetupResponse } from '@url-shortener/shared';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { RedisService } from '../redis/redis.service';
import { DomainEventName } from '../notifications/domain-event.constants';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import { UsersService } from '../users/users.service';
import type { UserDocument } from '../users/schemas/user.schema';
import type { AuthenticatedUser } from './auth.service';

const MFA_ISSUER = 'moklay';
const MFA_LOGIN_TTL_SECONDS = 300;
const MAX_MFA_ATTEMPTS = 5;

@Injectable()
export class MfaService {
  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  async beginSetup(userId: string, email: string): Promise<MfaSetupResponse> {
    const user = await this.usersService.findByIdWithMfaSecrets(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('Multi-factor authentication is already enabled');
    }

    const secret = this.getConfiguredSecret() ?? this.generateSecret();
    await this.usersService.setMfaPendingSecret(userId, secret);

    return {
      secret,
      otpauthUrl: this.buildOtpAuthUrl(MFA_ISSUER, email, secret),
    };
  }

  async enableMfa(userId: string, code: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdWithMfaSecrets(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('Multi-factor authentication is already enabled');
    }

    if (!user.mfaPendingSecret) {
      throw new BadRequestException('Start MFA setup before enabling it');
    }

    this.assertValidTotp(user.mfaPendingSecret, code);

    const updatedUser = await this.usersService.enableMfa(
      userId,
      user.mfaPendingSecret,
    );

    this.domainEventPublisher.publish(DomainEventName.MfaEnabled, {
      user: {
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name ?? null,
      },
    });

    return this.toAuthenticatedUser(updatedUser);
  }

  async disableMfa(
    userId: string,
    password: string,
    code: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdWithMfaSecrets(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    if (!user.mfaEnabled || !user.totpSecret) {
      throw new BadRequestException('Multi-factor authentication is not enabled');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    this.assertValidTotp(user.totpSecret, code);

    const updatedUser = await this.usersService.disableMfa(userId);

    this.domainEventPublisher.publish(DomainEventName.MfaDisabled, {
      user: {
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name ?? null,
      },
    });

    return this.toAuthenticatedUser(updatedUser);
  }

  async createLoginChallenge(user: UserDocument): Promise<{
    mfaRequired: true;
    mfaToken: string;
  }> {
    const mfaToken = randomBytes(32).toString('base64url');

    await this.redisService.setEx(
      this.buildLoginKey(mfaToken),
      MFA_LOGIN_TTL_SECONDS,
      user._id.toString(),
    );
    await this.redisService.del(this.buildAttemptsKey(mfaToken));

    return {
      mfaRequired: true,
      mfaToken,
    };
  }

  async completeLogin(
    mfaToken: string,
    code: string,
  ): Promise<{ user: UserDocument }> {
    const normalizedCode = code.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException('Enter a valid 6-digit authentication code');
    }

    const attempts = await this.incrementAttempts(mfaToken);

    if (attempts > MAX_MFA_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect attempts. Sign in again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const userId = await this.redisService.get(this.buildLoginKey(mfaToken));

    if (!userId) {
      throw new BadRequestException('Sign-in challenge expired. Sign in again.');
    }

    const user = await this.usersService.findByIdWithMfaSecrets(userId);

    if (!user?.mfaEnabled || !user.totpSecret) {
      throw new BadRequestException('Sign-in challenge expired. Sign in again.');
    }

    this.assertValidTotp(user.totpSecret, normalizedCode);

    await this.redisService.del(this.buildLoginKey(mfaToken));
    await this.redisService.del(this.buildAttemptsKey(mfaToken));

    return { user };
  }

  isMfaEnabled(user: UserDocument): boolean {
    return Boolean(user.mfaEnabled && user.totpSecret);
  }

  private assertValidTotp(secret: string, code: string): void {
    const normalizedCode = code.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException('Enter a valid 6-digit authentication code');
    }

    const fixedCode = this.configService.get<string>('MFA_FIXED_CODE');

    if (fixedCode && fixedCode === normalizedCode) {
      return;
    }

    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: normalizedCode,
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException('Incorrect authentication code');
    }
  }

  private buildOtpAuthUrl(
    issuer: string,
    accountName: string,
    secret: string,
  ): string {
    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
    const params = new URLSearchParams({
      secret,
      issuer,
    });

    return `otpauth://totp/${label}?${params.toString()}`;
  }

  private generateSecret(): string {
    return speakeasy.generateSecret({ length: 20 }).base32;
  }

  private getConfiguredSecret(): string | null {
    const fixedSecret = this.configService.get<string>('MFA_FIXED_SECRET');

    return fixedSecret?.trim() || null;
  }

  private buildLoginKey(mfaToken: string): string {
    return `mfa-login:${mfaToken}`;
  }

  private buildAttemptsKey(mfaToken: string): string {
    return `mfa-login-attempts:${mfaToken}`;
  }

  private async incrementAttempts(mfaToken: string): Promise<number> {
    const key = this.buildAttemptsKey(mfaToken);
    const current = Number(await this.redisService.get(key)) || 0;
    const next = current + 1;

    await this.redisService.setEx(key, MFA_LOGIN_TTL_SECONDS, next.toString());

    return next;
  }

  private toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name ?? null,
      emailVerified: user.emailVerified ?? true,
      mfaEnabled: user.mfaEnabled ?? false,
    };
  }
}
