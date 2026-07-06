import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { DomainEventName } from '../notifications/domain-event.constants';
import { DomainEventPublisher } from '../notifications/domain-event.publisher';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { IsStrongPasswordConstraint } from './validators/password-policy.validator';

const OTP_SALT_ROUNDS = 10;
const MAX_RESET_ATTEMPTS = 5;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly usersService: UsersService,
  ) {}

  async requestReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return;
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
    const ttlSeconds = this.getOtpTtlSeconds();
    const normalizedEmail = email.trim().toLowerCase();

    await this.redisService.setEx(
      this.buildOtpKey(normalizedEmail),
      ttlSeconds,
      otpHash,
    );
    await this.redisService.del(this.buildAttemptsKey(normalizedEmail));

    this.domainEventPublisher.publish(DomainEventName.PasswordResetOtpRequested, {
      email: normalizedEmail,
      otp,
    });
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      throw new BadRequestException('Enter a valid 6-digit reset code');
    }

    this.assertPasswordPolicy(newPassword);

    const attempts = await this.incrementAttempts(normalizedEmail);

    if (attempts > MAX_RESET_ATTEMPTS) {
      throw new HttpException(
        'Too many incorrect attempts. Request a new reset code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const storedHash = await this.redisService.get(
      this.buildOtpKey(normalizedEmail),
    );

    if (!storedHash) {
      throw new BadRequestException('Reset code expired. Request a new one.');
    }

    const isValid = await bcrypt.compare(normalizedOtp, storedHash);

    if (!isValid) {
      throw new BadRequestException('Incorrect reset code');
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new BadRequestException('Reset code expired. Request a new one.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.usersService.updatePasswordHash(user._id.toString(), passwordHash);

    this.domainEventPublisher.publish(DomainEventName.PasswordChanged, {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name ?? null,
      },
    });

    await this.redisService.del(this.buildOtpKey(normalizedEmail));
    await this.redisService.del(this.buildAttemptsKey(normalizedEmail));
  }

  private assertPasswordPolicy(password: string): void {
    const validator = new IsStrongPasswordConstraint();

    if (!validator.validate(password)) {
      throw new BadRequestException(
        'Password must be at least 15 characters and must not be a commonly used password',
      );
    }
  }

  private generateOtp(): string {
    const fixedOtp = this.configService.get<string>('PASSWORD_RESET_FIXED_OTP');

    if (fixedOtp && /^\d{6}$/.test(fixedOtp)) {
      return fixedOtp;
    }

    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private getOtpTtlSeconds(): number {
    const configured = Number(
      this.configService.get<string>('PASSWORD_RESET_OTP_TTL_SECONDS') ?? '600',
    );

    return Number.isFinite(configured) && configured > 0 ? configured : 600;
  }

  private buildOtpKey(email: string): string {
    return `password-reset-otp:${email}`;
  }

  private buildAttemptsKey(email: string): string {
    return `password-reset-attempts:${email}`;
  }

  private async incrementAttempts(email: string): Promise<number> {
    const key = this.buildAttemptsKey(email);
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
