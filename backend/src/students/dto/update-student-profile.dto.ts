import { IsString, IsInt, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateStudentProfileDto {
  @IsString()
  @IsOptional()
  programme?: string;

  @IsString()
  @IsOptional()
  school?: string;

  @IsInt()
  @IsOptional()
  yearOfStudy?: number;

  @IsInt()
  @IsOptional()
  graduationYear?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];

  @IsString()
  @IsOptional()
  mentoringNeeds?: string;

  @IsString()
  @IsOptional()
  preferredFrequency?: string;

  @IsBoolean()
  @IsOptional()
  profileVisibility?: boolean;
}
