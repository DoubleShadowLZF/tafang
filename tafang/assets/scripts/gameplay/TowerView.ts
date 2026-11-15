// assets/scripts/gameplay/TowerView.ts
import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

@ccclass('TowerView')
export class TowerView extends Component {
  private level = 0;

  setLevel(level: number): void {
    this.level = level;
    const s = 1 + level * 0.35;
    this.node.setScale(s, s, s);
  }
}
