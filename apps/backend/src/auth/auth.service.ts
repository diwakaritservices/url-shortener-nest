import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, AuthenticatedUser } from '@url-shortener/shared';
import * as bcrypt from 'bcryptjs';
import type { SignOptions } from 'jsonwebtoken';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { EmailVerificationService } from './email-verification.service';
import { MfaService } from './mfa.service';
import { PasswordResetService } from './password-reset.service';
import { IsStrongPasswordConstraint } from './validators/password-policy.validator';

export type { AuthenticatedUser, AuthResponse };

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mfaService: MfaService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  async signup(credentials: AuthCredentialsDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(
      credentials.password,
      this.saltRounds,
    );
    const emailVerified = !this.emailVerificationService.isVerificationRequired();
    const user = await this.usersService.create(
      credentials.email,
      passwordHash,
      { emailVerified },
    );

    if (!emailVerified) {
      await this.emailVerificationService.sendVerificationOtp(user);
    }

    return this.createAuthResponse(user);
  }

  async login(credentials: AuthCredentialsDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithMfaSecrets(
      credentials.email,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      credentials.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.mfaService.isMfaEnabled(user)) {
      return this.mfaService.createLoginChallenge(user);
    }

    return this.createAuthResponse(user);
  }

  async verifyMfaLogin(mfaToken: string, code: string): Promise<AuthResponse> {
    const { user } = await this.mfaService.completeLogin(mfaToken, code);

    return this.createAuthResponse(user);
  }

  beginMfaSetup(userId: string, email: string) {
    return this.mfaService.beginSetup(userId, email);
  }

  enableMfa(userId: string, code: string): Promise<AuthenticatedUser> {
    return this.mfaService.enableMfa(userId, code);
  }

  disableMfa(
    userId: string,
    password: string,
    code: string,
  ): Promise<AuthenticatedUser> {
    return this.mfaService.disableMfa(userId, password, code);
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.passwordResetService.requestReset(email);
  }

  resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    return this.passwordResetService.resetPassword(email, otp, newPassword);
  }

  async verifyEmail(userId: string, otp: string): Promise<AuthenticatedUser> {
    const user = await this.emailVerificationService.verifyOtp(userId, otp);

    return this.toAuthenticatedUser(user);
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    await this.emailVerificationService.resendVerificationOtp(user);
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.toAuthenticatedUser(user);
  }

  async updateProfile(
    userId: string,
    name: string,
  ): Promise<AuthenticatedUser> {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new BadRequestException('Name cannot be empty');
    }

    const user = await this.usersService.updateName(userId, normalizedName);

    return this.toAuthenticatedUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    this.assertPasswordPolicy(newPassword);

    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
    await this.usersService.updatePasswordHash(userId, passwordHash);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.usersService.deleteAccountAndData(userId);
  }

  createAccessToken(user: AuthenticatedUser): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        secret: this.getJwtSecret(),
        expiresIn: this.getJwtExpiresIn(),
      },
    );
  }

  private assertPasswordPolicy(password: string): void {
    const validator = new IsStrongPasswordConstraint();

    if (!validator.validate(password)) {
      throw new BadRequestException(
        'Password must be at least 15 characters and must not be a commonly used password',
      );
    }
  }

  private async createAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const safeUser = this.toAuthenticatedUser(user);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: safeUser.id,
        email: safeUser.email,
      },
      {
        secret: this.getJwtSecret(),
        expiresIn: this.getJwtExpiresIn(),
      },
    );

    return {
      accessToken,
      user: safeUser,
    };
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

  private getJwtSecret(): string {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!jwtSecret && isProduction) {
      throw new Error('JWT_SECRET is required in production');
    }

    return jwtSecret ?? 'local-development-secret';
  }

  private getJwtExpiresIn(): SignOptions['expiresIn'] {
    return (
      this.configService.get<SignOptions['expiresIn']>('JWT_EXPIRES_IN') ?? '1d'
    );
  }
}
