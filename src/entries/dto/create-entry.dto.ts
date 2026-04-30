import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEntryDto {
  @IsString()
  transcription!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSecs?: number;
}
