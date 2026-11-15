// tests/rules/wave.test.ts
import { describe, it, expect } from 'vitest';
import { buildSpawnSchedule, totalEnemies } from '../../assets/scripts/rules/wave';
import type { WaveConfig } from '../../assets/scripts/data/types';

const wave: WaveConfig = {
  prepareTime: 5,
  rewardGold: 50,
  spawns: [
    { type: 'slime', count: 2, interval: 1.0 },
    { type: 'wolf', count: 2, interval: 0.5 },
  ],
};

describe('wave', () => {
  it('totalEnemies 统计总数', () => {
    expect(totalEnemies(wave)).toBe(4);
  });

  it('buildSpawnSchedule 按间隔展开时间线', () => {
    const schedule = buildSpawnSchedule(wave);
    expect(schedule).toEqual([
      { type: 'slime', atTime: 0 },
      { type: 'slime', atTime: 1.0 },
      { type: 'wolf', atTime: 2.0 },
      { type: 'wolf', atTime: 2.5 },
    ]);
  });

  it('空波次返回空数组', () => {
    expect(buildSpawnSchedule({ prepareTime: 0, rewardGold: 0, spawns: [] })).toEqual([]);
  });
});
