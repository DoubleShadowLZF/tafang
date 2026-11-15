// assets/scripts/scenes/LevelSelectScene.ts
import { _decorator, Component, Node, director } from 'cc';
import { App } from '../core/App';
import { createLabel, createButton } from '../ui/uiKit';

const { ccclass } = _decorator;

@ccclass('LevelSelectScene')
export class LevelSelectScene extends Component {
  start(): void {
    createLabel(this.node, '选择关卡', { y: 150, fontSize: 40 });
    const ids = Object.keys(App.config.levels);
    ids.forEach((id, i) => {
      const unlocked = App.save.load().unlockedLevel >= i + 1;
      createButton(this.node, `level-${id}`, `${i + 1}. ${App.config.levels[id].name}${unlocked ? '' : '(未解锁)'}`, {
        x: 0, y: 20 - i * 80, onClick: () => {
          if (!unlocked) return;
          App.pendingLevel = id; // 暂存关卡 id，供 BattleScene.start 读取
          director.loadScene('Battle');
        },
      });
    });
    createButton(this.node, 'back', '返回', { x: 0, y: 20 - ids.length * 80, onClick: () => director.loadScene('MainMenu') });
  }
}
