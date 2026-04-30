import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { CardAgency, CardDimension, CardMoment } from '@prisma/client';

type AiResult =
  | { shouldGenerateCard: false }
  | {
      shouldGenerateCard: true;
      moment: CardMoment;
      agency: CardAgency;
      dimension: CardDimension;
      insight: string;
      fragment: string;
    };

const VALID_MOMENTS = new Set<CardMoment>(['Beginning', 'Tension', 'Confrontation', 'Turn', 'Loss', 'Resolution', 'Surrender', 'Revelation']);
const VALID_AGENCY = new Set<CardAgency>(['Acted', 'Received', 'Observed']);
const VALID_DIMENSION = new Set<CardDimension>(['Inner', 'Interpersonal', 'Transcendent']);

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    this.model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  private extractJson(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  }

  private validate(payload: unknown): AiResult {
    if (!payload || typeof payload !== 'object') return { shouldGenerateCard: false };

    const obj = payload as Record<string, unknown>;
    if (obj.shouldGenerateCard !== true) return { shouldGenerateCard: false };

    const { moment, agency, dimension, insight, fragment } = obj;

    if (
      typeof moment !== 'string' || !VALID_MOMENTS.has(moment as CardMoment) ||
      typeof agency !== 'string' || !VALID_AGENCY.has(agency as CardAgency) ||
      typeof dimension !== 'string' || !VALID_DIMENSION.has(dimension as CardDimension) ||
      typeof insight !== 'string' || typeof fragment !== 'string'
    ) {
      this.logger.warn('Invalid AI payload, defaulting to no-card');
      return { shouldGenerateCard: false };
    }

    return {
      shouldGenerateCard: true,
      moment: moment as CardMoment,
      agency: agency as CardAgency,
      dimension: dimension as CardDimension,
      insight: insight.trim(),
      fragment: fragment.trim(),
    };
  }

  async analyzeEntry(transcription: string): Promise<AiResult> {
    const system = `You are a narrative classifier. Analyze voice diary transcription and decide if it deserves a collectible card.
Cards are only for emotionally significant moments.
Return valid JSON only.
If shouldGenerateCard is false, return {"shouldGenerateCard":false}.
If true, include: shouldGenerateCard, moment, agency, dimension, insight, fragment.
moment must be one of: Beginning,Tension,Confrontation,Turn,Loss,Resolution,Surrender,Revelation.
agency must be one of: Acted,Received,Observed.
dimension must be one of: Inner,Interpersonal,Transcendent.
insight must be a short statement (no question mark).
fragment must be a literal quote from the text starting with "...".`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: `Transcription: """${transcription}"""` }],
    });

    const textBlock = message.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return { shouldGenerateCard: false };

    try {
      const parsed = JSON.parse(this.extractJson(textBlock.text)) as unknown;
      return this.validate(parsed);
    } catch (error) {
      this.logger.warn(`AI response parse failed: ${String(error)}`);
      return { shouldGenerateCard: false };
    }
  }
}
