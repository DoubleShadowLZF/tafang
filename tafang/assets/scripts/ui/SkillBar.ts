// assets/scripts/ui/SkillBar.ts
import { _decorator, Component, Label } from 'cc';
import { App } from '../core/App';
import { SkillType } from '../data/types';
import { createButton } from './uiKit';

const { ccclass } = _decorator;

const SKILLS: SkillType[] = ['meteor', 'frostNova', 'goldRain'];

@ccclass('SkillBar')
export class SkillBar extends Component {
  private labels = new Map<SkillType, Label>();

  onLoad(): void {
    this.render();
  }

  private render(): void {
    this.node.removeAllChildren();
    this.labels.clear();
    SKILLS.forEach((type, i) => {
      const label = createButton(this.node, `skill-${type}`, type, {
        x: (i - 1) * 130, y: -280, width: 120,
        onClick: () => this.useSkill(type),
      });
      this.labels.set(type, label);
    });
  }

  private useSkill(type: SkillType): void {
    const b = App.battle;
    if (!b) return;
    if (type === 'meteor') {
      // 陨石需点选目标点：再次点击取消；冷却/次数耗尽不可激活
      if (App.pendingSkill === 'meteor') {
        App.pendingSkill = null;
        return;
      }
      if (!b.skills.canUse('meteor')) return;
      App.pendingSkill = 'meteor';
      return;
    }
    b.skills.use(type);
  }

  update(): void {
    const b = App.battle;
    if (!b) return;
    for (const type of SKILLS) {
      const label = this.labels.get(type);
      if (!label) continue;
      const can = b.skills.canUse(type);
      const remaining = b.skills.getRemainingUses(type);
      label.string = `${App.config.skills[type].name} ${remaining}${can ? '' : '(冷却)'}`;
    }
  }
}
