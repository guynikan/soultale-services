import { LEVELS } from './constants';

export function resolveLevel(totalXp: number): { level: number; levelName: string } {
  const sorted = [...LEVELS].sort((a, b) => a.minXp - b.minXp);
  let current = sorted[0];

  for (const item of sorted) {
    if (totalXp >= item.minXp) {
      current = item;
    }
  }

  return { level: current.level, levelName: current.name };
}
