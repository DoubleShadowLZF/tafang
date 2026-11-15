import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { TowerManager } from '../../assets/scripts/managers/TowerManager';
import { EnemyManager } from '../../assets/scripts/managers/EnemyManager';
import { EconomyManager } from '../../assets/scripts/managers/EconomyManager';
import type { ConfigSet, Vec3 } from '../../assets/scripts/data/types';

const waypoints: Vec3[] = [[0, 0, 0], [10, 0, 0]];

function makeConfig(): ConfigSet {
  return {
    towers: {
      arrow: { name: '箭塔', levels: [
        { cost: 50, atk: 10, range: 5, attackInterval: 1.0, upgradeCost: 60 },
        { cost: 60, atk: 20, range: 6, attackInterval: 1.0 },
      ] },
      arcane: { name: '奥术塔', armorIgnore: true, levels: [
        { cost: 100, atk: 50, range: 5, attackInterval: 1.0 },
      ] },
    } as any,
    enemies: { slime: { maxHp: 100, speed: 0, armor: 100, rewardGold: 5, damageToBase: 1 } } as any,
    levels: {} as any,
    waves: {} as any,
    skills: {} as any,
  };
}

const buildSlots: Vec3[] = Array.from({ length: 6 }, (): Vec3 => [0, 0, 0]);

function setup() {
  const bus = new EventBus<GameEvents>();
  const em = new EnemyManager(bus, makeConfig(), waypoints);
  const eco = new EconomyManager(bus, 500, 20);
  const tm = new TowerManager(bus, makeConfig(), em, eco, buildSlots);
  return { bus, em, eco, tm };
}

describe('TowerManager', () => {
  it('buildTower 扣钱并创建', () => {
    const { tm, eco } = setup();
    expect(tm.buildTower(0, 'arrow')).toBe(true);
    expect(eco.getGold()).toBe(450);
  });

  it('金币不足则建造失败', () => {
    const { tm } = setup();
    expect(tm.buildTower(0, 'arcane')).toBe(true);
    expect(tm.buildTower(1, 'arcane')).toBe(true);
    expect(tm.buildTower(2, 'arcane')).toBe(true);
    expect(tm.buildTower(3, 'arcane')).toBe(true);
    expect(tm.buildTower(4, 'arcane')).toBe(true);
    expect(tm.buildTower(5, 'arcane')).toBe(false); // 500 只够 5 座
  });

  it('upgradeTower 升级并扣 upgradeCost', () => {
    const { tm, eco } = setup();
    tm.buildTower(0, 'arrow');
    expect(tm.upgradeTower(0)).toBe(true);
    expect(eco.getGold()).toBe(500 - 50 - 60);
  });

  it('sellTower 返还 70%', () => {
    const { tm } = setup();
    tm.buildTower(0, 'arrow');
    expect(tm.sellTower(0)).toBe(Math.round(50 * 0.7));
  });

  it('update 索敌并攻击（奥术塔无视护甲）', () => {
    const { em, tm } = setup();
    tm.buildTower(0, 'arcane'); // 范围 5，敌人在原点
    const id = em.spawn('slime');
    tm.update(1.1); // 冷却 1s，敌人 hp=100，奥术塔 atk=50 无视护甲
    const e = em.getEnemies().find((x) => x.id === id)!;
    expect(e.hp).toBe(50);
  });
});
