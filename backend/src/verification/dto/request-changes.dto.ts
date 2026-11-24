import { IsNotEmpty, IsString } from 'class-validator';

export class RequestChangesDto {
  @IsNotEmpty()
  @IsString()
  explanation: string;
}
