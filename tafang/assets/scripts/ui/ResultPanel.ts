// assets/scripts/ui/ResultPanel.ts
import { _decorator, Component, director, Color } from 'cc';
import { App } from '../core/App';
import { GameState } from '../core/events';
import { createPanel, createLabel, createButton } from './uiKit';

const { ccclass } = _decorator;

@ccclass('ResultPanel')
export class ResultPanel extends Component {
  onLoad(): void {
    this.node.active = false;
  }

  show(state: GameState): void {
    this.node.active = true;
    this.node.removeAllChildren();
    createPanel(this.node, 'bg', 400, 300, new Color(0, 0, 0, 200));
    const won = state === 'won';
    createLabel(this.node, won ? '胜利！' : '失败', { y: 100, fontSize: 40 });
    if (won) this.recordResult();
    createButton(this.node, 'restart', '再来一次', { x: 0, y: 0, onClick: () => director.loadScene('Battle') });
    createButton(this.node, 'menu', '返回选关', { x: 0, y: -80, onClick: () => director.loadScene('LevelSelect') });
  }

  private recordResult(): void {
    const b = App.battle;
    if (!b) return;
    const levelId = App.currentLevel ?? 'level1';
    const stars = b.economy.getLives() >= 10 ? 3 : b.economy.getLives() >= 5 ? 2 : 1;
    App.save.recordStars(levelId, stars);
    const idx = App.config.levels[levelId] ? Object.keys(App.config.levels).indexOf(levelId) : 0;
    App.save.setUnlockedLevel(idx + 2);
    App.save.save();
  }
}
