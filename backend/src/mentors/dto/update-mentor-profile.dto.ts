import { IsString, IsInt, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateMentorProfileDto {
  @IsInt()
  @IsOptional()
  graduationYear?: number;

  @IsString()
  @IsOptional()
  programme?: string;

  @IsString()
  @IsOptional()
  currentCompany?: string;

  @IsString()
  @IsOptional()
  currentDesignation?: string;

  @IsInt()
  @IsOptional()
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expertise?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentoringAreas?: string[];

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  careerSummary?: string;

  @IsInt()
  @IsOptional()
  maxCapacity?: number;

  @IsBoolean()
  @IsOptional()
  acceptingMentees?: boolean;

  @IsBoolean()
  @IsOptional()
  profileVisibility?: boolean;
}
