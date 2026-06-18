import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const fetchMock = jest.fn();
  let service: TurnstileService;

  beforeEach(async () => {
    fetchMock.mockReset();
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'TURNSTILE_SECRET_KEY') {
                return 'secret-key';
              }

              if (key === 'NODE_ENV') {
                return 'production';
              }

              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(TurnstileService);
  });

  it('validates a successful Turnstile token', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    await expect(
      service.verifyToken('turnstile-token', '203.0.113.10'),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: 'secret-key',
          response: 'turnstile-token',
          remoteip: '203.0.113.10',
        }),
      },
    );
  });

  it('rejects a failed Turnstile token', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    });

    await expect(service.verifyToken('bad-token')).rejects.toThrow(
      BadRequestException,
    );
  });
});
