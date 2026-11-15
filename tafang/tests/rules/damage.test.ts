// tests/rules/damage.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDamage, ARMOR_COEFFICIENT } from '../../assets/scripts/rules/damage';

describe('calculateDamage', () => {
  it('无护甲时全额伤害', () => {
    expect(calculateDamage(10, 0)).toBe(10);
  });

  it('护甲等于 K 时伤害减半', () => {
    expect(calculateDamage(10, ARMOR_COEFFICIENT)).toBe(5);
  });

  it('伤害至少为 1', () => {
    expect(calculateDamage(1, 9999)).toBe(1);
  });

  it('armorIgnore 无视护甲', () => {
    expect(calculateDamage(10, 9999, true)).toBe(10);
  });
});
