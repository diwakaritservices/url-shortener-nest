import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: '123456',
    description: 'Six-digit email verification code',
  })
  @Matches(/^\d{6}$/, { message: 'Enter a valid 6-digit verification code' })
  otp: string;
}
