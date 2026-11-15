// assets/scripts/rules/damage.ts
export const ARMOR_COEFFICIENT = 20;

export function calculateDamage(atk: number, armor: number, armorIgnore = false): number {
  const effectiveArmor = armorIgnore ? 0 : armor;
  const raw = atk * (1 - effectiveArmor / (effectiveArmor + ARMOR_COEFFICIENT));
  return Math.max(1, Math.round(raw));
}
