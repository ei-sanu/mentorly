import { IsString, IsOptional, IsNotEmpty, MaxLength, Matches } from 'class-validator';

/**
 * Create one personal calendar note (Item 5, 2026-11-20). Same
 * class-validator style as CreateLeaveDto. `date` is date-only
 * ("YYYY-MM-DD"); whether it is a real calendar day ("2026-02-30" is
 * not) is checked in CalendarNotesService.create — a cross-check the
 * shape decorator cannot express.
 */
export class CreateCalendarNoteDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be a valid date in YYYY-MM-DD format' })
  date: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
