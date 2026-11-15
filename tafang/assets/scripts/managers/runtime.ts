// assets/scripts/managers/runtime.ts
import type { EnemyType, Vec3, Buff, TowerType } from '../data/types';

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

export interface TowerRuntime {
  slotIndex: number;
  type: TowerType;
  level: number;    // 0-based，配置取 levels[level]
  cooldown: number; // 剩余冷却秒数
  position: Vec3;   // 塔所在槽位坐标
}
