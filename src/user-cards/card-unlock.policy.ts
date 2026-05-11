import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { CARD_GATES, XP_VALUES } from '../config/constants';
import { DeckService } from '../deck/deck.service';
import { UserCardsService } from './user-cards.service';

// Card unlock gate pipeline — order is intentional (cheap checks before the AI call):
//
//  1. too_short      — entry below minimum chars / duration threshold (free, sync)
//  2. cooldown       — last unlock was within COOLDOWN_HOURS (1 DB read)
//  3. daily_cap      — user already reached DAILY_CAP unlocks today (1 DB read)
//  ── AI call ──────────────────────────────────────────────────────────────────
//  4. ai_rejected    — AI decided the entry has no emotional weight (Anthropic API)
//  5. unmapped_combo — AI combo (moment×agency×dimension) has no deck card (1 DB read)
//  6. duplicate      — user already owns the matched deck card (1 DB read)

export type CardDecision =
  | { unlocked: false; reason: 'too_short' | 'cooldown' | 'daily_cap' | 'ai_rejected' | 'unmapped_combo' | 'duplicate' }
  | { unlocked: true; deckCardId: string; deckCardTitle: string; insight: string; fragment: string };

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

  private blocked(
    input: { userId: string; entryId: string; transcription: string; durationSecs?: number; entryKind?: string },
    reason: Extract<CardDecision, { unlocked: false }>['reason'],
    extra?: Record<string, unknown>,
  ): Extract<CardDecision, { unlocked: false }> {
    this.logger.log(JSON.stringify({
      event: 'entry.card_decision',
      outcome: 'blocked',
      reason,
      userId: input.userId,
      entryId: input.entryId,
      entryKind: input.entryKind ?? 'unknown',
      transcriptionChars: input.transcription.trim().length,
      durationSecs: input.durationSecs ?? null,
      ...extra,
    }));
    return { unlocked: false, reason };
  }

  async evaluate(input: {
    userId: string;
    entryId: string;
    transcription: string;
    durationSecs?: number;
    entryKind?: 'voice' | 'text';
  }): Promise<CardDecision> {
    const { userId, transcription, durationSecs, entryKind } = input;

    const written =
      entryKind === 'text' ||
      (entryKind !== 'voice' && (durationSecs === undefined || durationSecs === null));

    // Gate 1: too_short
    const minChars = written ? CARD_GATES.MIN_TRANSCRIPTION_CHARS_TEXT : CARD_GATES.MIN_TRANSCRIPTION_CHARS_VOICE;
    if (transcription.trim().length < minChars) {
      return this.blocked(input, 'too_short', { minChars, written });
    }
    const hasVoiceTiming =
      typeof durationSecs === 'number' && Number.isFinite(durationSecs) && durationSecs >= 0;
    if (!written && hasVoiceTiming && durationSecs < CARD_GATES.MIN_DURATION_SECS) {
      return this.blocked(input, 'too_short', { minDurationSecs: CARD_GATES.MIN_DURATION_SECS, written });
    }

    // Gate 2: cooldown
    const latestUnlock = await this.userCardsService.latestUnlock(userId);
    if (latestUnlock) {
      const diffHours = (Date.now() - latestUnlock.unlockedAt.getTime()) / (1000 * 60 * 60);
      if (diffHours < CARD_GATES.COOLDOWN_HOURS) {
        return this.blocked(input, 'cooldown', {
          cooldownHours: CARD_GATES.COOLDOWN_HOURS,
          hoursRemaining: Math.ceil(CARD_GATES.COOLDOWN_HOURS - diffHours),
        });
      }
    }

    // Gate 3: daily_cap
    const { start, tomorrow } = this.todayRange();
    const todayCount = await this.userCardsService.countToday(userId, start, tomorrow);
    if (todayCount >= CARD_GATES.DAILY_CAP) {
      return this.blocked(input, 'daily_cap', { dailyCap: CARD_GATES.DAILY_CAP, todayCount });
    }

    // Gate 4: ai_rejected
    const ai = await this.aiService.analyzeEntry(transcription, { written });
    if (!ai.shouldGenerateCard) {
      return this.blocked(input, 'ai_rejected');
    }

    // Gate 5: unmapped_combo
    const deckCard = await this.deckService.findByCombo(ai.moment, ai.agency, ai.dimension);
    if (!deckCard) {
      return this.blocked(input, 'unmapped_combo', { moment: ai.moment, agency: ai.agency, dimension: ai.dimension });
    }

    // Gate 6: duplicate
    if (await this.userCardsService.hasUnlocked(userId, deckCard.id)) {
      return this.blocked(input, 'duplicate', { deckCardId: deckCard.id, deckCardTitle: deckCard.title });
    }

    this.logger.log(JSON.stringify({
      event: 'entry.card_decision',
      outcome: 'unlocked',
      userId,
      entryId: input.entryId,
      entryKind: entryKind ?? 'unknown',
      transcriptionChars: transcription.trim().length,
      durationSecs: durationSecs ?? null,
      moment: ai.moment,
      agency: ai.agency,
      dimension: ai.dimension,
      deckCardId: deckCard.id,
      deckCardTitle: deckCard.title,
      insight: ai.insight,
      fragment: ai.fragment,
    }));

    return {
      unlocked: true,
      deckCardId: deckCard.id,
      deckCardTitle: deckCard.title,
      insight: ai.insight,
      fragment: ai.fragment,
    };
  }

  cardXp(): number {
    return XP_VALUES.CARD_UNLOCK;
  }
}
