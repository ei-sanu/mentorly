import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MentorQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  skills?: string; // Comma separated list of skills

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  role?: string; // target role / currentDesignation

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  experienceMin?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  experienceMax?: number;

  @IsString()
  @IsOptional()
  availability?: string; // Saturday, Sunday, etc.

  @IsBoolean()
  @IsOptional()
  acceptingMentees?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsOptional()
  sort?: string = 'experienceYears_desc'; // experienceYears_desc, experienceYears_asc, etc.
}
