// assets/scripts/gameplay/BuildSlotView.ts
import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

// 建造格子仅作为可视化标记；点击拾取由 BattleScene 的全局 touch + raycast 完成
// （3D 节点不参与 2D touch 命中测试，不能在 node 上绑 TOUCH_START）。
@ccclass('BuildSlotView')
export class BuildSlotView extends Component {
  @property slotIndex = 0;
}
