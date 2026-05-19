import { IsBoolean, IsNotEmpty } from 'class-validator';

export class RespondRequestDto {
  @IsNotEmpty()
  @IsBoolean()
  accept: boolean;
}
