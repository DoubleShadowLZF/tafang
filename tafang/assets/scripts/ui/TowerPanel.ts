// assets/scripts/ui/TowerPanel.ts
import { _decorator, Component, Node, Color } from 'cc';
import { App } from '../core/App';
import { TowerType } from '../data/types';
import { createPanel, createLabel, createButton } from './uiKit';

const { ccclass } = _decorator;

const TOWER_TYPES: TowerType[] = ['arrow', 'ice', 'fire', 'arcane'];

@ccclass('TowerPanel')
export class TowerPanel extends Component {
  private slotIndex = -1;
  private hasTower = false;

  onLoad(): void {
    this.node.active = false;
  }

  open(slotIndex: number, hasTower: boolean): void {
    this.slotIndex = slotIndex;
    this.hasTower = hasTower;
    this.node.active = true;
    this.render();
  }

  close(): void {
    this.node.active = false;
    this.slotIndex = -1;
  }

  private render(): void {
    this.node.removeAllChildren();
    createPanel(this.node, 'bg', 360, 260, new Color(0, 0, 0, 180));
    createLabel(this.node, this.hasTower ? '升级 / 出售' : '建造', { y: 110, fontSize: 24 });

    const b = App.battle;
    if (!b) return;

    if (this.hasTower) {
      createButton(this.node, 'upgrade', '升级', { x: 0, y: 20, onClick: () => {
        b.towers.upgradeTower(this.slotIndex);
        this.render();
      }});
      createButton(this.node, 'sell', '出售(70%)', { x: 0, y: -50, onClick: () => {
        b.towers.sellTower(this.slotIndex);
        this.close();
      }});
    } else {
      TOWER_TYPES.forEach((type, i) => {
        const cfg = App.config.towers[type];
        createButton(this.node, `tower-${type}`, `${cfg.name} ${cfg.levels[0].cost}`, {
          x: (i % 2 === 0 ? -1 : 1) * 90, y: 20 - Math.floor(i / 2) * 80, width: 150,
          onClick: () => {
            b.towers.buildTower(this.slotIndex, type);
            this.close();
          },
        });
      });
    }
    createButton(this.node, 'close', '关闭', { x: 0, y: -110, onClick: () => this.close() });
  }
}
