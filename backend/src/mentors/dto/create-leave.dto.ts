import { IsString, IsOptional, IsDateString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Create one dated mentor leave (Item 5, 2026-11-20). Same
 * class-validator style as UpdateMentorProfileDto. endDate >= startDate
 * and no-overlap-with-existing-leaves are checked in
 * MentorsService.addLeave (cross-field / cross-row, so they cannot live
 * on one decorator). Dates are date-only ("2026-11-25") or ISO strings;
 * the service normalises them to start-of-day / end-of-day.
 */
export class CreateLeaveDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
