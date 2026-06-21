import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/password-policy.validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'XXXX.DUMMY.TOKEN.XXXX' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  turnstileToken: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;

  @ApiProperty({ example: 'a-unique-passphrase-here', minLength: 15, maxLength: 128 })
  @IsString()
  @IsStrongPassword()
  newPassword: string;

  @ApiProperty({ example: 'XXXX.DUMMY.TOKEN.XXXX' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  turnstileToken: string;
}
