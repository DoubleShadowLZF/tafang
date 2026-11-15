import { describe, it, expect } from 'vitest';
import { SaveManager, Storage } from '../../assets/scripts/managers/SaveManager';

class MemoryStorage implements Storage {
  map = new Map<string, string>();
  get(key: string) { return this.map.get(key) ?? null; }
  set(key: string, value: string) { this.map.set(key, value); }
}

describe('SaveManager', () => {
  it('空存储返回默认存档', () => {
    const sm = new SaveManager(new MemoryStorage());
    expect(sm.load().unlockedLevel).toBe(1);
    expect(sm.load().totalGold).toBe(0);
  });

  it('recordStars 取更高星', () => {
    const sm = new SaveManager(new MemoryStorage());
    sm.recordStars('level1', 2);
    sm.recordStars('level1', 3);
    sm.recordStars('level1', 1);
    expect(sm.load().levelStars['level1']).toBe(3);
  });

  it('save 后可被 load 读回', () => {
    const storage = new MemoryStorage();
    const sm = new SaveManager(storage);
    sm.recordStars('level1', 3);
    sm.setUnlockedLevel(2);
    sm.save();
    const sm2 = new SaveManager(storage);
    expect(sm2.load().unlockedLevel).toBe(2);
    expect(sm2.load().levelStars['level1']).toBe(3);
  });

  it('损坏的存档回退默认', () => {
    const storage = new MemoryStorage();
    storage.set('tafang_save', 'not-json{');
    const sm = new SaveManager(storage);
    expect(sm.load().unlockedLevel).toBe(1);
  });
});
