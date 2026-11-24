import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

/**
 * Update a personal calendar note (Item 5, 2026-11-20). Every field is
 * optional — only the supplied fields change — but the service rejects
 * an update that supplies nothing at all, and a text that is empty
 * after trimming. Same class-validator style as CreateCalendarNoteDto.
 */
export class UpdateCalendarNoteDto {
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be a valid date in YYYY-MM-DD format' })
  date?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  text?: string;
}
