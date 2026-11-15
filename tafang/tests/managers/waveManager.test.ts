// tests/managers/waveManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { WaveManager } from '../../assets/scripts/managers/WaveManager';
import type { WaveConfig } from '../../assets/scripts/data/types';

const waves: WaveConfig[] = [
  { prepareTime: 2, rewardGold: 50, spawns: [{ type: 'slime', count: 2, interval: 1.0 }] },
];

function setup() {
  const bus = new EventBus<GameEvents>();
  const started = vi.fn();
  const ended = vi.fn();
  bus.on('waveStarted', started);
  bus.on('waveEnded', ended);
  const wm = new WaveManager(bus, waves);
  return { wm, started, ended };
}

describe('WaveManager', () => {
  it('startWave 进入准备阶段并 emit waveStarted', () => {
    const { wm, started } = setup();
    wm.startWave(0);
    expect(started).toHaveBeenCalledWith({ waveIndex: 0 });
    expect(wm.getCurrentWaveIndex()).toBe(0);
  });

  it('准备期不生成，准备结束后按间隔生成', () => {
    const { wm } = setup();
    wm.startWave(0);
    expect(wm.update(1.0)).toEqual([]);          // 准备中
    expect(wm.update(1.1)).toEqual([]);          // 准备结束，进入 spawning
    expect(wm.update(0.5)).toEqual(['slime']);   // 首个 spawn（atTime=0）
    expect(wm.update(0.4)).toEqual([]);          // 累积到 0.9，未到第二个
    expect(wm.update(0.1)).toEqual(['slime']);   // 累积到 1.0，第二个 spawn
  });

  it('全部生成后 emit waveEnded 且 allWavesDone', () => {
    const { wm, ended } = setup();
    wm.startWave(0);
    wm.update(3.0); // 跨过准备期
    wm.update(3.0); // 跨过全部生成
    expect(ended).toHaveBeenCalledWith({ waveIndex: 0, rewardGold: 50 });
    expect(wm.allWavesDone).toBe(true);
  });
});
