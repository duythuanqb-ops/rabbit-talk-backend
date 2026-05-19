import { IsNotEmpty, IsString } from 'class-validator';

export class SendRequestDto {
  @IsNotEmpty()
  @IsString()
  receiverIdentifier: string;
}
