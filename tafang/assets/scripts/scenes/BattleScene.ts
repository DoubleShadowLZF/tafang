// assets/scripts/scenes/BattleScene.ts
import { _decorator, Component, Node, Vec3, Color, Camera, input, Input, find } from 'cc';
import { App } from '../core/App';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { BattleController } from '../managers/BattleController';
import { EnemyView } from '../gameplay/EnemyView';
import { TowerView } from '../gameplay/TowerView';
import { BuildSlotView } from '../gameplay/BuildSlotView';
import { createPrimitive, createGround } from '../gameplay/worldKit';
import { HUD } from '../ui/HUD';
import { TowerPanel } from '../ui/TowerPanel';
import { SkillBar } from '../ui/SkillBar';
import { ResultPanel } from '../ui/ResultPanel';
import type { EnemyType } from '../data/types';

const { ccclass } = _decorator;

const ENEMY_COLORS: Record<EnemyType, Color> = {
  slime: new Color(80, 220, 120, 255),
  wolf: new Color(160, 160, 180, 255),
  golem: new Color(120, 100, 80, 255),
  bat: new Color(140, 80, 200, 255),
  elite: new Color(220, 60, 60, 255),
  boss: new Color(180, 40, 40, 255),
};

const TOWER_COLORS: Record<string, Color> = {
  arrow: new Color(100, 160, 255, 255),
  ice: new Color(120, 220, 255, 255),
  fire: new Color(255, 120, 60, 255),
  arcane: new Color(200, 120, 255, 255),
};

@ccclass('BattleScene')
export class BattleScene extends Component {
  private battle!: BattleController;
  private world!: Node;
  private camera!: Camera;
  private levelId = 'level1';
  private enemyViews = new Map<number, EnemyView>();
  private towerViews = new Map<number, TowerView>();
  private builtSlots = new Set<number>();
  private hud!: HUD;
  private towerPanel!: TowerPanel;
  private skillBar!: SkillBar;
  private resultPanel!: ResultPanel;
  private bus!: EventBus<GameEvents>;

  start(): void {
    this.levelId = App.pendingLevel ?? this.levelId ?? 'level1';
    App.currentLevel = this.levelId;
    this.bus = new EventBus<GameEvents>();
    this.battle = new BattleController(this.bus, App.config, this.levelId);
    App.battle = this.battle;
    App.pendingSkill = null;

    this.world = new Node('World');
    this.node.addChild(this.world);
    this.camera = this.buildCamera();
    const level = App.config.levels[this.levelId];
    createGround(this.world, level.waypoints);
    this.buildSlots(level.buildSlots);

    this.hud = find('Canvas/HUD')!.getComponent(HUD)!;
    this.towerPanel = find('Canvas/TowerPanel')!.getComponent(TowerPanel)!;
    this.skillBar = find('Canvas/SkillBar')!.getComponent(SkillBar)!;
    this.resultPanel = find('Canvas/ResultPanel')!.getComponent(ResultPanel)!;

    this.wireEvents();
    input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    App.wechat.onHide(() => this.tryPause());
    App.wechat.onShow(() => this.tryResume());

    this.battle.start();
  }

  private buildCamera(): Camera {
    const camNode = new Node('Camera3D');
    const cam = camNode.addComponent(Camera);
    camNode.setPosition(0, 16, -12);
    camNode.lookAt(new Vec3(0, 0, 0));
    this.node.addChild(camNode);
    return cam;
  }

  private buildSlots(slots: Vec3[]): void {
    slots.forEach((pos, i) => {
      const slotNode = createPrimitive(this.world, 1.2, new Color(90, 90, 90, 255));
      slotNode.setPosition(pos[0], 0.3, pos[2]);
      slotNode.setScale(1, 0.4, 1);
      const view = slotNode.addComponent(BuildSlotView);
      view.slotIndex = i;
    });
  }

  private wireEvents(): void {
    const bus = this.bus;
    bus.on('enemySpawned', (p) => this.onSpawn(p.id, p.type));
    bus.on('enemyKilled', (p) => this.removeEnemyView(p.id));
    bus.on('enemyLeaked', (p) => this.removeEnemyView(p.id));
    bus.on('towerBuilt', (p) => { this.builtSlots.add(p.slotIndex); this.spawnTower(p.slotIndex, p.towerType, 0); });
    bus.on('towerUpgraded', (p) => this.towerViews.get(p.slotIndex)?.setLevel(p.level));
    bus.on('towerSold', (p) => { this.builtSlots.delete(p.slotIndex); this.removeTowerView(p.slotIndex); });
    bus.on('stateChanged', (p) => {
      if (p.state === 'won' || p.state === 'lost') this.resultPanel.show(p.state);
    });
  }

  private onSpawn(id: number, type: EnemyType): void {
    const node = createPrimitive(this.world, type === 'boss' ? 1.4 : 0.9, ENEMY_COLORS[type]);
    const view = node.addComponent(EnemyView);
    view.runtime = this.battle.enemies.getEnemies().find((e) => e.id === id) ?? null;
    this.enemyViews.set(id, view);
  }

  private removeEnemyView(id: number): void {
    const view = this.enemyViews.get(id);
    if (!view) return;
    view.node.destroy();
    this.enemyViews.delete(id);
  }

  private spawnTower(slotIndex: number, type: string, level: number): void {
    const pos = App.config.levels[this.levelId].buildSlots[slotIndex];
    const node = createPrimitive(this.world, 1.0, TOWER_COLORS[type] ?? Color.WHITE);
    node.setPosition(pos[0], 0.6, pos[2]);
    const view = node.addComponent(TowerView);
    view.setLevel(level);
    this.towerViews.set(slotIndex, view);
  }

  private removeTowerView(slotIndex: number): void {
    const view = this.towerViews.get(slotIndex);
    if (!view) return;
    view.node.destroy();
    this.towerViews.delete(slotIndex);
  }

  private tryPause(): void {
    if (this.battle.game.getState() === 'playing') this.battle.game.setState('paused');
  }

  private tryResume(): void {
    if (this.battle.game.getState() === 'paused') this.battle.game.setState('playing');
  }

  private onTouch(event: any): void {
    const pt = this.screenToGround(event.getLocation());
    if (!pt) return;
    if (App.pendingSkill === 'meteor') {
      this.battle.skills.use('meteor', pt);
      App.pendingSkill = null;
      return;
    }
    const slot = this.pickBuildSlot(pt);
    if (slot >= 0) this.towerPanel.open(slot, this.builtSlots.has(slot));
  }

  private pickBuildSlot(p: Vec3): number {
    const slots = App.config.levels[this.levelId].buildSlots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if ((p[0] - s[0]) ** 2 + (p[2] - s[2]) ** 2 <= 1.2 ** 2) return i;
    }
    return -1;
  }

  private screenToGround(screenPos: { x: number; y: number }): Vec3 | null {
    const ray = this.camera.screenPointToRay(screenPos.x, screenPos.y);
    if (Math.abs(ray.d.y) < 1e-6) return null;
    const t = -ray.o.y / ray.d.y;
    if (t < 0) return null;
    return [ray.o.x + ray.d.x * t, 0, ray.o.z + ray.d.z * t];
  }

  update(dt: number): void {
    this.battle.update(dt);
    this.hud.refresh();
  }
}
