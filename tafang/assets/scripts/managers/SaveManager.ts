import type { SaveData } from '../data/types';
import { normalizeSaveData, DEFAULT_SAVE } from '../rules/save';

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const KEY = 'tafang_save';

export class SaveManager {
  private cache: SaveData;

  constructor(private storage: Storage) {
    this.cache = this.read();
  }

  private read(): SaveData {
    const raw = this.storage.get(KEY);
    if (raw === null) return { ...DEFAULT_SAVE, levelStars: { ...DEFAULT_SAVE.levelStars } };
    try {
      return normalizeSaveData(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SAVE, levelStars: { ...DEFAULT_SAVE.levelStars } };
    }
  }

  load(): SaveData {
    return this.cache;
  }

  recordStars(levelId: string, stars: number): void {
    const prev = this.cache.levelStars[levelId] ?? 0;
    this.cache.levelStars[levelId] = Math.max(prev, stars);
  }

  setUnlockedLevel(n: number): void {
    this.cache.unlockedLevel = Math.max(this.cache.unlockedLevel, n);
  }

  save(): void {
    this.storage.set(KEY, JSON.stringify(this.cache));
  }
}
