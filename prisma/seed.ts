import { CardAgency, CardDimension, CardMoment, PrismaClient, QuestStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DECK_MVP: Array<{ order: number; title: string; imageId: string; imageUrl: string; moment: CardMoment; agency: CardAgency; dimension: CardDimension }> = [
  { order: 1, title: 'A Margem', imageId: 'margem', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/margem.png', moment: 'Loss', agency: 'Observed', dimension: 'Interpersonal' },
  { order: 2, title: 'A Porta Fechada', imageId: 'porta-fechada', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/porta-fechada.png', moment: 'Loss', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 3, title: 'A Armadura', imageId: 'armadura', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/armadura.png', moment: 'Loss', agency: 'Acted', dimension: 'Inner' },
  { order: 4, title: 'O Impasse', imageId: 'impasse', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/impasse.png', moment: 'Tension', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 5, title: 'O Alvo', imageId: 'impasse', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/impasse.png', moment: 'Tension', agency: 'Received', dimension: 'Interpersonal' },
  { order: 6, title: 'O Primeiro Passo', imageId: 'guinada', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/guinada.png', moment: 'Beginning', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 7, title: 'A Acusação', imageId: 'porta-fechada', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/porta-fechada.png', moment: 'Confrontation', agency: 'Received', dimension: 'Interpersonal' },
  { order: 8, title: 'O Último Encontro', imageId: 'margem', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/margem.png', moment: 'Resolution', agency: 'Acted', dimension: 'Interpersonal' },
  { order: 9, title: 'A Guinada', imageId: 'guinada', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/guinada.png', moment: 'Turn', agency: 'Acted', dimension: 'Inner' },
  { order: 10, title: 'A Correnteza', imageId: 'correnteza', imageUrl: 'https://raw.githubusercontent.com/ed/soultale/main/assets/cards/correnteza.png', moment: 'Surrender', agency: 'Received', dimension: 'Transcendent' },
];

async function seedDeck(): Promise<void> {
  for (const card of DECK_MVP) {
    await prisma.deckCard.upsert({ where: { title: card.title }, update: card, create: card });
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
