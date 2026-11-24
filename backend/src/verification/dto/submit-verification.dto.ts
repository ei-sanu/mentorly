import { IsString, IsInt, IsNotEmpty, IsUrl } from 'class-validator';

export class SubmitVerificationDto {
  @IsString()
  @IsNotEmpty()
  rollNumber: string;

  @IsString()
  @IsNotEmpty()
  degree: string;

  @IsInt()
  @IsNotEmpty()
  graduationYear: number;

  @IsUrl()
  @IsNotEmpty()
  documentUrl: string;
}
