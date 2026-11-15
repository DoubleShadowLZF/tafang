// assets/scripts/scenes/MainMenuScene.ts
import { _decorator, Component, Node, director } from 'cc';
import { App } from '../core/App';
import { createLabel, createButton } from '../ui/uiKit';

const { ccclass } = _decorator;

@ccclass('MainMenuScene')
export class MainMenuScene extends Component {
  start(): void {
    createLabel(this.node, '塔防：剑与魔法', { y: 120, fontSize: 48 });
    createButton(this.node, 'start', '开始游戏', { x: 0, y: 0, onClick: () => director.loadScene('LevelSelect') });
    createButton(this.node, 'share', '分享给好友', { x: 0, y: -80, onClick: () => App.wechat.share('来挑战我的塔防纪录！') });
  }
}
