// assets/scripts/managers/SkillManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet, SkillType, Vec3 } from '../data/types';
import { EnemyManager } from './EnemyManager';
import { EconomyManager } from './EconomyManager';
import { distanceSquared } from '../rules/waypoint';

interface SkillRuntime {
  type: SkillType;
  remainingUses: number;
  cooldownRemaining: number;
}

export class SkillManager {
  private skills: Map<SkillType, SkillRuntime> = new Map();

  constructor(
    private bus: EventBus<GameEvents>,
    private config: ConfigSet,
    private enemyManager: EnemyManager,
    private economy: EconomyManager,
    skillTypes: SkillType[],
  ) {
    for (const type of skillTypes) {
      this.skills.set(type, { type, remainingUses: config.skills[type].maxUses, cooldownRemaining: 0 });
    }
  }

  canUse(type: SkillType): boolean {
    const s = this.skills.get(type);
    if (!s) return false;
    return s.remainingUses > 0 && s.cooldownRemaining <= 0;
  }

  use(type: SkillType, target?: Vec3): boolean {
    if (!this.canUse(type)) return false;
    const cfg = this.config.skills[type];
    if (type === 'meteor' && target) {
      for (const e of this.enemyManager.getEnemies()) {
        if (distanceSquared(e.position, target) <= (cfg.radius ?? 0) ** 2) {
          this.enemyManager.damageEnemy(e.id, cfg.damage ?? 0, false);
        }
      }
    } else if (type === 'frostNova') {
      this.enemyManager.applyBuffToAll({ type: 'slow', percent: cfg.slowPercent, duration: cfg.duration ?? 0 });
    } else if (type === 'goldRain') {
      this.economy.addGold(cfg.gold ?? 0);
    }
    const s = this.skills.get(type)!;
    s.remainingUses--;
    s.cooldownRemaining = cfg.cooldown;
    this.bus.emit('skillUsed', { type });
    return true;
  }

  update(dt: number): void {
    for (const s of this.skills.values()) {
      if (s.cooldownRemaining > 0) s.cooldownRemaining = Math.max(0, s.cooldownRemaining - dt);
    }
  }

  getRemainingUses(type: SkillType): number {
    return this.skills.get(type)?.remainingUses ?? 0;
  }
}
