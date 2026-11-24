import { IsInt, IsString, IsOptional, Min, Max } from 'class-validator';

export class CreateFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comments?: string;

  // Student specific feedback fields
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  usefulness?: number;

  @IsString()
  @IsOptional()
  learningOutcome?: string;

  // Mentor specific feedback fields
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  preparedness?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  progressScore?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  engagement?: number;
}
