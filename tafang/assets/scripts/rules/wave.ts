// assets/scripts/rules/wave.ts
import type { WaveConfig, EnemyType } from '../data/types';

export interface SpawnEvent {
  type: EnemyType;
  atTime: number;
}

/**
 * 生成整个波次的刷怪时间线。
 * `atTime` 以"刷怪阶段起点"（即准备倒计时结束后）计秒，不含 `prepareTime`；首个事件 atTime = 0。
 * 调用方（WaveManager）应先单独走完 prepareTime 倒计时，再按此表逐帧产出敌人。
 */
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
