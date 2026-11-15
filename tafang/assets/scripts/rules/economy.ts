// assets/scripts/rules/economy.ts
export const TOWER_SELL_RATIO = 0.7;

export function addGold(gold: number, delta: number): number {
  return Math.max(0, gold + delta);
}

export function addLives(lives: number, delta: number): number {
  return Math.max(0, lives + delta);
}

export function sellRefund(spent: number): number {
  return Math.round(spent * TOWER_SELL_RATIO);
}
