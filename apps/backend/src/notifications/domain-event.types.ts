import type { DomainEventName } from './domain-event.constants';

export interface UserContext {
  id: string;
  email: string;
  name?: string | null;
}

export interface UrlShortenedEventPayload {
  ownerId: string;
  fullUrl: string;
  shortId: string;
  publicShortUrl: string;
  customShortId: boolean;
  occurredAt: string;
}

export interface UserRegisteredEventPayload {
  user: UserContext;
  emailVerified: boolean;
  occurredAt: string;
}

export interface UserLoggedInEventPayload {
  user: UserContext;
  mfaUsed: boolean;
  occurredAt: string;
}

export interface VerificationOtpRequestedEventPayload {
  email: string;
  otp: string;
}

export interface PasswordResetOtpRequestedEventPayload {
  email: string;
  otp: string;
}

export interface ApiKeyEventPayload {
  userId: string;
  apiKeyName: string;
  keyPrefix: string;
  occurredAt: string;
}

export interface UserTimestampedEventPayload {
  user: UserContext;
  occurredAt: string;
}

export interface ProfileUpdatedEventPayload {
  user: UserContext;
  previousName?: string | null;
  occurredAt: string;
}

export interface AccountExportedEventPayload {
  user: UserContext;
  linkCount: number;
  occurredAt: string;
}

export type DomainEventPayload = {
  [DomainEventName.UserRegistered]: UserRegisteredEventPayload;
  [DomainEventName.UserLoggedIn]: UserLoggedInEventPayload;
  [DomainEventName.UrlShortened]: UrlShortenedEventPayload;
  [DomainEventName.VerificationOtpRequested]: VerificationOtpRequestedEventPayload;
  [DomainEventName.PasswordResetOtpRequested]: PasswordResetOtpRequestedEventPayload;
  [DomainEventName.ApiKeyCreated]: ApiKeyEventPayload;
  [DomainEventName.ApiKeyRevoked]: ApiKeyEventPayload;
  [DomainEventName.MfaEnabled]: UserTimestampedEventPayload;
  [DomainEventName.MfaDisabled]: UserTimestampedEventPayload;
  [DomainEventName.PasswordChanged]: UserTimestampedEventPayload;
  [DomainEventName.ProfileUpdated]: ProfileUpdatedEventPayload;
  [DomainEventName.AccountExported]: AccountExportedEventPayload;
  [DomainEventName.AccountDeleted]: UserTimestampedEventPayload;
};

export type PublishDomainEventPayload<E extends DomainEventName> = Omit<
  DomainEventPayload[E],
  'occurredAt'
> & {
  occurredAt?: string;
};
