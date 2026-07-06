import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const PRODUCT_NAME = 'moklay';

interface TimestampedUserEmailPayload {
  id: string;
  email: string;
  name?: string | null;
  occurredAt: Date;
}

interface AdminUserRegisteredPayload extends TimestampedUserEmailPayload {
  emailVerified: boolean;
}

interface AdminUserSignedInPayload extends TimestampedUserEmailPayload {
  mfaUsed: boolean;
}

interface AdminUrlShortenedPayload {
  ownerId: string;
  ownerEmail: string;
  ownerName?: string | null;
  fullUrl: string;
  shortId: string;
  publicShortUrl: string;
  customShortId: boolean;
  occurredAt: Date;
}

interface UserSignedInPayload extends TimestampedUserEmailPayload {
  mfaUsed: boolean;
}

interface UserApiKeyPayload {
  email: string;
  name?: string | null;
  apiKeyName: string;
  keyPrefix: string;
  occurredAt: Date;
}

interface UserProfileUpdatedPayload extends TimestampedUserEmailPayload {
  previousName?: string | null;
}

interface UserAccountExportedPayload extends TimestampedUserEmailPayload {
  linkCount: number;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    const subject = 'Verify your moklay email';
    const text = [
      'Welcome to moklay!',
      '',
      `Your verification code is: ${otp}`,
      '',
      'This code expires in 10 minutes.',
      '',
      'If you did not create an account, you can ignore this email.',
    ].join('\n');

    await this.sendUserEmail(
      email,
      subject,
      text,
      this.buildSimpleHtml('Verify your email', text),
      `Verification OTP for ${email}: ${otp}`,
    );
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    const subject = 'Reset your moklay password';
    const text = [
      'We received a request to reset your moklay password.',
      '',
      `Your reset code is: ${otp}`,
      '',
      'This code expires in 10 minutes.',
      '',
      'If you did not request a password reset, you can ignore this email.',
    ].join('\n');

