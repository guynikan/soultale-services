import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page: number, limit: number, questId?: string) {
    const skip = (page - 1) * limit;
    const where = { userId, ...(questId ? { questId } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.userCard.findMany({ where, include: { deckCard: true }, orderBy: { unlockedAt: 'desc' }, skip, take: limit }),
      this.prisma.userCard.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async getById(userId: string, id: string) {
    const card = await this.prisma.userCard.findFirst({ where: { id, userId }, include: { deckCard: true } });
    if (!card) throw new NotFoundException('User card not found');
    return card;
  }

  async hasUnlocked(userId: string, deckCardId: string): Promise<boolean> {
    return (await this.prisma.userCard.count({ where: { userId, deckCardId } })) > 0;
  }

  async countToday(userId: string, todayStart: Date, tomorrowStart: Date): Promise<number> {
    return this.prisma.userCard.count({ where: { userId, unlockedAt: { gte: todayStart, lt: tomorrowStart } } });
  }

  async latestUnlock(userId: string) {
    return this.prisma.userCard.findFirst({ where: { userId }, orderBy: { unlockedAt: 'desc' } });
  }

  async create(params: { userId: string; deckCardId: string; entryId: string; insight: string; fragment: string; xpEarned: number }) {
    return this.prisma.userCard.create({ data: params, include: { deckCard: true } });
  }

  async deleteByEntryId(entryId: string): Promise<void> {
    await this.prisma.userCard.deleteMany({ where: { entryId } });
  }
}
