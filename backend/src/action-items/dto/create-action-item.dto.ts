import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class CreateActionItemDto {
  @IsString()
  @IsNotEmpty()
  task: string;

  @IsString()
  @IsNotEmpty()
  assignedToId: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @IsString()
  @IsOptional()
  goalId?: string;
}
