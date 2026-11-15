import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { EconomyManager } from '../../assets/scripts/managers/EconomyManager';

describe('EconomyManager', () => {
  it('初始金币/生命', () => {
    const em = new EconomyManager(new EventBus<GameEvents>(), 200, 20);
    expect(em.getGold()).toBe(200);
    expect(em.getLives()).toBe(20);
  });

  it('spendGold 足够则扣、不足则拒绝', () => {
    const em = new EconomyManager(new EventBus<GameEvents>(), 100, 20);
    expect(em.spendGold(60)).toBe(true);
    expect(em.getGold()).toBe(40);
    expect(em.spendGold(100)).toBe(false);
    expect(em.getGold()).toBe(40);
  });

  it('addGold/addLives 钳制到 0 并 emit', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EconomyManager(bus, 10, 1);
    const goldFn = vi.fn();
    bus.on('goldChanged', goldFn);
    em.addGold(-999);
    expect(em.getGold()).toBe(0);
    expect(goldFn).toHaveBeenCalledWith({ gold: 0 });
    em.addLives(-5);
    expect(em.getLives()).toBe(0);
    expect(em.isDefeated()).toBe(true);
  });
});
