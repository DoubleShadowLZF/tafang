// assets/scripts/rules/wave.ts
import type { WaveConfig, EnemyType } from '../data/types';

export interface SpawnEvent {
  type: EnemyType;
  atTime: number;
}

export function buildSpawnSchedule(wave: WaveConfig): SpawnEvent[] {
  const events: SpawnEvent[] = [];
  let t = 0;
  for (const s of wave.spawns) {
    for (let i = 0; i < s.count; i++) {
      events.push({ type: s.type, atTime: t });
      t += s.interval;
    }
  }
  return events;
}

export function totalEnemies(wave: WaveConfig): number {
  return wave.spawns.reduce((sum, s) => sum + s.count, 0);
}
