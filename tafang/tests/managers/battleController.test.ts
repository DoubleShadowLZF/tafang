// tests/managers/battleController.test.ts
import { describe, it, expect } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { BattleController } from '../../assets/scripts/managers/BattleController';
import type { ConfigSet } from '../../assets/scripts/data/types';

function makeConfig(): ConfigSet {
  return {
    towers: {
      arrow: { name: '箭塔', levels: [{ cost: 50, atk: 100, range: 10, attackInterval: 0.1 }] },
    } as any,
    enemies: { slime: { maxHp: 10, speed: 1, armor: 0, rewardGold: 5, damageToBase: 1 } } as any,
    levels: {
      level1: {
        name: '初始之森', initialGold: 100, lives: 1,
        waypoints: [[0, 0, 0], [5, 0, 0]],
        buildSlots: [[0, 0, 0]],
        waves: ['w1'],
        skills: ['goldRain'],
      },
    },
    waves: { w1: { prepareTime: 0, rewardGold: 0, spawns: [{ type: 'slime', count: 1, interval: 0 }] } },
    skills: { goldRain: { name: '金币雨', gold: 10, cooldown: 1, maxUses: 1 } } as any,
  };
}

describe('BattleController', () => {
  it('击杀所有敌人后胜利', () => {
    const bus = new EventBus<GameEvents>();
    const bc = new BattleController(bus, makeConfig(), 'level1');
    let state = '';
    bus.on('stateChanged', (p) => { state = p.state; });
    bc.start();
    expect(state).toBe('playing');
    bc.towers.buildTower(0, 'arrow'); // 塔在 buildSlots[0]=[0,0,0]，射程 10 覆盖路径
    bc.update(1.0); // 波次准备结束
    bc.update(0.1); // 刷怪 + 塔击杀（atk 100 对 hp 10 一击毙命）
    expect(state).toBe('won');
  });

  it('漏怪扣生命并失败', () => {
    const bus = new EventBus<GameEvents>();
    const bc = new BattleController(bus, makeConfig(), 'level1');
    let state = '';
    bus.on('stateChanged', (p) => { state = p.state; });
    bc.start();
    bc.update(0.1);  // 波次进入 spawning
    bc.update(10.0); // 刷怪 + 敌人走完 5 单位漏怪，lives 1->0
    expect(state).toBe('lost');
  });
});
