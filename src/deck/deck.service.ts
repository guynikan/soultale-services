import { Injectable, NotFoundException } from '@nestjs/common';
import { CardAgency, CardDimension, CardMoment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeckService {
  private comboCache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  private key(moment: CardMoment, agency: CardAgency, dimension: CardDimension): string {
    return `${moment}|${agency}|${dimension}`;
  }

  async warmupCache(): Promise<void> {
    const cards = await this.prisma.deckCard.findMany({ select: { id: true, moment: true, agency: true, dimension: true } });
    this.comboCache.clear();
    for (const card of cards) this.comboCache.set(this.key(card.moment, card.agency, card.dimension), card.id);
  }

  async findByCombo(moment: CardMoment, agency: CardAgency, dimension: CardDimension) {
    if (!this.comboCache.size) await this.warmupCache();
    const id = this.comboCache.get(this.key(moment, agency, dimension));
    if (!id) return null;
    return this.prisma.deckCard.findUnique({ where: { id } });
  }

  async getDeckForUser(userId: string) {
    const deck = await this.prisma.deckCard.findMany({
      orderBy: { order: 'asc' },
      include: { userCards: { where: { userId }, orderBy: { unlockedAt: 'desc' }, take: 1 } },
    });

    return deck.map((item) => {
      const userCard = item.userCards[0] ?? null;
      return {
        id: item.id,
        title: item.title,
        order: item.order,
        unlocked: Boolean(userCard),
        imageUrl: userCard ? item.imageUrl : null,
        userCard: userCard
          ? {
              id: userCard.id,
              insight: userCard.insight,
              fragment: userCard.fragment,
              unlockedAt: userCard.unlockedAt,
            }
          : null,
      };
    });
  }

  async getDeckCardForUser(userId: string, id: string) {
    const item = await this.prisma.deckCard.findUnique({
      where: { id },
      include: { userCards: { where: { userId }, orderBy: { unlockedAt: 'desc' }, take: 1 } },
    });

    if (!item) throw new NotFoundException('Deck card not found');

    const userCard = item.userCards[0] ?? null;
    return {
      id: item.id,
      title: item.title,
      order: item.order,
      unlocked: Boolean(userCard),
      imageUrl: userCard ? item.imageUrl : null,
      userCard: userCard
        ? {
            id: userCard.id,
            insight: userCard.insight,
            fragment: userCard.fragment,
            unlockedAt: userCard.unlockedAt,
          }
        : null,
    };
  }
}
