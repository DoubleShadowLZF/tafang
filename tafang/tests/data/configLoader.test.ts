// tests/data/configLoader.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../../assets/scripts/data/ConfigLoader';

function makeLoader() {
  const store: Record<string, unknown> = {
    'towers.json': { arrow: { name: '箭塔', levels: [] } },
    'enemies.json': { slime: { maxHp: 40, speed: 2, armor: 0, rewardGold: 5, damageToBase: 1 } },
    'levels.json': { level1: { name: '初始之森', initialGold: 200, lives: 20, waypoints: [], buildSlots: [], waves: [], skills: [] } },
    'waves.json': { w1: { prepareTime: 5, rewardGold: 50, spawns: [] } },
    'skills.json': { meteor: { name: '陨石术', cooldown: 30, maxUses: 2 } },
  };
  return new ConfigLoader((path) => store[path]);
}

describe('ConfigLoader', () => {
  it('加载全部配置', () => {
    const config = makeLoader().loadAll();
    expect(config.towers.arrow.name).toBe('箭塔');
    expect(config.enemies.slime.maxHp).toBe(40);
    expect(config.skills.meteor.cooldown).toBe(30);
  });

  it('配置缺失时抛错', () => {
    const loader = new ConfigLoader(() => undefined);
    expect(() => loader.loadAll()).toThrow();
  });

  it('配置为 null 时抛错', () => {
    const loader = new ConfigLoader((path) => (path === 'towers.json' ? null : {}));
    expect(() => loader.loadAll()).toThrow();
  });
});
