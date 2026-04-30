import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { CARD_GATES, XP_VALUES } from '../config/constants';
import { DeckService } from '../deck/deck.service';
import { UserCardsService } from './user-cards.service';

export type CardDecision =
  | { unlocked: false; reason: 'too_short' | 'ai_rejected' | 'unmapped_combo' | 'duplicate' | 'cooldown' | 'daily_cap' }
  | { unlocked: true; deckCardId: string; insight: string; fragment: string };

@Injectable()
export class CardUnlockPolicy {
  private readonly logger = new Logger(CardUnlockPolicy.name);

  constructor(
    private readonly aiService: AiService,
    private readonly deckService: DeckService,
    private readonly userCardsService: UserCardsService,
  ) {}

  private todayRange() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const tomorrow = new Date(start);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start, tomorrow };
  }

  async evaluate(input: { userId: string; entryId: string; transcription: string; durationSecs?: number }): Promise<CardDecision> {
    const { userId, transcription, durationSecs } = input;

    if (transcription.trim().length < CARD_GATES.MIN_TRANSCRIPTION_CHARS) return { unlocked: false, reason: 'too_short' };
    if (typeof durationSecs === 'number' && durationSecs < CARD_GATES.MIN_DURATION_SECS) return { unlocked: false, reason: 'too_short' };

    const ai = await this.aiService.analyzeEntry(transcription);
    if (!ai.shouldGenerateCard) return { unlocked: false, reason: 'ai_rejected' };

    const deckCard = await this.deckService.findByCombo(ai.moment, ai.agency, ai.dimension);
    if (!deckCard) return { unlocked: false, reason: 'unmapped_combo' };
    if (await this.userCardsService.hasUnlocked(userId, deckCard.id)) return { unlocked: false, reason: 'duplicate' };

    const latestUnlock = await this.userCardsService.latestUnlock(userId);
    if (latestUnlock) {
      const diffHours = (Date.now() - latestUnlock.unlockedAt.getTime()) / (1000 * 60 * 60);
      if (diffHours < CARD_GATES.COOLDOWN_HOURS) return { unlocked: false, reason: 'cooldown' };
    }

    const { start, tomorrow } = this.todayRange();
    const todayCount = await this.userCardsService.countToday(userId, start, tomorrow);
    if (todayCount >= CARD_GATES.DAILY_CAP) return { unlocked: false, reason: 'daily_cap' };

    this.logger.log(JSON.stringify({ event: 'entry.card_decision', userId, entryId: input.entryId, outcome: 'unlocked', reason: 'success', moment: ai.moment, agency: ai.agency, dimension: ai.dimension, deckCardTitle: deckCard.title }));

    return { unlocked: true, deckCardId: deckCard.id, insight: ai.insight, fragment: ai.fragment };
  }

  cardXp(): number {
    return XP_VALUES.CARD_UNLOCK;
  }
}
