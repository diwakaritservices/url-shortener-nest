import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../validators/password-policy.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'current-password-value' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ example: 'a-unique-passphrase-here', minLength: 15, maxLength: 128 })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
