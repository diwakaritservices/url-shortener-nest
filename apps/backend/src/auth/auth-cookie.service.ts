import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { SignOptions } from 'jsonwebtoken';

export const AUTH_COOKIE_NAME = 'moklay_access_token';

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  setAccessTokenCookie(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, this.getCookieOptions());
  }

  clearAccessTokenCookie(response: Response): void {
    response.clearCookie(AUTH_COOKIE_NAME, this.getClearCookieOptions());
  }

  extractAccessToken(request: Request): string | null {
    const cookieHeader = request.cookies?.[AUTH_COOKIE_NAME];

    if (typeof cookieHeader === 'string' && cookieHeader.length > 0) {
      return cookieHeader;
    }

    return null;
  }

  private getCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: '/',
      maxAge: this.getCookieMaxAgeMs(),
    };
  }

  private getClearCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
  } {
    const { maxAge: _maxAge, ...options } = this.getCookieOptions();
    return options;
  }

  private getCookieMaxAgeMs(): number {
    const expiresIn =
      this.configService.get<SignOptions['expiresIn']>('JWT_EXPIRES_IN') ??
      '1d';

    if (typeof expiresIn === 'number') {
      return expiresIn * 1000;
    }

    const match = /^(\d+)([smhd])$/.exec(expiresIn);

    if (!match) {
      return 86_400_000;
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60_000;
      case 'h':
        return value * 3_600_000;
      case 'd':
        return value * 86_400_000;
      default:
        return 86_400_000;
    }
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
