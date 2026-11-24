import { IsString, IsNotEmpty, IsDateString, IsOptional, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  timezone?: string = 'Asia/Kolkata';

  @IsString()
  @IsOptional()
  notes?: string;

  /**
   * (Item 6, 2026-11-20) Optional meeting link, USER-PROVIDED ONLY —
   * there is no Meet/Zoom integration and no link is ever generated.
   * http/https only (same rule as the Step-4 proof link: a real URL with
   * an http(s) scheme). An empty string counts as "no link" — the
   * Transform turns it into undefined before validation, so @IsOptional
   * skips it instead of rejecting it. The service re-validates with the
   * same new-URL + protocol check, which is what also guards PATCH
   * (updateSession takes dto: any and has no DTO validation).
   */
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Meeting link must be a valid http(s) URL' })
  meetingUrl?: string;
}
