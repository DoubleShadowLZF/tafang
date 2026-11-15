// tests/rules/buff.test.ts
import { describe, it, expect } from 'vitest';
import { slowMultiplier, tickBuffs } from '../../assets/scripts/rules/buff';
import type { Buff } from '../../assets/scripts/data/types';

describe('buff', () => {
  it('slowMultiplier 无减速为 1', () => {
    expect(slowMultiplier([])).toBe(1);
  });

  it('slowMultiplier 取最大减速比例', () => {
    const buffs: Buff[] = [
      { type: 'slow', percent: 0.3, duration: 2 },
      { type: 'slow', percent: 0.6, duration: 3 },
    ];
    expect(slowMultiplier(buffs)).toBeCloseTo(0.4);
  });

  it('tickBuffs 返回燃烧伤害并推进时间', () => {
    const buffs: Buff[] = [{ type: 'burn', dps: 10, duration: 2 }];
    const dmg = tickBuffs(buffs, 0.5);
    expect(dmg).toBeCloseTo(5);
    expect(buffs[0].duration).toBeCloseTo(1.5);
  });

  it('tickBuffs 移除到期 buff', () => {
    const buffs: Buff[] = [{ type: 'burn', dps: 10, duration: 0.1 }];
    tickBuffs(buffs, 0.2);
    expect(buffs).toHaveLength(0);
  });
});
