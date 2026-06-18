import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateUrlDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  fullUrl: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{3,64}$/)
  shortId?: string;
}
