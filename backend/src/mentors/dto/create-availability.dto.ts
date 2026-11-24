import { IsString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';

/**
 * Create one weekly availability slot (Item 5, 2026-11-20). Same
 * class-validator style as UpdateMentorProfileDto. Times are 24h "HH:MM";
 * endTime > startTime is checked in MentorsService.addAvailability
 * (cross-field, so it cannot live on one decorator). Duplicates hit the
 * unique index { mentorProfileId, dayOfWeek, startTime } and surface as a
 * human 400 there — the DTO only guarantees the shape.
 */
export class CreateAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be a 24h time like "10:00"' })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be a 24h time like "11:00"' })
  endTime: string;

  @IsString()
  @IsOptional()
  timezone?: string = 'Asia/Kolkata';
}
