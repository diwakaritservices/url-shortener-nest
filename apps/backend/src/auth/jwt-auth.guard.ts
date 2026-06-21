import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@url-shortener/shared';
import { Request } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<AuthenticatedRequest>>();
    const token = this.extractAccessToken(request);
    const payload = await this.authService.verifyAccessToken(token);

    request.user = await this.authService.getProfile(payload.sub);

    return true;
  }

  private extractAccessToken(request: Request): string {
    const cookieToken = this.authCookieService.extractAccessToken(request);

    if (cookieToken) {
      return cookieToken;
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    return token;
  }
}
