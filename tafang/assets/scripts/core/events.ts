// assets/scripts/core/events.ts
import type { EnemyType, TowerType, SkillType } from '../data/types';

export type GameState = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

export interface GameEvents {
  stateChanged: { state: GameState };
  goldChanged: { gold: number };
  livesChanged: { lives: number };
  waveStarted: { waveIndex: number };
  waveEnded: { waveIndex: number; rewardGold: number };
  enemySpawned: { id: number; type: EnemyType };
  enemyKilled: { id: number; type: EnemyType; rewardGold: number };
  enemyLeaked: { id: number; type: EnemyType; damageToBase: number };
  towerBuilt: { slotIndex: number; towerType: TowerType };
  towerUpgraded: { slotIndex: number; level: number };
  towerSold: { slotIndex: number; refund: number };
  skillUsed: { type: SkillType };
}
