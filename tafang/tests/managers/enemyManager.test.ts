// tests/managers/enemyManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { EnemyManager } from '../../assets/scripts/managers/EnemyManager';
import type { ConfigSet, Vec3 } from '../../assets/scripts/data/types';

const waypoints: Vec3[] = [[0, 0, 0], [10, 0, 0]];

function makeConfig(): ConfigSet {
  return {
    towers: {} as any,
    enemies: {
      slime: { maxHp: 40, speed: 2, armor: 0, rewardGold: 5, damageToBase: 1 },
    } as any,
    levels: {} as any,
    waves: {} as any,
    skills: {} as any,
  };
}

describe('EnemyManager', () => {
  it('spawn 生成敌人并 emit enemySpawned', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('enemySpawned', fn);
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const id = em.spawn('slime');
    expect(id).toBe(1);
    expect(fn).toHaveBeenCalledWith({ id: 1, type: 'slime' });
    expect(em.getEnemies()).toHaveLength(1);
  });

  it('update 推进敌人位置', () => {
    const em = new EnemyManager(new EventBus<GameEvents>(), makeConfig(), waypoints);
    em.spawn('slime');
    em.update(1.0); // speed=2，前进 2 单位
    const e = em.getEnemies()[0];
    expect(e.position[0]).toBeCloseTo(2);
  });

  it('走完全程漏怪并 emit enemyLeaked', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('enemyLeaked', fn);
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    em.spawn('slime');
    em.update(10.0); // 足够走完 10 单位
    expect(fn).toHaveBeenCalledWith({ id: 1, type: 'slime', damageToBase: 1 });
    expect(em.remainingCount()).toBe(0);
  });

  it('damageEnemy 扣血并击杀', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('enemyKilled', fn);
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    em.spawn('slime');
    em.damageEnemy(1, 999);
    em.update(0);
    expect(fn).toHaveBeenCalledWith({ id: 1, type: 'slime', rewardGold: 5 });
  });
});
