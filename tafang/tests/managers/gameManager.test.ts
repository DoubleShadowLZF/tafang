import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { GameManager } from '../../assets/scripts/managers/GameManager';

describe('GameManager', () => {
  it('初始状态为 menu', () => {
    const gm = new GameManager(new EventBus<GameEvents>());
    expect(gm.getState()).toBe('menu');
  });

  it('合法转移并 emit stateChanged', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('stateChanged', fn);
    const gm = new GameManager(bus);
    gm.setState('playing');
    expect(gm.getState()).toBe('playing');
    expect(fn).toHaveBeenCalledWith({ state: 'playing' });
  });

  it('非法转移抛错', () => {
    const gm = new GameManager(new EventBus<GameEvents>());
    expect(() => gm.setState('won')).toThrow();
  });
});
