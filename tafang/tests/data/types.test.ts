// tests/data/types.test.ts
import { describe, it, expect } from 'vitest';
import type { TowerConfig, LevelConfig, SkillConfig } from '../../assets/scripts/data/types';

const arrowTower: TowerConfig = {
  name: '箭塔',
  levels: [
    { cost: 50, atk: 12, range: 6, attackInterval: 0.6, upgradeCost: 60 },
    { cost: 60, atk: 24, range: 6.5, attackInterval: 0.5, upgradeCost: 100 },
    { cost: 100, atk: 45, range: 7, attackInterval: 0.4 },
  ],
};

const level1: LevelConfig = {
  name: '初始之森',
  initialGold: 200,
  lives: 20,
  waypoints: [[0, 0, 0], [10, 0, 0], [10, 0, 5]],
  buildSlots: [[2, 0, 1], [4, 0, 2]],
  waves: ['w1', 'w2'],
  skills: ['meteor', 'frostNova', 'goldRain'],
};

const meteor: SkillConfig = { name: '陨石术', damage: 100, radius: 3, cooldown: 30, maxUses: 2 };

describe('types', () => {
  it('TowerConfig 结构可构造', () => {
    expect(arrowTower.name).toBe('箭塔');
    expect(arrowTower.levels).toHaveLength(3);
    expect(arrowTower.levels[2].upgradeCost).toBeUndefined();
  });

  it('LevelConfig 含路点/建造格子/技能', () => {
    expect(level1.waypoints).toHaveLength(3);
    expect(level1.skills).toContain('meteor');
  });

  it('SkillConfig 可选字段不强制', () => {
    expect(meteor.damage).toBe(100);
  });
});
