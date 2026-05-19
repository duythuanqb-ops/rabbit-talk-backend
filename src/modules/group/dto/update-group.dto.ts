import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}
