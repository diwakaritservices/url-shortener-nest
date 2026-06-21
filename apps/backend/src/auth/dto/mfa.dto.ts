import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class MfaLoginVerifyDto {
  @ApiProperty({ example: 'abc123token' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  mfaToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class DisableMfaDto {
  @ApiProperty({ example: 'current-password-value' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}
