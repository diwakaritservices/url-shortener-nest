export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export interface UpdateProfileRequest {
  name: string;
}

export interface AuthResponse {
  accessToken?: string;
  user?: AuthenticatedUser;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  turnstileToken: string;
}

export interface VerifyEmailRequest {
  otp: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface MfaLoginVerifyRequest {
  mfaToken: string;
  code: string;
}

export interface ForgotPasswordRequest {
  email: string;
  turnstileToken: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  turnstileToken: string;
}

export interface DisableMfaRequest {
  password: string;
  code: string;
}
