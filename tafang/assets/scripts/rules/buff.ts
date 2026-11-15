// assets/scripts/rules/buff.ts
import type { Buff } from '../data/types';

export function slowMultiplier(buffs: Buff[]): number {
  let maxPercent = 0;
  for (const b of buffs) {
    if (b.type === 'slow' && b.percent !== undefined) {
      maxPercent = Math.max(maxPercent, b.percent);
    }
  }
  return 1 - maxPercent;
}

export function tickBuffs(buffs: Buff[], dt: number): number {
  let burnDamage = 0;
  for (const b of buffs) {
    if (b.type === 'burn' && b.dps !== undefined) {
      burnDamage += b.dps * dt;
    }
    b.duration -= dt;
  }
  for (let i = buffs.length - 1; i >= 0; i--) {
    if (buffs[i].duration <= 0) buffs.splice(i, 1);
  }
  return burnDamage;
}
