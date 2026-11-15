// assets/scripts/managers/WaveManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { WaveConfig, EnemyType } from '../data/types';
import { buildSpawnSchedule } from '../rules/wave';

export type WavePhase = 'idle' | 'preparing' | 'spawning' | 'completed';

export class WaveManager {
  private waveIndex = -1;
  private phase: WavePhase = 'idle';
  private prepareRemaining = 0;
  private schedule: { type: EnemyType; atTime: number }[] = [];
  private spawnCursor = 0;
  private elapsed = 0;

  constructor(private bus: EventBus<GameEvents>, private waves: WaveConfig[]) {}

  startWave(index: number): void {
    this.waveIndex = index;
    this.phase = 'preparing';
    this.prepareRemaining = this.waves[index].prepareTime;
    this.elapsed = 0;
    this.spawnCursor = 0;
    this.bus.emit('waveStarted', { waveIndex: index });
  }

  update(dt: number): EnemyType[] {
    const due: EnemyType[] = [];
    if (this.phase === 'preparing') {
      this.prepareRemaining -= dt;
      if (this.prepareRemaining <= 0) {
        this.phase = 'spawning';
        this.schedule = buildSpawnSchedule(this.waves[this.waveIndex]);
      }
      return due;
    }
    if (this.phase === 'spawning') {
      this.elapsed += dt;
      while (this.spawnCursor < this.schedule.length && this.schedule[this.spawnCursor].atTime <= this.elapsed) {
        due.push(this.schedule[this.spawnCursor].type);
        this.spawnCursor++;
      }
      if (this.spawnCursor >= this.schedule.length) {
        this.phase = 'completed';
      }
    }
    return due;
  }

  getCurrentWaveIndex(): number {
    return this.waveIndex;
  }

  get isSpawningDone(): boolean {
    return this.phase === 'completed';
  }

  get hasNextWave(): boolean {
    return this.waveIndex >= 0 && this.waveIndex < this.waves.length - 1;
  }

  get currentWaveReward(): number {
    return this.waveIndex >= 0 && this.waveIndex < this.waves.length ? this.waves[this.waveIndex].rewardGold : 0;
  }
}
