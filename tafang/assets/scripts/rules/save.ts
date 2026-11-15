// assets/scripts/rules/save.ts
import type { SaveData } from '../data/types';

export const SAVE_VERSION = 1;

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  unlockedLevel: 1,
  levelStars: {},
  totalGold: 0,
};

export function normalizeSaveData(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SAVE };
  const r = raw as Record<string, unknown>;
  const unlockedLevel =
    typeof r.unlockedLevel === 'number' && r.unlockedLevel >= 1
      ? Math.floor(r.unlockedLevel)
      : DEFAULT_SAVE.unlockedLevel;
  const totalGold =
    typeof r.totalGold === 'number' && r.totalGold >= 0
      ? Math.floor(r.totalGold)
      : DEFAULT_SAVE.totalGold;
  const levelStars =
    typeof r.levelStars === 'object' && r.levelStars !== null
      ? { ...(r.levelStars as Record<string, number>) }
      : {};
  return { version: SAVE_VERSION, unlockedLevel, totalGold, levelStars };
}
