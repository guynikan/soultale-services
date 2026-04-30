import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QuestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_TRANSITIONS = new Map<QuestStatus, QuestStatus[]>([
  [QuestStatus.LATENT, [QuestStatus.ACTIVE, QuestStatus.ABANDONED]],
  [QuestStatus.ACTIVE, [QuestStatus.CONCLUDED, QuestStatus.ABANDONED]],
]);

@Injectable()
export class QuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, status?: QuestStatus) {
    return this.prisma.quest.findMany({ where: { userId, ...(status ? { status } : {}) }, orderBy: { detectedAt: 'desc' } });
  }

  async getOne(userId: string, id: string) {
    const quest = await this.prisma.quest.findUnique({ where: { id }, include: { userCards: { include: { deckCard: true }, orderBy: { unlockedAt: 'asc' } } } });
    if (!quest) throw new NotFoundException('Quest not found');
    if (quest.userId !== userId) throw new ForbiddenException('Quest does not belong to user');
    return quest;
  }

  async updateStatus(userId: string, id: string, nextStatus: QuestStatus) {
    const quest = await this.prisma.quest.findUnique({ where: { id } });
    if (!quest) throw new NotFoundException('Quest not found');
    if (quest.userId !== userId) throw new ForbiddenException('Quest does not belong to user');

    const allowed = ALLOWED_TRANSITIONS.get(quest.status) ?? [];
    if (!allowed.includes(nextStatus)) throw new BadRequestException(`Invalid quest transition from ${quest.status} to ${nextStatus}`);

    return this.prisma.quest.update({
      where: { id },
      data: {
        status: nextStatus,
        activatedAt: nextStatus === QuestStatus.ACTIVE ? new Date() : quest.activatedAt,
        concludedAt: nextStatus === QuestStatus.CONCLUDED ? new Date() : quest.concludedAt,
      },
    });
  }
}
