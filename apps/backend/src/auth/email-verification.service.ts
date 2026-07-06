import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerificationResendStatus } from '@url-shortener/shared';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import { DomainEventName } from '../notifications/domain-event.constants';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

const OTP_SALT_ROUNDS = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_MAX_RESENDS = 5;
const DEFAULT_RESEND_WINDOW_SECONDS = 3600;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly usersService: UsersService,
  ) {}

  isVerificationRequired(): boolean {
    return this.configService.get<string>('EMAIL_VERIFICATION_SKIP') !== 'true';
  }

  async sendVerificationOtp(user: UserDocument): Promise<void> {
    if (!this.isVerificationRequired()) {
      return;
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
    const ttlSeconds = this.getOtpTtlSeconds();

    await this.redisService.setEx(
      this.buildOtpKey(user._id.toString()),
      ttlSeconds,
      otpHash,
    );
    await this.redisService.del(this.buildAttemptsKey(user._id.toString()));

    this.domainEventPublisher.publish(DomainEventName.VerificationOtpRequested, {
      email: user.email,
      otp,
    });
    await this.setResendCooldown(user._id.toString());
  }

  async verifyOtp(userId: string, otp: string): Promise<UserDocument> {
    if (!this.isVerificationRequired()) {
      return this.markVerified(userId);
    }

    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      throw new BadRequestException('Enter a valid 6-digit verification code');
    }

    const attempts = await this.incrementAttempts(userId);

    if (attempts > MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const storedHash = await this.redisService.get(this.buildOtpKey(userId));

    if (!storedHash) {
      throw new BadRequestException(
        'Verification code expired. Request a new one.',
      );
    }

    const isValid = await bcrypt.compare(normalizedOtp, storedHash);

    if (!isValid) {
      throw new BadRequestException('Incorrect verification code');
    }

    await this.redisService.del(this.buildOtpKey(userId));
    await this.redisService.del(this.buildAttemptsKey(userId));

    return this.markVerified(userId);
  }

  async getResendStatus(userId: string): Promise<VerificationResendStatus> {
    return this.buildResendStatus(userId);
  }

  async resendVerificationOtp(
    user: UserDocument,
  ): Promise<VerificationResendStatus> {
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.assertCanResend(user._id.toString());
    await this.sendVerificationOtp(user);
    await this.incrementResendCount(user._id.toString());

    return this.buildResendStatus(user._id.toString());
  }

  private async markVerified(userId: string): Promise<UserDocument> {
    return this.usersService.markEmailVerified(userId);
  }

  private async assertCanResend(userId: string): Promise<void> {
    const status = await this.buildResendStatus(userId);

    if (status.resendAvailableInSeconds > 0) {
      throw new HttpException(
        {
          message: `Wait ${status.resendAvailableInSeconds} seconds before requesting another code.`,
          resendAvailableInSeconds: status.resendAvailableInSeconds,
          resendsRemaining: status.resendsRemaining,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (status.resendsRemaining <= 0) {
      throw new HttpException(
        {
          message:
            'Too many verification emails requested. Try again later.',
          resendAvailableInSeconds: 0,
          resendsRemaining: 0,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async buildResendStatus(
    userId: string,
  ): Promise<VerificationResendStatus> {
    const cooldownTtl = await this.redisService.ttl(
      this.buildResendCooldownKey(userId),
    );
    const resendCount =
      Number(
        await this.redisService.get(this.buildResendCountKey(userId)),
      ) || 0;

    return {
      resendAvailableInSeconds:
        cooldownTtl > 0 ? cooldownTtl : 0,
      resendsRemaining: Math.max(0, this.getMaxResends() - resendCount),
    };
  }

  private async setResendCooldown(userId: string): Promise<void> {
    await this.redisService.setEx(
      this.buildResendCooldownKey(userId),
      this.getResendCooldownSeconds(),
      '1',
    );
  }

  private async incrementResendCount(userId: string): Promise<number> {
    const key = this.buildResendCountKey(userId);
    const current = Number(await this.redisService.get(key)) || 0;
    const next = current + 1;

    await this.redisService.setEx(
      key,
      this.getResendWindowSeconds(),
      next.toString(),
    );

    return next;
  }

  private generateOtp(): string {
    const fixedOtp = this.configService.get<string>(
      'EMAIL_VERIFICATION_FIXED_OTP',
    );

    if (fixedOtp && /^\d{6}$/.test(fixedOtp)) {
      return fixedOtp;
    }

    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private getOtpTtlSeconds(): number {
    const configured = Number(
      this.configService.get<string>('EMAIL_VERIFICATION_OTP_TTL_SECONDS') ??
        '600',
    );

    return Number.isFinite(configured) && configured > 0 ? configured : 600;
  }

  private getResendCooldownSeconds(): number {
    const configured = Number(
      this.configService.get<string>(
        'EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS',
      ) ?? DEFAULT_RESEND_COOLDOWN_SECONDS,
    );

    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_RESEND_COOLDOWN_SECONDS;
  }

  private getMaxResends(): number {
    const configured = Number(
      this.configService.get<string>('EMAIL_VERIFICATION_MAX_RESENDS') ??
        DEFAULT_MAX_RESENDS,
    );

    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MAX_RESENDS;
  }

  private getResendWindowSeconds(): number {
    const configured = Number(
      this.configService.get<string>(
        'EMAIL_VERIFICATION_RESEND_WINDOW_SECONDS',
      ) ?? DEFAULT_RESEND_WINDOW_SECONDS,
    );

    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_RESEND_WINDOW_SECONDS;
  }

  private buildOtpKey(userId: string): string {
    return `email-verification-otp:${userId}`;
  }

  private buildAttemptsKey(userId: string): string {
    return `email-verification-attempts:${userId}`;
  }

  private buildResendCooldownKey(userId: string): string {
    return `email-verification-resend-cooldown:${userId}`;
  }

  private buildResendCountKey(userId: string): string {
    return `email-verification-resend-count:${userId}`;
  }

  private async incrementAttempts(userId: string): Promise<number> {
    const key = this.buildAttemptsKey(userId);
    const current = Number(await this.redisService.get(key)) || 0;
    const next = current + 1;

    await this.redisService.setEx(
      key,
      this.getOtpTtlSeconds(),
      next.toString(),
    );

    return next;
  }
}
