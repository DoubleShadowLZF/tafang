import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { addGold as clampGold, addLives as clampLives } from '../rules/economy';

export class EconomyManager {
  private gold: number;
  private lives: number;

  constructor(private bus: EventBus<GameEvents>, initialGold: number, lives: number) {
    this.gold = initialGold;
    this.lives = lives;
  }

  getGold(): number { return this.gold; }
  getLives(): number { return this.lives; }

  addGold(delta: number): void {
    this.gold = clampGold(this.gold, delta);
    this.bus.emit('goldChanged', { gold: this.gold });
  }

  spendGold(cost: number): boolean {
    if (this.gold < cost) return false;
    this.gold = clampGold(this.gold, -cost);
    this.bus.emit('goldChanged', { gold: this.gold });
    return true;
  }

  addLives(delta: number): void {
    this.lives = clampLives(this.lives, delta);
    this.bus.emit('livesChanged', { lives: this.lives });
  }

  isDefeated(): boolean {
    return this.lives <= 0;
  }
}
