// assets/scripts/gameplay/EnemyView.ts
import { _decorator, Component } from 'cc';
import type { EnemyRuntime } from '../managers/runtime';

const { ccclass } = _decorator;

@ccclass('EnemyView')
export class EnemyView extends Component {
  runtime: EnemyRuntime | null = null;

  update(): void {
    if (!this.runtime) return;
    const p = this.runtime.position;
    // +0.5 让图元站到地面上
    this.node.setPosition(p[0], p[1] + 0.5, p[2]);
  }
}
