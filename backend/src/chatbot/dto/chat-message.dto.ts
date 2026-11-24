import { IsString, IsNotEmpty, MaxLength, IsOptional, IsArray, ValidateNested, IsIn, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One turn of panel history the frontend sends back so the model can
 * follow up ("and what about my next session?"). Session-only: the
 * frontend keeps it in component state and never persists it.
 */
export class ChatHistoryItemDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;
}

/**
 * POST /chatbot/chat body. Message is capped at 1000 characters so a
 * single prompt stays small for the local 3B model; history is capped
 * at 6 turns of 500 characters each.
 */
export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}
