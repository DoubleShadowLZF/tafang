// tests/rules/save.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeSaveData, DEFAULT_SAVE, SAVE_VERSION } from '../../assets/scripts/rules/save';

describe('save', () => {
  it('非法输入回退默认存档', () => {
    expect(normalizeSaveData(null)).toEqual(DEFAULT_SAVE);
    expect(normalizeSaveData('bad')).toEqual(DEFAULT_SAVE);
    expect(normalizeSaveData(undefined)).toEqual(DEFAULT_SAVE);
  });

  it('合法存档保留字段并修正版本', () => {
    const out = normalizeSaveData({ unlockedLevel: 3, totalGold: 100, levelStars: { level1: 3 } });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.unlockedLevel).toBe(3);
    expect(out.totalGold).toBe(100);
    expect(out.levelStars).toEqual({ level1: 3 });
  });

  it('负值被钳制', () => {
    const out = normalizeSaveData({ unlockedLevel: -1, totalGold: -5 });
    expect(out.unlockedLevel).toBe(1);
    expect(out.totalGold).toBe(0);
  });
});
