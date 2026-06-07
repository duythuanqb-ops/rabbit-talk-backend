import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  last_name: string;

  @IsDateString(
    {},
    { message: 'date_of_birth must be a valid ISO date (YYYY-MM-DD)' },
  )
  date_of_birth: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

export class CreateUserResponseDto {
  id: number;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;
}

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}

export class RegisterTeacherDto {
  @IsString()
  @IsNotEmpty()
  headline: string;

  @IsNumber()
  @Min(0)
  experience_years: number;

  @IsString()
  @IsOptional()
  video_intro_url?: string;

  @IsString()
  @IsOptional()
  certificates?: string;
}
