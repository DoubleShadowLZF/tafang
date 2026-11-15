// tests/rules/economy.test.ts
import { describe, it, expect } from 'vitest';
import { addGold, addLives, sellRefund, TOWER_SELL_RATIO } from '../../assets/scripts/rules/economy';

describe('economy', () => {
  it('addGold 累加且不为负', () => {
    expect(addGold(100, 50)).toBe(150);
    expect(addGold(10, -999)).toBe(0);
  });

  it('addLives 累加且不为负', () => {
    expect(addLives(20, -3)).toBe(17);
    expect(addLives(1, -5)).toBe(0);
  });

  it('sellRefund 按 70% 四舍五入', () => {
    expect(TOWER_SELL_RATIO).toBe(0.7);
    expect(sellRefund(100)).toBe(70);
    expect(sellRefund(55)).toBe(39);
  });
});
