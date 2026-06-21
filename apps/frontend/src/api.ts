import type {
  ApiKeySummary,
  AuthResponse,
  AuthenticatedUser,
  CreateApiKeyResponse,
  MfaSetupResponse,
  ShortUrlConflictErrorBody,
  ShortUrlResponse,
} from '@url-shortener/shared';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
);
const PUBLIC_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_PUBLIC_BASE_URL ??
    (API_BASE_URL === '/api' ? window.location.origin : API_BASE_URL),
);

export type AuthUser = AuthenticatedUser;
export type ShortLink = ShortUrlResponse;
export type ApiKey = ApiKeySummary;
export type { AuthResponse, ShortUrlResponse, CreateApiKeyResponse };

export class ApiError extends Error {
  readonly status: number;
  readonly existingUrl?: ShortUrlResponse;

  constructor(message: string, status: number, existingUrl?: ShortUrlResponse) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.existingUrl = existingUrl;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as
      | ShortUrlConflictErrorBody
      | { message?: string | string[] };

    const message = body.message;

    if (Array.isArray(message)) {
      return new ApiError(
        message.join(', '),
        response.status,
        'existingUrl' in body ? body.existingUrl : undefined,
      );
    }

    return new ApiError(
      message ?? `Request failed with status ${response.status}`,
      response.status,
      'existingUrl' in body ? body.existingUrl : undefined,
    );
  } catch {
    return new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
    );
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function login(
  email: string,
  password: string,
  turnstileToken: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken }),
  });
}

export function register(
  email: string,
  password: string,
  turnstileToken: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken }),
  });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
  });
}

export function verifyEmail(otp: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export function resendVerificationEmail(): Promise<void> {
  return request<void>('/auth/resend-verification', {
    method: 'POST',
  });
}

export function getProfile(): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/me');
}

export function updateProfile(name: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return request<void>('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface AccountExport {
  exportedAt: string;
  profile: AuthenticatedUser;
  links: ShortUrlResponse[];
}

export function exportAccountData(): Promise<AccountExport> {
  return request<AccountExport>('/auth/me/export');
}

export function deleteAccount(): Promise<void> {
  return request<void>('/auth/me', {
    method: 'DELETE',
  });
}

export function getLinks(archived = false): Promise<ShortUrlResponse[]> {
  return request<ShortUrlResponse[]>(
    `/urls${archived ? '?archived=true' : ''}`,
  );
}

export function createLink(
  fullUrl: string,
  shortId?: string,
): Promise<ShortUrlResponse> {
  return request<ShortUrlResponse>('/urls', {
    method: 'POST',
    body: JSON.stringify({
      fullUrl,
      shortId: shortId?.trim() || undefined,
    }),
  });
}

export function archiveLink(shortId: string): Promise<ShortUrlResponse> {
  return request<ShortUrlResponse>(`/urls/${shortId}/archive`, {
    method: 'PATCH',
  });
}

export function unarchiveLink(shortId: string): Promise<ShortUrlResponse> {
  return request<ShortUrlResponse>(`/urls/${shortId}/unarchive`, {
    method: 'PATCH',
  });
}

export function getShortUrl(shortId: string): string {
  return `${PUBLIC_BASE_URL}/${shortId}`;
}

export function getApiKeys(): Promise<ApiKeySummary[]> {
  return request<ApiKeySummary[]>('/v1/api-keys');
}

export function createApiKey(name?: string): Promise<CreateApiKeyResponse> {
  return request<CreateApiKeyResponse>('/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify({
      name: name?.trim() || undefined,
    }),
  });
}

export function revokeApiKey(apiKeyId: string): Promise<ApiKeySummary> {
  return request<ApiKeySummary>(`/v1/api-keys/${apiKeyId}`, {
    method: 'DELETE',
  });
}

export function verifyMfaLogin(
  mfaToken: string,
  code: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/mfa/verify-login', {
    method: 'POST',
    body: JSON.stringify({ mfaToken, code }),
  });
}

export function beginMfaSetup(): Promise<MfaSetupResponse> {
  return request<MfaSetupResponse>('/auth/mfa/setup', {
    method: 'POST',
  });
}

export function enableMfa(code: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function disableMfa(
  password: string,
  code: string,
): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  });
}

export function forgotPassword(
  email: string,
  turnstileToken: string,
): Promise<void> {
  return request<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, turnstileToken }),
  });
}

export function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
  turnstileToken: string,
): Promise<void> {
  return request<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword, turnstileToken }),
  });
}
