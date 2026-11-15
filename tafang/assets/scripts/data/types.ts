// assets/scripts/data/types.ts
export type TowerType = 'arrow' | 'ice' | 'fire' | 'arcane';

export interface TowerLevelConfig {
  cost: number;          // 升到该级的费用（第 1 级即建造费）
  atk: number;
  range: number;
  attackInterval: number; // 秒/次
  upgradeCost?: number;   // 升到下一级的费用，最后一级无
}

export interface TowerConfig {
  name: string;
  armorIgnore?: boolean;                                   // 奥术塔：无视护甲
  aoe?: { radius: number; burnDps: number; burnDuration: number }; // 烈焰塔：范围溅射+燃烧
  slow?: { percent: number; duration: number };             // 冰霜塔：减速
  levels: TowerLevelConfig[];
}

export type EnemyType = 'slime' | 'wolf' | 'golem' | 'bat' | 'elite' | 'boss';

export interface EnemyConfig {
  maxHp: number;
  speed: number;
  armor: number;
  rewardGold: number;
  damageToBase: number;
}

export interface WaveSpawn {
  type: EnemyType;
  count: number;
  interval: number; // 相邻生成间隔（秒）
}

export interface WaveConfig {
  prepareTime: number; // 波次准备倒计时（秒）
  rewardGold: number;
  spawns: WaveSpawn[];
  isElite?: boolean;
  isBoss?: boolean;
}

export type Vec3 = [number, number, number];

export interface LevelConfig {
  name: string;
  initialGold: number;
  lives: number;
  waypoints: Vec3[];
  buildSlots: Vec3[];
  waves: string[];
  skills: SkillType[];
}

export type SkillType = 'meteor' | 'frostNova' | 'goldRain';

export interface SkillConfig {
  name: string;
  cooldown: number; // 冷却（秒）
  maxUses: number;  // 每关可用次数
  damage?: number;      // meteor
  radius?: number;      // meteor 半径
  slowPercent?: number; // frostNova 减速比例 0~1
  duration?: number;    // frostNova 持续秒数
  gold?: number;        // goldRain 金币
}

export type BuffType = 'slow' | 'burn';

export interface Buff {
  type: BuffType;
  percent?: number; // slow: 减速比例 0~1
  dps?: number;     // burn: 每秒伤害
  duration: number; // 剩余持续时间（秒）
}

export interface SaveData {
  version: number;
  unlockedLevel: number;
  levelStars: Record<string, number>;
  totalGold: number;
}

export interface ConfigSet {
  towers: Record<TowerType, TowerConfig>;
  enemies: Record<EnemyType, EnemyConfig>;
  levels: Record<string, LevelConfig>;
  waves: Record<string, WaveConfig>;
  skills: Record<SkillType, SkillConfig>;
}
