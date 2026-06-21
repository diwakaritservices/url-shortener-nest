import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/password-policy.validator';

export class AuthCredentialsDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'a-unique-passphrase-here',
    minLength: 15,
    maxLength: 128,
  })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({
    example: 'XXXX.DUMMY.TOKEN.XXXX',
    description: 'Cloudflare Turnstile verification token.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  turnstileToken: string;
}
