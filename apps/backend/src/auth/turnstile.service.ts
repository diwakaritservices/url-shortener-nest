import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

const TURNSTILE_VERIFY_TIMEOUT_MS = 10_000;

@Injectable()
export class TurnstileService {
  private readonly siteverifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(private readonly configService: ConfigService) {}

  async verifyToken(token: string, remoteIp?: string): Promise<void> {
    if (this.shouldSkipVerification()) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TURNSTILE_VERIFY_TIMEOUT_MS,
    );

    let response: Response;

    try {
      response = await fetch(this.siteverifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.getSecretKey(),
          response: token,
          remoteip: remoteIp,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(
          'Human verification is temporarily unavailable. Try again shortly.',
        );
      }

      throw new ServiceUnavailableException(
        'Human verification is temporarily unavailable. Try again shortly.',
      );
    } finally {
      clearTimeout(timeout);
    }

    const result = (await response.json()) as TurnstileResponse;

    if (!result.success) {
      throw new BadRequestException('Human verification failed');
    }
  }

  private getSecretKey(): string {
    const secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!secretKey && isProduction) {
      throw new Error('TURNSTILE_SECRET_KEY is required in production');
    }

    return secretKey ?? '1x0000000000000000000000000000000AA';
  }

  private shouldSkipVerification(): boolean {
    return (
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      this.configService.get<string>('TURNSTILE_SKIP_VERIFY') === 'true'
    );
  }
}
