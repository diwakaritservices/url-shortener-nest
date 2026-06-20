import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { SignOptions } from 'jsonwebtoken';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(credentials: AuthCredentialsDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(
      credentials.password,
      this.saltRounds,
    );
    const user = await this.usersService.create(
      credentials.email,
      passwordHash,
    );

    return this.createAuthResponse(user);
  }

  async login(credentials: AuthCredentialsDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(credentials.email);

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

    return this.createAuthResponse(user);
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
