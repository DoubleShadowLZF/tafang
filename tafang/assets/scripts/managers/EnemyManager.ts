// assets/scripts/managers/EnemyManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet, EnemyType, Vec3, Buff } from '../data/types';
import type { EnemyRuntime } from './runtime';
import { distanceSquared, reachedWaypoint } from '../rules/waypoint';
import { slowMultiplier, tickBuffs } from '../rules/buff';
import { calculateDamage } from '../rules/damage';

const TOLERANCE = 0.01;

export class EnemyManager {
  private enemies: EnemyRuntime[] = [];
  private nextId = 1;

  constructor(
    private bus: EventBus<GameEvents>,
    private config: ConfigSet,
    private waypoints: Vec3[],
  ) {}

  spawn(type: EnemyType): number {
    const cfg = this.config.enemies[type];
    const enemy: EnemyRuntime = {
      id: this.nextId++,
      type,
      maxHp: cfg.maxHp,
      hp: cfg.maxHp,
      speed: cfg.speed,
      armor: cfg.armor,
      rewardGold: cfg.rewardGold,
      damageToBase: cfg.damageToBase,
      position: (this.waypoints[0] ? [...this.waypoints[0]] : [0, 0, 0]) as Vec3,
      waypointIndex: this.waypoints.length > 1 ? 1 : 0,
      buffs: [],
    };
    this.enemies.push(enemy);
    this.bus.emit('enemySpawned', { id: enemy.id, type });
    return enemy.id;
  }

  getEnemies(): EnemyRuntime[] {
    return this.enemies;
  }

  damageEnemy(id: number, amount: number, armorIgnore = false): void {
    const e = this.enemies.find((x) => x.id === id);
    if (!e) return;
    e.hp -= calculateDamage(amount, e.armor, armorIgnore);
  }

  applyBuff(id: number, buff: Buff): void {
    const e = this.enemies.find((x) => x.id === id);
    e?.buffs.push({ ...buff });
  }

  applyBuffToAll(buff: Buff): void {
    for (const e of this.enemies) e.buffs.push({ ...buff });
  }

  update(dt: number): void {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const burn = tickBuffs(e.buffs, dt);
      if (burn > 0) e.hp -= burn; // 燃烧为真实伤害
      const mult = slowMultiplier(e.buffs);
      if (e.waypointIndex < this.waypoints.length) {
        e.position = this.moveToward(e.position, this.waypoints[e.waypointIndex], e.speed * mult * dt);
        if (reachedWaypoint(e.position, this.waypoints[e.waypointIndex], TOLERANCE)) {
          e.waypointIndex++;
        }
      }
      if (e.waypointIndex >= this.waypoints.length) {
        this.bus.emit('enemyLeaked', { id: e.id, type: e.type, damageToBase: e.damageToBase });
      }
    }
    // 击杀结算（漏怪的不再算击杀）
    for (const e of this.enemies) {
      if (e.hp <= 0 && !this.hasLeaked(e)) {
        this.bus.emit('enemyKilled', { id: e.id, type: e.type, rewardGold: e.rewardGold });
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.waypointIndex < this.waypoints.length);
  }

  remainingCount(): number {
    return this.enemies.length;
  }

  private hasLeaked(e: EnemyRuntime): boolean {
    return e.waypointIndex >= this.waypoints.length;
  }

  private moveToward(pos: Vec3, target: Vec3, maxDist: number): Vec3 {
    const dx = target[0] - pos[0];
    const dy = target[1] - pos[1];
    const dz = target[2] - pos[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist <= maxDist || dist === 0) return [target[0], target[1], target[2]];
    const k = maxDist / dist;
    return [pos[0] + dx * k, pos[1] + dy * k, pos[2] + dz * k];
  }
}
