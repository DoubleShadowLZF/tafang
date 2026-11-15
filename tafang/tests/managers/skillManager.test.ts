// tests/managers/skillManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { SkillManager } from '../../assets/scripts/managers/SkillManager';
import { EnemyManager } from '../../assets/scripts/managers/EnemyManager';
import { EconomyManager } from '../../assets/scripts/managers/EconomyManager';
import type { ConfigSet, Vec3 } from '../../assets/scripts/data/types';

const waypoints: Vec3[] = [[0, 0, 0], [10, 0, 0]];

function makeConfig(): ConfigSet {
  return {
    towers: {} as any,
    enemies: { slime: { maxHp: 100, speed: 0, armor: 0, rewardGold: 5, damageToBase: 1 } } as any,
    levels: {} as any,
    waves: {} as any,
    skills: {
      meteor: { name: '陨石术', damage: 100, radius: 3, cooldown: 30, maxUses: 2 },
      frostNova: { name: '冰霜新星', slowPercent: 0.6, duration: 5, cooldown: 20, maxUses: 3 },
      goldRain: { name: '金币雨', gold: 150, cooldown: 45, maxUses: 1 },
    },
  };
}

describe('SkillManager', () => {
  it('meteor 对范围内敌人造成伤害', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['meteor']);
    const id = em.spawn('slime');
    expect(sm.use('meteor', [0, 0, 0])).toBe(true);
    expect(em.getEnemies().find((x) => x.id === id)!.hp).toBe(0);
  });

  it('goldRain 加金币', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['goldRain']);
    expect(sm.use('goldRain')).toBe(true);
    expect(eco.getGold()).toBe(150);
  });

  it('冷却中不可释放', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['meteor']);
    sm.use('meteor', [0, 0, 0]);
    expect(sm.canUse('meteor')).toBe(false);
    sm.update(31);
    expect(sm.canUse('meteor')).toBe(true);
  });

  it('次数耗尽不可释放', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['meteor']);
    sm.use('meteor', [0, 0, 0]);
    sm.update(31);
    sm.use('meteor', [0, 0, 0]);
    expect(sm.getRemainingUses('meteor')).toBe(0);
    expect(sm.canUse('meteor')).toBe(false);
  });
});
