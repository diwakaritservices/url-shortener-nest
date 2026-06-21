import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty({ example: '664f1f2bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Alex Morgan', nullable: true })
  name: string | null;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ example: false })
  mfaEnabled: boolean;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  accessToken?: string;

  @ApiProperty({ type: AuthenticatedUserDto, required: false })
  user?: AuthenticatedUserDto;

  @ApiProperty({ example: false, required: false })
  mfaRequired?: boolean;

  @ApiProperty({ example: 'abc123token', required: false })
  mfaToken?: string;
}

export class MfaSetupResponseDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP' })
  secret: string;

  @ApiProperty({
    example: 'otpauth://totp/moklay:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=moklay',
  })
  otpauthUrl: string;
}
