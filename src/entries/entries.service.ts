import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Entry } from '@prisma/client';
import { randomUUID } from 'crypto';
import { XP_VALUES } from '../config/constants';
import { resolveLevel } from '../config/level.utils';
import { PrismaService } from '../prisma/prisma.service';
import { UserCardsService } from '../user-cards/user-cards.service';
import { CardUnlockPolicy } from '../user-cards/card-unlock.policy';

type XpUpdate = { xpEarned: number; totalXp: number; level: number; levelName: string; leveledUp: boolean };

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCardsService: UserCardsService,
    private readonly unlockPolicy: CardUnlockPolicy,
  ) {}

  private computeStreak(lastEntryAt: Date | null): { streakDays: number; streakBonus: number } {
    if (!lastEntryAt) return { streakDays: 1, streakBonus: 0 };

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const last = new Date(lastEntryAt);
    const lastDay = new Date(last);
    lastDay.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { streakDays: 0, streakBonus: 0 };
    if (diffDays === 1) return { streakDays: -1, streakBonus: XP_VALUES.STREAK_BONUS };
    return { streakDays: 1, streakBonus: 0 };
  }

  async createEntry(input: { userId: string; transcription: string; durationSecs?: number }): Promise<{ entry: Entry; userCard: unknown | null; xpUpdate: XpUpdate }> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException('User not found');

    const decision = await this.unlockPolicy.evaluate({ userId: input.userId, entryId: randomUUID(), transcription: input.transcription, durationSecs: input.durationSecs });

    const durationBonus = (input.durationSecs ?? 0) > 60 ? XP_VALUES.ENTRY_BONUS_LONG : 0;
    const streakMeta = this.computeStreak(user.lastEntryAt);
    let newStreak = user.streakDays;
    if (streakMeta.streakDays === 1) newStreak = 1;
    else if (streakMeta.streakDays === -1) newStreak = user.streakDays + 1;

    const cardXp = decision.unlocked ? this.unlockPolicy.cardXp() : 0;
    const totalEarned = XP_VALUES.ENTRY_BASE + durationBonus + streakMeta.streakBonus + cardXp;

    const entry = await this.prisma.entry.create({
      data: { userId: input.userId, transcription: input.transcription, durationSecs: input.durationSecs, unlockedCard: decision.unlocked, xpEarned: totalEarned },
    });

    let userCard: unknown | null = null;
    if (decision.unlocked) {
      userCard = await this.userCardsService.create({ userId: input.userId, deckCardId: decision.deckCardId, entryId: entry.id, insight: decision.insight, fragment: decision.fragment, xpEarned: cardXp });
    }

    const newTotalXp = user.xp + totalEarned;
    const { level, levelName } = resolveLevel(newTotalXp);
    const leveledUp = level > user.level;

    const updatedUser = await this.prisma.user.update({
      where: { id: input.userId },
      data: { xp: newTotalXp, level, levelName, streakDays: newStreak, lastEntryAt: new Date() },
    });

    return { entry, userCard, xpUpdate: { xpEarned: totalEarned, totalXp: updatedUser.xp, level: updatedUser.level, levelName: updatedUser.levelName, leveledUp } };
  }

  async listEntries(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.entry.findMany({ where: { userId }, include: { userCard: { include: { deckCard: true } } }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.entry.count({ where: { userId } }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async getEntry(userId: string, id: string) {
    const entry = await this.prisma.entry.findUnique({ where: { id }, include: { userCard: { include: { deckCard: true } } } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.userId !== userId) throw new ForbiddenException('Entry does not belong to user');
    return entry;
  }

  async deleteEntry(userId: string, id: string): Promise<void> {
    const entry = await this.prisma.entry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.userId !== userId) throw new ForbiddenException('Entry does not belong to user');

    await this.userCardsService.deleteByEntryId(id);
    await this.prisma.entry.delete({ where: { id } });
  }
}
