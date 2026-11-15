// assets/scripts/ui/HUD.ts
import { _decorator, Component, Label } from 'cc';
import { App } from '../core/App';
import { createLabel } from './uiKit';

const { ccclass } = _decorator;

@ccclass('HUD')
export class HUD extends Component {
  private goldLabel!: Label;
  private livesLabel!: Label;
  private waveLabel!: Label;

  onLoad(): void {
    this.goldLabel = createLabel(this.node, '', { x: -220, y: 300, fontSize: 26 });
    this.livesLabel = createLabel(this.node, '', { x: 0, y: 300, fontSize: 26 });
    this.waveLabel = createLabel(this.node, '', { x: 220, y: 300, fontSize: 26 });
  }

  refresh(): void {
    const b = App.battle;
    if (!b) return;
    this.goldLabel.string = `金币 ${b.economy.getGold()}`;
    this.livesLabel.string = `生命 ${b.economy.getLives()}`;
    this.waveLabel.string = `波次 ${b.waves.getCurrentWaveIndex() + 1}`;
  }
}
