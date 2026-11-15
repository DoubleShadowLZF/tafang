// tests/managers/events.test.ts
import { describe, it, expect } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';

describe('GameEvents', () => {
  it('EventBus 可携带 GameEvents 类型', () => {
    const bus = new EventBus<GameEvents>();
    let gold = 0;
    bus.on('goldChanged', (p) => { gold = p.gold; });
    bus.emit('goldChanged', { gold: 150 });
    expect(gold).toBe(150);
  });
});
