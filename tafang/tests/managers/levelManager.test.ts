import { describe, it, expect } from 'vitest';
import { LevelManager } from '../../assets/scripts/managers/LevelManager';
import type { ConfigSet } from '../../assets/scripts/data/types';

function makeConfig(): ConfigSet {
  return {
    towers: {} as any,
    enemies: {} as any,
    levels: {
      level1: { name: '初始之森', initialGold: 200, lives: 20, waypoints: [[0,0,0],[1,0,0]], buildSlots: [], waves: ['w1'], skills: ['meteor'] },
      level2: { name: '幽暗洞穴', initialGold: 300, lives: 20, waypoints: [], buildSlots: [], waves: [], skills: [] },
    },
    waves: {} as any,
    skills: {} as any,
  };
}

describe('LevelManager', () => {
  it('getLevelIds 返回所有关卡 id', () => {
    const lm = new LevelManager(makeConfig());
    expect(lm.getLevelIds()).toEqual(['level1', 'level2']);
  });

  it('getLevel 返回关卡配置', () => {
    const lm = new LevelManager(makeConfig());
    expect(lm.getLevel('level1').name).toBe('初始之森');
  });

  it('缺失关卡抛错', () => {
    const lm = new LevelManager(makeConfig());
    expect(() => lm.getLevel('nope')).toThrow();
  });
});
