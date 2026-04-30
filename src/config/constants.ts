export const XP_VALUES = {
  ENTRY_BASE: 10,
  ENTRY_BONUS_LONG: 5,
  CARD_UNLOCK: 50,
  STREAK_BONUS: 5,
} as const;

export const CARD_GATES = {
  MIN_TRANSCRIPTION_CHARS: 80,
  MIN_DURATION_SECS: 20,
  COOLDOWN_HOURS: 12,
  DAILY_CAP: 2,
} as const;

export const LEVELS = [
  { level: 1, name: 'O Aprendiz', minXp: 0 },
  { level: 2, name: 'O Viajante', minXp: 100 },
  { level: 3, name: 'O Buscador', minXp: 300 },
  { level: 4, name: 'O Guardião', minXp: 600 },
  { level: 5, name: 'O Sábio', minXp: 1000 },
  { level: 6, name: 'O Oráculo', minXp: 1500 },
  { level: 7, name: 'O Arquiteto', minXp: 2200 },
  { level: 8, name: 'O Eterno', minXp: 3000 },
] as const;
