// assets/scripts/managers/BattleController.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet } from '../data/types';
import { LevelManager } from './LevelManager';
import { GameManager } from './GameManager';
import { EconomyManager } from './EconomyManager';
import { WaveManager } from './WaveManager';
import { EnemyManager } from './EnemyManager';
import { TowerManager } from './TowerManager';
import { SkillManager } from './SkillManager';

export class BattleController {
  readonly game: GameManager;
  readonly level: LevelManager;
  readonly economy: EconomyManager;
  readonly waves: WaveManager;
  readonly enemies: EnemyManager;
  readonly towers: TowerManager;
  readonly skills: SkillManager;

  constructor(private bus: EventBus<GameEvents>, config: ConfigSet, levelId: string) {
    const levelCfg = config.levels[levelId];
    this.game = new GameManager(bus);
    this.level = new LevelManager(config);
    this.economy = new EconomyManager(bus, levelCfg.initialGold, levelCfg.lives);
    this.waves = new WaveManager(bus, levelCfg.waves.map((w) => config.waves[w]));
    this.enemies = new EnemyManager(bus, config, levelCfg.waypoints);
    this.towers = new TowerManager(bus, config, this.enemies, this.economy, levelCfg.buildSlots);
    this.skills = new SkillManager(bus, config, this.enemies, this.economy, levelCfg.skills);

    // 接线：击杀加金币、漏怪扣生命
    bus.on('enemyKilled', (p) => this.economy.addGold(p.rewardGold));
    bus.on('enemyLeaked', (p) => {
      this.economy.addLives(-p.damageToBase);
      if (this.economy.isDefeated() && this.game.getState() === 'playing') {
        this.game.setState('lost');
      }
    });
  }

  start(): void {
    this.game.setState('playing');
    this.waves.startWave(0);
  }

  update(dt: number): void {
    if (this.game.getState() !== 'playing') return;
    const due = this.waves.update(dt);
    for (const type of due) this.enemies.spawn(type);
    this.towers.update(dt);
    this.skills.update(dt);
    this.enemies.update(dt);
    if (this.game.getState() !== 'playing') return; // 已失败则不再判胜/推进
    // 当前波已刷完且场上无怪 → 波结束：发奖励，推进下一波或判胜
    if (this.waves.isSpawningDone && this.enemies.remainingCount() === 0) {
      const idx = this.waves.getCurrentWaveIndex();
      const reward = this.waves.currentWaveReward;
      this.economy.addGold(reward);
      this.bus.emit('waveEnded', { waveIndex: idx, rewardGold: reward });
      if (this.waves.hasNextWave) {
        this.waves.startWave(idx + 1);
      } else {
        this.game.setState('won');
      }
    }
  }
}
