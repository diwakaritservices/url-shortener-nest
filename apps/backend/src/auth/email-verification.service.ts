import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

const OTP_SALT_ROUNDS = 10;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
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

    await this.mailService.sendVerificationOtp(user.email, otp);
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

  async resendVerificationOtp(user: UserDocument): Promise<void> {
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.sendVerificationOtp(user);
  }

  private async markVerified(userId: string): Promise<UserDocument> {
    return this.usersService.markEmailVerified(userId);
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

  private buildOtpKey(userId: string): string {
    return `email-verification-otp:${userId}`;
  }

  private buildAttemptsKey(userId: string): string {
    return `email-verification-attempts:${userId}`;
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
