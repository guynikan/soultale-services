import { IsEnum } from 'class-validator';
import { QuestStatus } from '@prisma/client';

export class UpdateQuestDto {
  @IsEnum(QuestStatus)
  status!: QuestStatus;
}
