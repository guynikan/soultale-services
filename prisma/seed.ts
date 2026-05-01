import { CardAgency, CardDimension, CardMoment, PrismaClient, QuestStatus } from '@prisma/client';

const prisma = new PrismaClient();

const FALLBACK_CARD_IMAGE_BASE = 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards';

function deckImageUrl(imageId: string): string {
  const base = (process.env.DECK_ASSETS_PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (base) {
    return `${base}/deck/v1/${imageId}.png`;
  }
  return `${FALLBACK_CARD_IMAGE_BASE}/${imageId}.png`;
}

const DECK_MVP: Array<{ order: number; title: string; imageId: string; moment: CardMoment; agency: CardAgency; dimension: CardDimension }> = [
  { order: 1, title: 'A Margem', imageId: 'margem', moment: 'Loss', agency: 'Observed', dimension: 'Interpersonal' },
  { order: 2, title: 'A Porta Fechada', imageId: 'porta-fechada', moment: 'Loss', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 3, title: 'A Armadura', imageId: 'armadura', moment: 'Loss', agency: 'Acted', dimension: 'Inner' },
  { order: 4, title: 'O Impasse', imageId: 'impasse', moment: 'Tension', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 5, title: 'O Alvo', imageId: 'impasse', moment: 'Tension', agency: 'Received', dimension: 'Interpersonal' },
  { order: 6, title: 'O Primeiro Passo', imageId: 'guinada', moment: 'Beginning', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 7, title: 'A Acusação', imageId: 'porta-fechada', moment: 'Confrontation', agency: 'Received', dimension: 'Interpersonal' },
  { order: 8, title: 'O Último Encontro', imageId: 'margem', moment: 'Resolution', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 9, title: 'A Guinada', imageId: 'guinada', moment: 'Turn', agency: 'Acted', dimension: 'Inner' },
  { order: 10, title: 'A Correnteza', imageId: 'correnteza', moment: 'Surrender', agency: 'Received', dimension: 'Transcendent' },
];

async function seedDeck(): Promise<void> {
  for (const card of DECK_MVP) {
    const row = { ...card, imageUrl: deckImageUrl(card.imageId) };
    await prisma.deckCard.upsert({ where: { title: card.title }, update: row, create: row });
  }
}

async function seedDevData(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;

  const user = await prisma.user.upsert({
    where: { email: 'test@soultale.app' },
    update: {},
    create: {
      firebaseUid: 'firebase-test-user',
      email: 'test@soultale.app',
      name: 'SoulTale Tester',
      avatarUrl: null,
      xp: 180,
      level: 2,
      levelName: 'O Viajante',
      streakDays: 3,
      lastEntryAt: new Date(),
    },
  });

  const entries = await Promise.all(Array.from({ length: 5 }).map((_, idx) => prisma.entry.create({ data: { userId: user.id, transcription: `Sample entry #${idx + 1}`, durationSecs: 75, xpEarned: 15, unlockedCard: idx < 3 } })));
  const cards = await prisma.deckCard.findMany({ orderBy: { order: 'asc' }, take: 3 });

  for (let i = 0; i < cards.length; i += 1) {
    await prisma.userCard.upsert({
      where: { userId_deckCardId: { userId: user.id, deckCardId: cards[i].id } },
      update: {},
      create: { userId: user.id, deckCardId: cards[i].id, entryId: entries[i].id, insight: `Insight ${i + 1}`, fragment: '...sample fragment', xpEarned: 50 },
    });
  }

  await prisma.quest.upsert({
    where: { id: 'dev-quest-1' },
    update: {},
    create: {
      id: 'dev-quest-1',
      userId: user.id,
      name: 'Quest de Desenvolvimento',
      description: 'Quest seeded for development',
      status: QuestStatus.ACTIVE,
      detectedAt: new Date(),
      activatedAt: new Date(),
    },
  });
}

async function main() {
  await seedDeck();
  await seedDevData();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
