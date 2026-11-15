import { EventBus } from '../core/EventBus';
import type { GameState, GameEvents } from '../core/events';

const TRANSITIONS: Record<GameState, GameState[]> = {
  menu: ['playing'],
  playing: ['paused', 'won', 'lost'],
  paused: ['playing'],
  won: ['menu'],
  lost: ['menu'],
};

export class GameManager {
  private state: GameState = 'menu';

  constructor(private bus: EventBus<GameEvents>) {}

  getState(): GameState {
    return this.state;
  }

  setState(next: GameState): void {
    if (!TRANSITIONS[this.state].includes(next)) {
      throw new Error(`非法状态转移: ${this.state} -> ${next}`);
    }
    this.state = next;
    this.bus.emit('stateChanged', { state: next });
  }
}
