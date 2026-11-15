// assets/scripts/managers/TowerManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet, TowerType, TowerConfig, Vec3 } from '../data/types';
import type { TowerRuntime, EnemyRuntime } from './runtime';
import { EnemyManager } from './EnemyManager';
import { EconomyManager } from './EconomyManager';
import { distanceSquared } from '../rules/waypoint';
import { sellRefund } from '../rules/economy';

export class TowerManager {
  private towers: TowerRuntime[] = [];

  constructor(
    private bus: EventBus<GameEvents>,
    private config: ConfigSet,
    private enemyManager: EnemyManager,
    private economy: EconomyManager,
    private buildSlots: Vec3[],
  ) {}

  buildTower(slotIndex: number, type: TowerType): boolean {
    if (this.towers.some((t) => t.slotIndex === slotIndex)) return false;
    if (slotIndex < 0 || slotIndex >= this.buildSlots.length) return false;
    const cfg = this.config.towers[type];
    if (!cfg) return false;
    const cost = cfg.levels[0].cost;
    if (!this.economy.spendGold(cost)) return false;
    this.towers.push({ slotIndex, type, level: 0, cooldown: 0, position: this.buildSlots[slotIndex] });
    this.bus.emit('towerBuilt', { slotIndex, towerType: type });
    return true;
  }

  upgradeTower(slotIndex: number): boolean {
    const t = this.towers.find((x) => x.slotIndex === slotIndex);
    if (!t) return false;
    const cfg = this.config.towers[t.type];
    const cur = cfg.levels[t.level];
    if (t.level >= cfg.levels.length - 1 || cur.upgradeCost === undefined) return false;
    if (!this.economy.spendGold(cur.upgradeCost)) return false;
    t.level++;
    this.bus.emit('towerUpgraded', { slotIndex, level: t.level });
    return true;
  }

  sellTower(slotIndex: number): number {
    const idx = this.towers.findIndex((x) => x.slotIndex === slotIndex);
    if (idx === -1) return 0;
    const t = this.towers[idx];
    const cfg = this.config.towers[t.type];
    const spent = cfg.levels.slice(0, t.level + 1).reduce((sum, l) => sum + l.cost, 0);
    const refund = sellRefund(spent);
    this.towers.splice(idx, 1);
    this.economy.addGold(refund);
    this.bus.emit('towerSold', { slotIndex, refund });
    return refund;
  }

  update(dt: number): void {
    for (const t of this.towers) {
      t.cooldown -= dt;
      const cfg = this.config.towers[t.type];
      const lvl = cfg.levels[t.level];
      if (t.cooldown > 0) continue;
      const target = this.pickTarget(t.position, lvl.range);
      if (!target) continue;
      this.attack(t, cfg, target);
      t.cooldown = lvl.attackInterval;
    }
  }

  private pickTarget(towerPos: Vec3, range: number): EnemyRuntime | null {
    let best: EnemyRuntime | null = null;
    for (const e of this.enemyManager.getEnemies()) {
      if (distanceSquared(e.position, towerPos) <= range * range) {
        if (!best || e.waypointIndex > best.waypointIndex) best = e;
      }
    }
    return best;
  }

  private attack(t: TowerRuntime, cfg: TowerConfig, target: EnemyRuntime): void {
    const lvl = cfg.levels[t.level];
    this.enemyManager.damageEnemy(target.id, lvl.atk, cfg.armorIgnore);
    if (cfg.slow) {
      this.enemyManager.applyBuff(target.id, { type: 'slow', percent: cfg.slow.percent, duration: cfg.slow.duration });
    }
    if (cfg.aoe) {
      for (const e of this.enemyManager.getEnemies()) {
        if (e.id === target.id) continue;
        if (distanceSquared(e.position, target.position) <= cfg.aoe.radius * cfg.aoe.radius) {
          this.enemyManager.damageEnemy(e.id, lvl.atk, cfg.armorIgnore);
          this.enemyManager.applyBuff(e.id, { type: 'burn', dps: cfg.aoe.burnDps, duration: cfg.aoe.burnDuration });
        }
      }
    }
  }
}
