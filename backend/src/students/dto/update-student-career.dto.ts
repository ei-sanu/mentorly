import { IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateStudentCareerDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  careerGoals?: string[];

  @IsString()
  @IsOptional()
  targetRole?: string;

  @IsString()
  @IsOptional()
  targetIndustry?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  currentSkills?: string[];
}
