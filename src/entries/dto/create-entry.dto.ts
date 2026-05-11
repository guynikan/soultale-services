import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEntryDto {
  @IsString()
  transcription!: string;

  @IsOptional()
  @IsIn(['voice', 'text'])
  entryKind?: 'voice' | 'text';

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSecs?: number;
}
