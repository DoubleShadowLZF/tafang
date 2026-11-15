// assets/scripts/managers/runtime.ts
import type { EnemyType, Vec3, Buff } from '../data/types';

export interface EnemyRuntime {
  id: number;
  type: EnemyType;
  maxHp: number;
  hp: number;
  speed: number;
  armor: number;
  rewardGold: number;
  damageToBase: number;
  position: Vec3;
  waypointIndex: number; // 下一个目标路点下标
  buffs: Buff[];
}