    await this.sendUserEmail(
      email,
      subject,
      text,
      this.buildSimpleHtml('Reset your password', text),
      `Password reset OTP for ${email}: ${otp}`,
    );
  }

  async sendUserSignedInNotification(
    payload: UserSignedInPayload,
  ): Promise<void> {
    const subject = 'New sign-in to your moklay account';
    const lines = [
      'Your moklay account was just used to sign in.',
      '',
      `Account: ${payload.email}`,
      `MFA used: ${payload.mfaUsed ? 'Yes' : 'No'}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If this was not you, reset your password and contact support immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'New sign-in detected',
      lines,
      `Sign-in notification for ${payload.email}`,
    );
  }

  async sendUserApiKeyCreatedNotification(
    payload: UserApiKeyPayload,
  ): Promise<void> {
    const subject = 'New API key created on your moklay account';
    const lines = [
      'A new API key was created for your account.',
      '',
      `Key name: ${payload.apiKeyName}`,
      `Key prefix: ${payload.keyPrefix}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not create this key, revoke it immediately and change your password.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'API key created',
      lines,
      `API key created notification for ${payload.email}`,
    );
  }

  async sendUserApiKeyRevokedNotification(
    payload: UserApiKeyPayload,
  ): Promise<void> {
    const subject = 'API key revoked on your moklay account';
    const lines = [
      'An API key was revoked on your account.',
      '',
      `Key name: ${payload.apiKeyName}`,
      `Key prefix: ${payload.keyPrefix}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not revoke this key, secure your account immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'API key revoked',
      lines,
      `API key revoked notification for ${payload.email}`,
    );
  }

  async sendUserMfaEnabledNotification(
    payload: TimestampedUserEmailPayload,
  ): Promise<void> {
    const subject = 'Multi-factor authentication enabled';
    const lines = [
      'Multi-factor authentication (MFA) is now enabled on your moklay account.',
      '',
      `Account: ${payload.email}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not enable MFA, contact support immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'MFA enabled',
      lines,
      `MFA enabled notification for ${payload.email}`,
    );
  }

  async sendUserMfaDisabledNotification(
    payload: TimestampedUserEmailPayload,
  ): Promise<void> {
    const subject = 'Multi-factor authentication disabled';
    const lines = [
      'Multi-factor authentication (MFA) was disabled on your moklay account.',
      '',
      `Account: ${payload.email}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not disable MFA, secure your account immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'MFA disabled',
      lines,
      `MFA disabled notification for ${payload.email}`,
    );
  }

  async sendUserPasswordChangedNotification(
    payload: TimestampedUserEmailPayload,
  ): Promise<void> {
    const subject = 'Your moklay password was changed';
    const lines = [
      'The password for your moklay account was changed.',
      '',
      `Account: ${payload.email}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not make this change, reset your password immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'Password changed',
      lines,
      `Password changed notification for ${payload.email}`,
    );
  }

  async sendUserProfileUpdatedNotification(
    payload: UserProfileUpdatedPayload,
  ): Promise<void> {
    const subject = 'Your moklay profile was updated';
    const lines = [
      'Your moklay profile was updated.',
      '',
      `Account: ${payload.email}`,
      `Previous name: ${payload.previousName?.trim() || 'Not set'}`,
      `New name: ${payload.name?.trim() || 'Not set'}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'Profile updated',
      lines,
      `Profile updated notification for ${payload.email}`,
    );
  }

  async sendUserAccountExportedNotification(
    payload: UserAccountExportedPayload,
  ): Promise<void> {
    const subject = 'Your moklay account data was exported';
    const lines = [
      'An export of your moklay account data was downloaded.',
      '',
      `Account: ${payload.email}`,
      `Links included: ${payload.linkCount}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not request this export, secure your account immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'Account data exported',
      lines,
      `Account export notification for ${payload.email}`,
    );
  }

  async sendUserAccountDeletedNotification(
    payload: TimestampedUserEmailPayload,
  ): Promise<void> {
    const subject = 'Your moklay account was deleted';
    const lines = [
      'Your moklay account and associated data have been deleted.',
      '',
      `Account: ${payload.email}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
      '',
      'If you did not request this deletion, contact support immediately.',
    ];

    await this.sendUserSecurityEmail(
      payload.email,
      subject,
      'Account deleted',
      lines,
      `Account deleted notification for ${payload.email}`,
    );
  }

  async sendAdminUserRegisteredNotification(
    payload: AdminUserRegisteredPayload,
  ): Promise<void> {
    const subject = `[${PRODUCT_NAME}] New registration: ${payload.email}`;
    const lines = [
      'A new user registered on moklay.',
      '',
      `Email: ${payload.email}`,
      `User ID: ${payload.id}`,
      `Name: ${payload.name?.trim() || 'Not set'}`,
      `Email verified: ${payload.emailVerified ? 'Yes' : 'No (verification pending)'}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
    ];

    await this.sendAdminEmail(
      subject,
      lines.join('\n'),
      this.buildAdminHtml('New user registration', lines),
      `Registration notification for ${payload.email}`,
    );
  }

  async sendAdminUserSignedInNotification(
    payload: AdminUserSignedInPayload,
  ): Promise<void> {
    const subject = `[${PRODUCT_NAME}] User signed in: ${payload.email}`;
    const lines = [
      'A user signed in to moklay.',
      '',
      `Email: ${payload.email}`,
      `User ID: ${payload.id}`,
      `Name: ${payload.name?.trim() || 'Not set'}`,
      `MFA used: ${payload.mfaUsed ? 'Yes' : 'No'}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
    ];

    await this.sendAdminEmail(
      subject,
      lines.join('\n'),
      this.buildAdminHtml('User sign-in', lines),
      `Sign-in notification for ${payload.email}`,
    );
  }

  async sendAdminUrlShortenedNotification(
    payload: AdminUrlShortenedPayload,
  ): Promise<void> {
    const subject = `[${PRODUCT_NAME}] URL shortened by ${payload.ownerEmail}`;
    const lines = [
      'A user created a new short link.',
      '',
      `Account email: ${payload.ownerEmail}`,
      `User ID: ${payload.ownerId}`,
      `Name: ${payload.ownerName?.trim() || 'Not set'}`,
      `Original URL: ${payload.fullUrl}`,
      `Short code: ${payload.shortId}`,
      `Short URL: ${payload.publicShortUrl}`,
      `Custom short code: ${payload.customShortId ? 'Yes' : 'No'}`,
      `Time (UTC): ${this.formatTimestamp(payload.occurredAt)}`,
    ];

    await this.sendAdminEmail(
      subject,
      lines.join('\n'),
      this.buildAdminHtml('URL shortened', lines),
      `URL shortened notification for ${payload.ownerEmail}: ${payload.shortId}`,
    );
  }

  private async sendUserSecurityEmail(
    email: string,
    subject: string,
    title: string,
    lines: string[],
    logFallback: string,
  ): Promise<void> {
    const text = lines.join('\n');

    await this.sendUserEmail(
      email,
      subject,
      text,
      this.buildSimpleHtml(title, text),
      logFallback,
    );
  }

  private async sendUserEmail(
    email: string,
    subject: string,
    text: string,
    html: string,
    logFallback: string,
  ): Promise<void> {
    if (this.shouldSkipSend()) {
      this.logger.log(`[SMTP_SKIP_SEND] ${logFallback}`);
      return;
    }

    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(`SMTP is not configured. ${logFallback}`);
      return;
    }

    await transporter.sendMail({
      from: this.getFromAddress(),
      to: email,
      replyTo: this.getReplyToAddress(),
      subject,
      text,
      html,
      headers: this.buildDeliverabilityHeaders(),
    });
  }

  private async sendAdminEmail(
    subject: string,
    text: string,
    html: string,
    logFallback: string,
  ): Promise<void> {
    if (!this.isAdminNotifyEnabled()) {
      this.logger.debug(`Admin notifications disabled. ${logFallback}`);
      return;
    }

    if (this.shouldSkipSend()) {
      this.logger.log(`[SMTP_SKIP_SEND] ${logFallback}`);
      return;
    }

    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(`SMTP is not configured. ${logFallback}`);
      return;
    }

    await transporter.sendMail({
      from: this.getFromAddress(),
      to: this.getAdminNotifyEmail(),
      replyTo: this.getReplyToAddress(),
      subject,
      text,
      html,
      headers: this.buildDeliverabilityHeaders(),
    });
  }

  private buildDeliverabilityHeaders(): Record<string, string> {
    const domain = this.extractDomainFromAddress(this.getFromAddress());

    return {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
      'Message-ID': `<${randomUUID()}@${domain}>`,
    };
  }

  private buildSimpleHtml(title: string, text: string): string {
    const body = text
      .split('\n')
      .map((line) => {
        if (!line.trim()) {
          return '<p>&nbsp;</p>';
        }

        return `<p>${this.escapeHtml(line)}</p>`;
      })
      .join('\n');

    return this.wrapHtml(title, body);
  }

  private buildAdminHtml(title: string, lines: string[]): string {
    const body = lines
      .map((line) => {
        if (!line.trim()) {
          return '<p>&nbsp;</p>';
        }

        const escaped = this.escapeHtml(line);
        const formatted = escaped.replace(
          /^(Email|User ID|Name|Email verified|MFA used|Account email|Original URL|Short code|Short URL|Custom short code|Time \(UTC\)|Account|Key name|Key prefix|Links included|Previous name|New name): (.+)$/,
          '<strong>$1:</strong> $2',
        );

        return `<p>${formatted}</p>`;
      })
      .join('\n');

    return this.wrapHtml(title, body, 'Automated notification from moklay.');
  }

  private wrapHtml(
    title: string,
    body: string,
    footer = 'This is an automated message from moklay.',
  ): string {
    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${this.escapeHtml(title)}</title>`,
      '</head>',
      `<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.5;">`,
      `<h2 style="font-size: 18px; margin: 0 0 16px;">${this.escapeHtml(title)}</h2>`,
      body,
      `<p style="color: #6b7280; font-size: 12px; margin-top: 24px;">${this.escapeHtml(footer)}</p>`,
      '</body>',
      '</html>',
    ].join('\n');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      return null;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');
    const secure =
      this.configService.get<string>('SMTP_SECURE') === 'true' || port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    return this.transporter;
  }

  private getFromAddress(): string {
    return (
      this.configService.get<string>('SMTP_FROM') ??
      this.configService.get<string>('SMTP_USER') ??
      'noreply@moklay.app'
    );
  }

  private getReplyToAddress(): string {
    return (
      this.configService.get<string>('SECURITY_CONTACT_EMAIL') ??
      this.getFromAddress()
    );
  }

  private getAdminNotifyEmail(): string {
    return (
      this.configService.get<string>('ADMIN_NOTIFY_EMAIL') ??
      'hello@diwakarit.com'
    );
  }

  private isAdminNotifyEnabled(): boolean {
    return this.configService.get<string>('ADMIN_NOTIFY_ENABLED') !== 'false';
  }

  private shouldSkipSend(): boolean {
    return this.configService.get<string>('SMTP_SKIP_SEND') === 'true';
  }

  private extractDomainFromAddress(address: string): string {
    const emailMatch = address.match(/<([^>]+)>/);
    const normalized = (emailMatch?.[1] ?? address).trim();
    const atIndex = normalized.lastIndexOf('@');

    if (atIndex === -1) {
      return 'moklay.app';
    }

    return normalized.slice(atIndex + 1);
  }
}
