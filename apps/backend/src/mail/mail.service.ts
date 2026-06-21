import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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

    await this.sendPlainTextEmail(email, subject, text, `Verification OTP for ${email}: ${otp}`);
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

    await this.sendPlainTextEmail(email, subject, text, `Password reset OTP for ${email}: ${otp}`);
  }

  private async sendPlainTextEmail(
    email: string,
    subject: string,
    text: string,
    logFallback: string,
  ): Promise<void> {
    if (this.shouldSkipSend()) {
      this.logger.log(logFallback);
      return;
    }

    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(`SMTP is not configured. ${logFallback}`);
      return;
    }

    const from = this.getFromAddress();

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
    });
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

  private shouldSkipSend(): boolean {
    return this.configService.get<string>('SMTP_SKIP_SEND') === 'true';
  }
}
