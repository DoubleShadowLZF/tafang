# 塔防游戏逻辑管理器层 实现计划（Plan 2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Plan 1 的纯规则层之上，实现 8 个逻辑管理器（纯 TS 类，无 Cocos 依赖），用 EventBus 解耦，可 headless 单测并模拟整场战斗。

**Architecture:** 每个管理器是构造函数注入依赖的普通类。通知类事件（金币/生命变化、生成/击杀/漏怪、状态变化）走 EventBus；热路径查询与状态修改（索敌、扣血、加 buff）通过窄接口引用完成。`BattleController` 负责把管理器组装起来、接好事件、驱动每帧 `update`。

**Tech Stack:** TypeScript 5.x、vitest 1.x，复用 Plan 1 的 `EventBus`、`rules/*`、`types.ts`。

**Spec:** `docs/superpowers/specs/2026-11-15-tower-defense-design.md`
**前序计划:** `docs/superpowers/plans/2026-11-15-tower-defense-core-rules.md`

## Global Constraints

- 管理器文件**禁止** `import 'cc'`，保证 vitest 可直接运行。
- 管理器之间不直接互相调用方法；通知走 EventBus，状态查询/修改通过构造函数注入的窄接口。
- 塔等级用 **0-based** `level`（0=初始，`levels.length-1`=最高），配置取 `tower.levels[level]`。
- 敌人索敌优先级：射程内 `waypointIndex` 最大者（离终点最近）。
- 燃烧为真实伤害（无视护甲）；减速叠加取最大比例。
- 漏怪扣生命、击杀加金币，由 `BattleController` 订阅事件统一接线。
- 所有提交信息末尾附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

---

## 文件结构

```
assets/scripts/
├── core/
│   └── events.ts                # GameState + GameEvents
├── managers/
│   ├── runtime.ts               # EnemyRuntime / TowerRuntime 运行时类型
│   ├── GameManager.ts           # 状态机
│   ├── SaveManager.ts           # 存档（注入 Storage）
│   ├── EconomyManager.ts        # 金币/生命
│   ├── LevelManager.ts          # 关卡查询
│   ├── WaveManager.ts           # 波次调度
│   ├── EnemyManager.ts          # 敌人生成/移动/受击/死亡/漏怪
│   ├── TowerManager.ts          # 塔建造/升级/出售/索敌/攻击
│   ├── SkillManager.ts          # 全局技能
│   └── BattleController.ts      # 组装 + 每帧驱动 + 胜负判定
tests/managers/
├── gameManager.test.ts
├── saveManager.test.ts
├── economyManager.test.ts
├── levelManager.test.ts
├── waveManager.test.ts
├── enemyManager.test.ts
├── towerManager.test.ts
├── skillManager.test.ts
└── battleController.test.ts
```

---

## Task 1: 事件类型与状态定义

**Files:**
- Create: `assets/scripts/core/events.ts`
- Test: `tests/managers/events.test.ts`

**Interfaces:**
- Consumes: `data/types.ts` 的 `EnemyType`、`TowerType`、`SkillType`
- Produces（后续所有管理器依赖）：
  - `type GameState = 'menu' | 'playing' | 'paused' | 'won' | 'lost'`
  - `interface GameEvents { stateChanged; goldChanged; livesChanged; waveStarted; waveEnded; enemySpawned; enemyKilled; enemyLeaked; towerBuilt; towerUpgraded; towerSold; skillUsed }`（payload 见下）

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/events.test.ts
import { describe, it, expect } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';

describe('GameEvents', () => {
  it('EventBus 可携带 GameEvents 类型', () => {
    const bus = new EventBus<GameEvents>();
    let gold = 0;
    bus.on('goldChanged', (p) => { gold = p.gold; });
    bus.emit('goldChanged', { gold: 150 });
    expect(gold).toBe(150);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/events.test.ts`
Expected: FAIL（找不到 `../../assets/scripts/core/events`）

- [ ] **Step 3: 实现 events.ts**

```ts
// assets/scripts/core/events.ts
import type { EnemyType, TowerType, SkillType } from '../data/types';

export type GameState = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

export interface GameEvents {
  stateChanged: { state: GameState };
  goldChanged: { gold: number };
  livesChanged: { lives: number };
  waveStarted: { waveIndex: number };
  waveEnded: { waveIndex: number; rewardGold: number };
  enemySpawned: { id: number; type: EnemyType };
  enemyKilled: { id: number; type: EnemyType; rewardGold: number };
  enemyLeaked: { id: number; type: EnemyType; damageToBase: number };
  towerBuilt: { slotIndex: number; towerType: TowerType };
  towerUpgraded: { slotIndex: number; level: number };
  towerSold: { slotIndex: number; refund: number };
  skillUsed: { type: SkillType };
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/core/events.ts tests/managers/events.test.ts
git commit -m "feat(core): 游戏事件与状态类型

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: GameManager 状态机

**Files:**
- Create: `assets/scripts/managers/GameManager.ts`
- Test: `tests/managers/gameManager.test.ts`

**Interfaces:**
- Consumes: `EventBus`、`GameState`、`GameEvents`
- Produces（BattleController 依赖）：
  - `class GameManager`
  - `constructor(bus: EventBus<GameEvents>)`
  - `getState(): GameState`
  - `setState(next: GameState): void`（非法转移抛错，合法转移 emit `stateChanged`）

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/gameManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { GameManager } from '../../assets/scripts/managers/GameManager';

describe('GameManager', () => {
  it('初始状态为 menu', () => {
    const gm = new GameManager(new EventBus<GameEvents>());
    expect(gm.getState()).toBe('menu');
  });

  it('合法转移并 emit stateChanged', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('stateChanged', fn);
    const gm = new GameManager(bus);
    gm.setState('playing');
    expect(gm.getState()).toBe('playing');
    expect(fn).toHaveBeenCalledWith({ state: 'playing' });
  });

  it('非法转移抛错', () => {
    const gm = new GameManager(new EventBus<GameEvents>());
    expect(() => gm.setState('won')).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/gameManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/GameManager.ts
import { EventBus } from '../core/EventBus';
import type { GameState, GameEvents } from '../core/events';

const TRANSITIONS: Record<GameState, GameState[]> = {
  menu: ['playing'],
  playing: ['paused', 'won', 'lost'],
  paused: ['playing'],
  won: ['menu'],
  lost: ['menu'],
};

export class GameManager {
  private state: GameState = 'menu';

  constructor(private bus: EventBus<GameEvents>) {}

  getState(): GameState {
    return this.state;
  }

  setState(next: GameState): void {
    if (!TRANSITIONS[this.state].includes(next)) {
      throw new Error(`非法状态转移: ${this.state} -> ${next}`);
    }
    this.state = next;
    this.bus.emit('stateChanged', { state: next });
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/GameManager.ts tests/managers/gameManager.test.ts
git commit -m "feat(managers): GameManager 状态机

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: SaveManager 存档

**Files:**
- Create: `assets/scripts/managers/SaveManager.ts`
- Test: `tests/managers/saveManager.test.ts`

**Interfaces:**
- Consumes: `rules/save` 的 `normalizeSaveData`、`DEFAULT_SAVE`；`types.ts` 的 `SaveData`
- Produces（Plan 3 依赖）：
  - `interface Storage { get(key: string): string | null; set(key: string, value: string): void }`
  - `class SaveManager`
  - `constructor(storage: Storage)`
  - `load(): SaveData`
  - `recordStars(levelId: string, stars: number): void`
  - `setUnlockedLevel(n: number): void`
  - `save(): void`

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/saveManager.test.ts
import { describe, it, expect } from 'vitest';
import { SaveManager, Storage } from '../../assets/scripts/managers/SaveManager';

class MemoryStorage implements Storage {
  map = new Map<string, string>();
  get(key: string) { return this.map.get(key) ?? null; }
  set(key: string, value: string) { this.map.set(key, value); }
}

describe('SaveManager', () => {
  it('空存储返回默认存档', () => {
    const sm = new SaveManager(new MemoryStorage());
    expect(sm.load().unlockedLevel).toBe(1);
    expect(sm.load().totalGold).toBe(0);
  });

  it('recordStars 取更高星', () => {
    const sm = new SaveManager(new MemoryStorage());
    sm.recordStars('level1', 2);
    sm.recordStars('level1', 3);
    sm.recordStars('level1', 1);
    expect(sm.load().levelStars['level1']).toBe(3);
  });

  it('save 后可被 load 读回', () => {
    const storage = new MemoryStorage();
    const sm = new SaveManager(storage);
    sm.recordStars('level1', 3);
    sm.setUnlockedLevel(2);
    sm.save();
    const sm2 = new SaveManager(storage);
    expect(sm2.load().unlockedLevel).toBe(2);
    expect(sm2.load().levelStars['level1']).toBe(3);
  });

  it('损坏的存档回退默认', () => {
    const storage = new MemoryStorage();
    storage.set('tafang_save', 'not-json{');
    const sm = new SaveManager(storage);
    expect(sm.load().unlockedLevel).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/saveManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/SaveManager.ts
import type { SaveData } from '../data/types';
import { normalizeSaveData, DEFAULT_SAVE } from '../rules/save';

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const KEY = 'tafang_save';

export class SaveManager {
  private cache: SaveData;

  constructor(private storage: Storage) {
    this.cache = this.read();
  }

  private read(): SaveData {
    const raw = this.storage.get(KEY);
    if (raw === null) return { ...DEFAULT_SAVE };
    try {
      return normalizeSaveData(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  load(): SaveData {
    return this.cache;
  }

  recordStars(levelId: string, stars: number): void {
    const prev = this.cache.levelStars[levelId] ?? 0;
    this.cache.levelStars[levelId] = Math.max(prev, stars);
  }

  setUnlockedLevel(n: number): void {
    this.cache.unlockedLevel = Math.max(this.cache.unlockedLevel, n);
  }

  save(): void {
    this.storage.set(KEY, JSON.stringify(this.cache));
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/SaveManager.ts tests/managers/saveManager.test.ts
git commit -m "feat(managers): SaveManager 存档

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: EconomyManager 经济

**Files:**
- Create: `assets/scripts/managers/EconomyManager.ts`
- Test: `tests/managers/economyManager.test.ts`

**Interfaces:**
- Consumes: `rules/economy` 的 `addGold`、`addLives`；`EventBus`、`GameEvents`
- Produces（TowerManager/SkillManager/BattleController 依赖）：
  - `class EconomyManager`
  - `constructor(bus: EventBus<GameEvents>, initialGold: number, lives: number)`
  - `getGold(): number`、`getLives(): number`
  - `addGold(delta: number): void`（emit `goldChanged`）
  - `spendGold(cost: number): boolean`（足够则扣并 emit，返回 true；否则 false）
  - `addLives(delta: number): void`（emit `livesChanged`）
  - `isDefeated(): boolean`

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/economyManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { EconomyManager } from '../../assets/scripts/managers/EconomyManager';

describe('EconomyManager', () => {
  it('初始金币/生命', () => {
    const em = new EconomyManager(new EventBus<GameEvents>(), 200, 20);
    expect(em.getGold()).toBe(200);
    expect(em.getLives()).toBe(20);
  });

  it('spendGold 足够则扣、不足则拒绝', () => {
    const em = new EconomyManager(new EventBus<GameEvents>(), 100, 20);
    expect(em.spendGold(60)).toBe(true);
    expect(em.getGold()).toBe(40);
    expect(em.spendGold(100)).toBe(false);
    expect(em.getGold()).toBe(40);
  });

  it('addGold/addLives 钳制到 0 并 emit', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EconomyManager(bus, 10, 1);
    const goldFn = vi.fn();
    bus.on('goldChanged', goldFn);
    em.addGold(-999);
    expect(em.getGold()).toBe(0);
    expect(goldFn).toHaveBeenCalledWith({ gold: 0 });
    em.addLives(-5);
    expect(em.getLives()).toBe(0);
    expect(em.isDefeated()).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/economyManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/EconomyManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { addGold as clampGold, addLives as clampLives } from '../rules/economy';

export class EconomyManager {
  private gold: number;
  private lives: number;

  constructor(private bus: EventBus<GameEvents>, initialGold: number, lives: number) {
    this.gold = initialGold;
    this.lives = lives;
  }

  getGold(): number { return this.gold; }
  getLives(): number { return this.lives; }

  addGold(delta: number): void {
    this.gold = clampGold(this.gold, delta);
    this.bus.emit('goldChanged', { gold: this.gold });
  }

  spendGold(cost: number): boolean {
    if (this.gold < cost) return false;
    this.gold = clampGold(this.gold, -cost);
    this.bus.emit('goldChanged', { gold: this.gold });
    return true;
  }

  addLives(delta: number): void {
    this.lives = clampLives(this.lives, delta);
    this.bus.emit('livesChanged', { lives: this.lives });
  }

  isDefeated(): boolean {
    return this.lives <= 0;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/EconomyManager.ts tests/managers/economyManager.test.ts
git commit -m "feat(managers): EconomyManager 经济

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: LevelManager 关卡查询

**Files:**
- Create: `assets/scripts/managers/LevelManager.ts`
- Test: `tests/managers/levelManager.test.ts`

**Interfaces:**
- Consumes: `types.ts` 的 `ConfigSet`、`LevelConfig`
- Produces：
  - `class LevelManager`
  - `constructor(config: ConfigSet)`
  - `getLevelIds(): string[]`
  - `getLevel(levelId: string): LevelConfig`（缺失抛错）

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/levelManager.test.ts
import { describe, it, expect } from 'vitest';
import { LevelManager } from '../../assets/scripts/managers/LevelManager';
import type { ConfigSet } from '../../assets/scripts/data/types';

function makeConfig(): ConfigSet {
  return {
    towers: {} as any,
    enemies: {} as any,
    levels: {
      level1: { name: '初始之森', initialGold: 200, lives: 20, waypoints: [[0,0,0],[1,0,0]], buildSlots: [], waves: ['w1'], skills: ['meteor'] },
      level2: { name: '幽暗洞穴', initialGold: 300, lives: 20, waypoints: [], buildSlots: [], waves: [], skills: [] },
    },
    waves: {} as any,
    skills: {} as any,
  };
}

describe('LevelManager', () => {
  it('getLevelIds 返回所有关卡 id', () => {
    const lm = new LevelManager(makeConfig());
    expect(lm.getLevelIds()).toEqual(['level1', 'level2']);
  });

  it('getLevel 返回关卡配置', () => {
    const lm = new LevelManager(makeConfig());
    expect(lm.getLevel('level1').name).toBe('初始之森');
  });

  it('缺失关卡抛错', () => {
    const lm = new LevelManager(makeConfig());
    expect(() => lm.getLevel('nope')).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/levelManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/LevelManager.ts
import type { ConfigSet, LevelConfig } from '../data/types';

export class LevelManager {
  constructor(private config: ConfigSet) {}

  getLevelIds(): string[] {
    return Object.keys(this.config.levels);
  }

  getLevel(levelId: string): LevelConfig {
    const level = this.config.levels[levelId];
    if (!level) throw new Error(`关卡 ${levelId} 不存在`);
    return level;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/LevelManager.ts tests/managers/levelManager.test.ts
git commit -m "feat(managers): LevelManager 关卡查询

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: WaveManager 波次调度

**Files:**
- Create: `assets/scripts/managers/WaveManager.ts`
- Test: `tests/managers/waveManager.test.ts`

**Interfaces:**
- Consumes: `rules/wave` 的 `buildSpawnSchedule`；`types.ts` 的 `WaveConfig`、`EnemyType`；`EventBus`、`GameEvents`
- Produces（BattleController 依赖）：
  - `type WavePhase = 'idle' | 'preparing' | 'spawning' | 'completed'`
  - `class WaveManager`
  - `constructor(bus: EventBus<GameEvents>, waves: WaveConfig[])`
  - `startWave(index: number): void`（emit `waveStarted`）
  - `update(dt: number): EnemyType[]`（返回本帧应生成敌人类型；波结束 emit `waveEnded`）
  - `getCurrentWaveIndex(): number`
  - `get allWavesDone(): boolean`

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/waveManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { WaveManager } from '../../assets/scripts/managers/WaveManager';
import type { WaveConfig } from '../../assets/scripts/data/types';

const waves: WaveConfig[] = [
  { prepareTime: 2, rewardGold: 50, spawns: [{ type: 'slime', count: 2, interval: 1.0 }] },
];

function setup() {
  const bus = new EventBus<GameEvents>();
  const started = vi.fn();
  const ended = vi.fn();
  bus.on('waveStarted', started);
  bus.on('waveEnded', ended);
  const wm = new WaveManager(bus, waves);
  return { wm, started, ended };
}

describe('WaveManager', () => {
  it('startWave 进入准备阶段并 emit waveStarted', () => {
    const { wm, started } = setup();
    wm.startWave(0);
    expect(started).toHaveBeenCalledWith({ waveIndex: 0 });
    expect(wm.getCurrentWaveIndex()).toBe(0);
  });

  it('准备期不生成，准备结束后按间隔生成', () => {
    const { wm } = setup();
    wm.startWave(0);
    expect(wm.update(1.0)).toEqual([]);          // 准备中
    expect(wm.update(1.1)).toEqual([]);          // 准备结束，进入 spawning
    expect(wm.update(0.5)).toEqual(['slime']);   // 首个 spawn（atTime=0）
    expect(wm.update(0.4)).toEqual([]);          // 累积到 0.9，未到第二个
    expect(wm.update(0.1)).toEqual(['slime']);   // 累积到 1.0，第二个 spawn
  });

  it('全部生成后 emit waveEnded 且 allWavesDone', () => {
    const { wm, ended } = setup();
    wm.startWave(0);
    wm.update(3.0); // 跨过准备期
    wm.update(3.0); // 跨过全部生成
    expect(ended).toHaveBeenCalledWith({ waveIndex: 0, rewardGold: 50 });
    expect(wm.allWavesDone).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/waveManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/WaveManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { WaveConfig, EnemyType } from '../data/types';
import { buildSpawnSchedule } from '../rules/wave';

export type WavePhase = 'idle' | 'preparing' | 'spawning' | 'completed';

export class WaveManager {
  private waveIndex = -1;
  private phase: WavePhase = 'idle';
  private prepareRemaining = 0;
  private schedule: { type: EnemyType; atTime: number }[] = [];
  private spawnCursor = 0;
  private elapsed = 0;

  constructor(private bus: EventBus<GameEvents>, private waves: WaveConfig[]) {}

  startWave(index: number): void {
    this.waveIndex = index;
    this.phase = 'preparing';
    this.prepareRemaining = this.waves[index].prepareTime;
    this.elapsed = 0;
    this.spawnCursor = 0;
    this.bus.emit('waveStarted', { waveIndex: index });
  }

  update(dt: number): EnemyType[] {
    const due: EnemyType[] = [];
    if (this.phase === 'preparing') {
      this.prepareRemaining -= dt;
      if (this.prepareRemaining <= 0) {
        this.phase = 'spawning';
        this.schedule = buildSpawnSchedule(this.waves[this.waveIndex]);
      }
      return due;
    }
    if (this.phase === 'spawning') {
      this.elapsed += dt;
      while (this.spawnCursor < this.schedule.length && this.schedule[this.spawnCursor].atTime <= this.elapsed) {
        due.push(this.schedule[this.spawnCursor].type);
        this.spawnCursor++;
      }
      if (this.spawnCursor >= this.schedule.length) {
        this.phase = 'completed';
        this.bus.emit('waveEnded', {
          waveIndex: this.waveIndex,
          rewardGold: this.waves[this.waveIndex].rewardGold,
        });
      }
    }
    return due;
  }

  getCurrentWaveIndex(): number {
    return this.waveIndex;
  }

  get allWavesDone(): boolean {
    return this.waveIndex === this.waves.length - 1 && this.phase === 'completed';
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/WaveManager.ts tests/managers/waveManager.test.ts
git commit -m "feat(managers): WaveManager 波次调度

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: EnemyManager 敌人

**Files:**
- Create: `assets/scripts/managers/runtime.ts`
- Create: `assets/scripts/managers/EnemyManager.ts`
- Test: `tests/managers/enemyManager.test.ts`

**Interfaces:**
- Consumes: `rules/waypoint` 的 `distanceSquared`、`reachedWaypoint`；`rules/buff` 的 `slowMultiplier`、`tickBuffs`；`types.ts` 的 `EnemyType`、`EnemyConfig`、`Vec3`、`Buff`；`EventBus`、`GameEvents`
- Produces（TowerManager/SkillManager/BattleController 依赖）：
  - `interface EnemyRuntime { id; type; maxHp; hp; speed; armor; rewardGold; damageToBase; position: Vec3; waypointIndex: number; buffs: Buff[] }`
  - `class EnemyManager`
  - `constructor(bus: EventBus<GameEvents>, config: ConfigSet, waypoints: Vec3[])`
  - `spawn(type: EnemyType): number`（返回 id，emit `enemySpawned`）
  - `getEnemies(): EnemyRuntime[]`
  - `damageEnemy(id: number, amount: number, armorIgnore?: boolean): void`
  - `applyBuff(id: number, buff: Buff): void`
  - `applyBuffToAll(buff: Buff): void`
  - `update(dt: number): void`
  - `remainingCount(): number`

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/enemyManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { EnemyManager } from '../../assets/scripts/managers/EnemyManager';
import type { ConfigSet, Vec3 } from '../../assets/scripts/data/types';

const waypoints: Vec3[] = [[0, 0, 0], [10, 0, 0]];

function makeConfig(): ConfigSet {
  return {
    towers: {} as any,
    enemies: {
      slime: { maxHp: 40, speed: 2, armor: 0, rewardGold: 5, damageToBase: 1 },
    },
    levels: {} as any,
    waves: {} as any,
    skills: {} as any,
  };
}

describe('EnemyManager', () => {
  it('spawn 生成敌人并 emit enemySpawned', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('enemySpawned', fn);
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const id = em.spawn('slime');
    expect(id).toBe(1);
    expect(fn).toHaveBeenCalledWith({ id: 1, type: 'slime' });
    expect(em.getEnemies()).toHaveLength(1);
  });

  it('update 推进敌人位置', () => {
    const em = new EnemyManager(new EventBus<GameEvents>(), makeConfig(), waypoints);
    em.spawn('slime');
    em.update(1.0); // speed=2，前进 2 单位
    const e = em.getEnemies()[0];
    expect(e.position[0]).toBeCloseTo(2);
  });

  it('走完全程漏怪并 emit enemyLeaked', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('enemyLeaked', fn);
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    em.spawn('slime');
    em.update(10.0); // 足够走完 10 单位
    expect(fn).toHaveBeenCalledWith({ id: 1, type: 'slime', damageToBase: 1 });
    expect(em.remainingCount()).toBe(0);
  });

  it('damageEnemy 扣血并击杀', () => {
    const bus = new EventBus<GameEvents>();
    const fn = vi.fn();
    bus.on('enemyKilled', fn);
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    em.spawn('slime');
    em.damageEnemy(1, 999);
    em.update(0);
    expect(fn).toHaveBeenCalledWith({ id: 1, type: 'slime', rewardGold: 5 });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/enemyManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 runtime.ts**

```ts
// assets/scripts/managers/runtime.ts
import type { EnemyType, Vec3, Buff } from '../data/types';

export interface EnemyRuntime {
  id: number;
  type: EnemyType;
  maxHp: number;
  hp: number;
  speed: number;
  armor: number;
  rewardGold: number;
  damageToBase: number;
  position: Vec3;
  waypointIndex: number; // 下一个目标路点下标
  buffs: Buff[];
}
```

- [ ] **Step 4: 实现 EnemyManager**

```ts
// assets/scripts/managers/EnemyManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet, EnemyType, Vec3, Buff } from '../data/types';
import type { EnemyRuntime } from './runtime';
import { distanceSquared, reachedWaypoint } from '../rules/waypoint';
import { slowMultiplier, tickBuffs } from '../rules/buff';
import { calculateDamage } from '../rules/damage';

const TOLERANCE = 0.01;

export class EnemyManager {
  private enemies: EnemyRuntime[] = [];
  private nextId = 1;

  constructor(
    private bus: EventBus<GameEvents>,
    private config: ConfigSet,
    private waypoints: Vec3[],
  ) {}

  spawn(type: EnemyType): number {
    const cfg = this.config.enemies[type];
    const enemy: EnemyRuntime = {
      id: this.nextId++,
      type,
      maxHp: cfg.maxHp,
      hp: cfg.maxHp,
      speed: cfg.speed,
      armor: cfg.armor,
      rewardGold: cfg.rewardGold,
      damageToBase: cfg.damageToBase,
      position: (this.waypoints[0] ? [...this.waypoints[0]] : [0, 0, 0]) as Vec3,
      waypointIndex: this.waypoints.length > 1 ? 1 : 0,
      buffs: [],
    };
    this.enemies.push(enemy);
    this.bus.emit('enemySpawned', { id: enemy.id, type });
    return enemy.id;
  }

  getEnemies(): EnemyRuntime[] {
    return this.enemies;
  }

  damageEnemy(id: number, amount: number, armorIgnore = false): void {
    const e = this.enemies.find((x) => x.id === id);
    if (!e) return;
    e.hp -= calculateDamage(amount, e.armor, armorIgnore);
  }

  applyBuff(id: number, buff: Buff): void {
    const e = this.enemies.find((x) => x.id === id);
    e?.buffs.push({ ...buff });
  }

  applyBuffToAll(buff: Buff): void {
    for (const e of this.enemies) e.buffs.push({ ...buff });
  }

  update(dt: number): void {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const burn = tickBuffs(e.buffs, dt);
      if (burn > 0) e.hp -= burn; // 燃烧为真实伤害
      const mult = slowMultiplier(e.buffs);
      if (e.waypointIndex < this.waypoints.length) {
        e.position = this.moveToward(e.position, this.waypoints[e.waypointIndex], e.speed * mult * dt);
        if (reachedWaypoint(e.position, this.waypoints[e.waypointIndex], TOLERANCE)) {
          e.waypointIndex++;
        }
      }
      if (e.waypointIndex >= this.waypoints.length) {
        this.bus.emit('enemyLeaked', { id: e.id, type: e.type, damageToBase: e.damageToBase });
      }
    }
    // 击杀结算（漏怪的不再算击杀）
    for (const e of this.enemies) {
      if (e.hp <= 0 && !this.hasLeaked(e)) {
        this.bus.emit('enemyKilled', { id: e.id, type: e.type, rewardGold: e.rewardGold });
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.waypointIndex < this.waypoints.length);
  }

  remainingCount(): number {
    return this.enemies.length;
  }

  private hasLeaked(e: EnemyRuntime): boolean {
    return e.waypointIndex >= this.waypoints.length;
  }

  private moveToward(pos: Vec3, target: Vec3, maxDist: number): Vec3 {
    const dx = target[0] - pos[0];
    const dy = target[1] - pos[1];
    const dz = target[2] - pos[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist <= maxDist || dist === 0) return [target[0], target[1], target[2]];
    const k = maxDist / dist;
    return [pos[0] + dx * k, pos[1] + dy * k, pos[2] + dz * k];
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add assets/scripts/managers/runtime.ts assets/scripts/managers/EnemyManager.ts tests/managers/enemyManager.test.ts
git commit -m "feat(managers): EnemyManager 敌人（移动/受击/漏怪）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: TowerManager 塔

**Files:**
- Modify: `assets/scripts/managers/runtime.ts`（追加 `TowerRuntime`）
- Create: `assets/scripts/managers/TowerManager.ts`
- Test: `tests/managers/towerManager.test.ts`

**Interfaces:**
- Consumes: `EnemyManager`、`EconomyManager`；`types.ts` 的 `TowerType`、`TowerConfig`；`rules/damage` 的 `calculateDamage`；`rules/waypoint` 的 `distanceSquared`；`EventBus`、`GameEvents`
- Produces：
  - `interface TowerRuntime { slotIndex; type; level; cooldown }`（`level` 0-based）
  - `class TowerManager`
  - `constructor(bus, config: ConfigSet, enemyManager: EnemyManager, economy: EconomyManager)`
  - `buildTower(slotIndex: number, type: TowerType): boolean`
  - `upgradeTower(slotIndex: number): boolean`
  - `sellTower(slotIndex: number): number`（返回返还金币，无塔返回 0）
  - `update(dt: number): void`

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/towerManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { TowerManager } from '../../assets/scripts/managers/TowerManager';
import { EnemyManager } from '../../assets/scripts/managers/EnemyManager';
import { EconomyManager } from '../../assets/scripts/managers/EconomyManager';
import type { ConfigSet, Vec3 } from '../../assets/scripts/data/types';

const waypoints: Vec3[] = [[0, 0, 0], [10, 0, 0]];

function makeConfig(): ConfigSet {
  return {
    towers: {
      arrow: { name: '箭塔', levels: [
        { cost: 50, atk: 10, range: 5, attackInterval: 1.0, upgradeCost: 60 },
        { cost: 60, atk: 20, range: 6, attackInterval: 1.0 },
      ] },
      arcane: { name: '奥术塔', armorIgnore: true, levels: [
        { cost: 100, atk: 50, range: 5, attackInterval: 1.0 },
      ] },
    } as any,
    enemies: { slime: { maxHp: 100, speed: 0, armor: 100, rewardGold: 5, damageToBase: 1 } },
    levels: {} as any,
    waves: {} as any,
    skills: {} as any,
  };
}

const buildSlots: Vec3[] = Array.from({ length: 6 }, (): Vec3 => [0, 0, 0]);

function setup() {
  const bus = new EventBus<GameEvents>();
  const em = new EnemyManager(bus, makeConfig(), waypoints);
  const eco = new EconomyManager(bus, 500, 20);
  const tm = new TowerManager(bus, makeConfig(), em, eco, buildSlots);
  return { bus, em, eco, tm };
}

describe('TowerManager', () => {
  it('buildTower 扣钱并创建', () => {
    const { tm, eco } = setup();
    expect(tm.buildTower(0, 'arrow')).toBe(true);
    expect(eco.getGold()).toBe(450);
  });

  it('金币不足则建造失败', () => {
    const { tm } = setup();
    expect(tm.buildTower(0, 'arcane')).toBe(true);
    expect(tm.buildTower(1, 'arcane')).toBe(true);
    expect(tm.buildTower(2, 'arcane')).toBe(true);
    expect(tm.buildTower(3, 'arcane')).toBe(true);
    expect(tm.buildTower(4, 'arcane')).toBe(true);
    expect(tm.buildTower(5, 'arcane')).toBe(false); // 500 只够 5 座
  });

  it('upgradeTower 升级并扣 upgradeCost', () => {
    const { tm, eco } = setup();
    tm.buildTower(0, 'arrow');
    expect(tm.upgradeTower(0)).toBe(true);
    expect(eco.getGold()).toBe(500 - 50 - 60);
  });

  it('sellTower 返还 70%', () => {
    const { tm } = setup();
    tm.buildTower(0, 'arrow');
    expect(tm.sellTower(0)).toBe(Math.round(50 * 0.7));
  });

  it('update 索敌并攻击（奥术塔无视护甲）', () => {
    const { em, tm } = setup();
    tm.buildTower(0, 'arcane'); // 范围 5，敌人在原点
    const id = em.spawn('slime');
    tm.update(1.1); // 冷却 1s，敌人 hp=100，奥术塔 atk=50 无视护甲
    const e = em.getEnemies().find((x) => x.id === id)!;
    expect(e.hp).toBe(50);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/towerManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 追加 TowerRuntime 到 runtime.ts**

在 `assets/scripts/managers/runtime.ts` 末尾追加：

```ts
import type { TowerType, Vec3 } from '../data/types';

export interface TowerRuntime {
  slotIndex: number;
  type: TowerType;
  level: number;    // 0-based，配置取 levels[level]
  cooldown: number; // 剩余冷却秒数
  position: Vec3;   // 塔所在槽位坐标
}
```

- [ ] **Step 4: 实现 TowerManager**

```ts
// assets/scripts/managers/TowerManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet, TowerType, TowerConfig, Vec3 } from '../data/types';
import type { TowerRuntime, EnemyRuntime } from './runtime';
import { EnemyManager } from './EnemyManager';
import { EconomyManager } from './EconomyManager';
import { distanceSquared } from '../rules/waypoint';
import { sellRefund } from '../rules/economy';

export class TowerManager {
  private towers: TowerRuntime[] = [];

  constructor(
    private bus: EventBus<GameEvents>,
    private config: ConfigSet,
    private enemyManager: EnemyManager,
    private economy: EconomyManager,
    private buildSlots: Vec3[],
  ) {}

  buildTower(slotIndex: number, type: TowerType): boolean {
    if (this.towers.some((t) => t.slotIndex === slotIndex)) return false;
    if (slotIndex < 0 || slotIndex >= this.buildSlots.length) return false;
    const cfg = this.config.towers[type];
    if (!cfg) return false;
    const cost = cfg.levels[0].cost;
    if (!this.economy.spendGold(cost)) return false;
    this.towers.push({ slotIndex, type, level: 0, cooldown: 0, position: this.buildSlots[slotIndex] });
    this.bus.emit('towerBuilt', { slotIndex, towerType: type });
    return true;
  }

  upgradeTower(slotIndex: number): boolean {
    const t = this.towers.find((x) => x.slotIndex === slotIndex);
    if (!t) return false;
    const cfg = this.config.towers[t.type];
    const cur = cfg.levels[t.level];
    if (t.level >= cfg.levels.length - 1 || cur.upgradeCost === undefined) return false;
    if (!this.economy.spendGold(cur.upgradeCost)) return false;
    t.level++;
    this.bus.emit('towerUpgraded', { slotIndex, level: t.level });
    return true;
  }

  sellTower(slotIndex: number): number {
    const idx = this.towers.findIndex((x) => x.slotIndex === slotIndex);
    if (idx === -1) return 0;
    const t = this.towers[idx];
    const cfg = this.config.towers[t.type];
    const spent = cfg.levels.slice(0, t.level + 1).reduce((sum, l) => sum + l.cost, 0);
    const refund = sellRefund(spent);
    this.towers.splice(idx, 1);
    this.economy.addGold(refund);
    this.bus.emit('towerSold', { slotIndex, refund });
    return refund;
  }

  update(dt: number): void {
    for (const t of this.towers) {
      t.cooldown -= dt;
      const cfg = this.config.towers[t.type];
      const lvl = cfg.levels[t.level];
      if (t.cooldown > 0) continue;
      const target = this.pickTarget(t.position, lvl.range);
      if (!target) continue;
      this.attack(t, cfg, target);
      t.cooldown = lvl.attackInterval;
    }
  }

  private pickTarget(towerPos: Vec3, range: number): EnemyRuntime | null {
    let best: EnemyRuntime | null = null;
    for (const e of this.enemyManager.getEnemies()) {
      if (distanceSquared(e.position, towerPos) <= range * range) {
        if (!best || e.waypointIndex > best.waypointIndex) best = e;
      }
    }
    return best;
  }

  private attack(t: TowerRuntime, cfg: TowerConfig, target: EnemyRuntime): void {
    const lvl = cfg.levels[t.level];
    this.enemyManager.damageEnemy(target.id, lvl.atk, cfg.armorIgnore);
    if (cfg.slow) {
      this.enemyManager.applyBuff(target.id, { type: 'slow', percent: cfg.slow.percent, duration: cfg.slow.duration });
    }
    if (cfg.aoe) {
      for (const e of this.enemyManager.getEnemies()) {
        if (e.id === target.id) continue;
        if (distanceSquared(e.position, target.position) <= cfg.aoe.radius * cfg.aoe.radius) {
          this.enemyManager.damageEnemy(e.id, lvl.atk, cfg.armorIgnore);
          this.enemyManager.applyBuff(e.id, { type: 'burn', dps: cfg.aoe.burnDps, duration: cfg.aoe.burnDuration });
        }
      }
    }
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add assets/scripts/managers/runtime.ts assets/scripts/managers/TowerManager.ts tests/managers/towerManager.test.ts
git commit -m "feat(managers): TowerManager 塔（建造/升级/出售/攻击）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 9: SkillManager 全局技能

**Files:**
- Create: `assets/scripts/managers/SkillManager.ts`
- Test: `tests/managers/skillManager.test.ts`

**Interfaces:**
- Consumes: `EnemyManager`、`EconomyManager`；`types.ts` 的 `SkillType`、`SkillConfig`、`Vec3`；`rules/waypoint` 的 `distanceSquared`；`EventBus`、`GameEvents`
- Produces（BattleController 依赖）：
  - `class SkillManager`
  - `constructor(bus, config: ConfigSet, enemyManager: EnemyManager, economy: EconomyManager, skills: SkillType[])`
  - `canUse(type: SkillType): boolean`
  - `use(type: SkillType, target?: Vec3): boolean`
  - `update(dt: number): void`
  - `getRemainingUses(type: SkillType): number`

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/skillManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { SkillManager } from '../../assets/scripts/managers/SkillManager';
import { EnemyManager } from '../../assets/scripts/managers/EnemyManager';
import { EconomyManager } from '../../assets/scripts/managers/EconomyManager';
import type { ConfigSet, Vec3 } from '../../assets/scripts/data/types';

const waypoints: Vec3[] = [[0, 0, 0], [10, 0, 0]];

function makeConfig(): ConfigSet {
  return {
    towers: {} as any,
    enemies: { slime: { maxHp: 100, speed: 0, armor: 0, rewardGold: 5, damageToBase: 1 } },
    levels: {} as any,
    waves: {} as any,
    skills: {
      meteor: { name: '陨石术', damage: 100, radius: 3, cooldown: 30, maxUses: 2 },
      frostNova: { name: '冰霜新星', slowPercent: 0.6, duration: 5, cooldown: 20, maxUses: 3 },
      goldRain: { name: '金币雨', gold: 150, cooldown: 45, maxUses: 1 },
    },
  };
}

describe('SkillManager', () => {
  it('meteor 对范围内敌人造成伤害', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['meteor']);
    const id = em.spawn('slime');
    expect(sm.use('meteor', [0, 0, 0])).toBe(true);
    expect(em.getEnemies().find((x) => x.id === id)!.hp).toBe(0);
  });

  it('goldRain 加金币', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['goldRain']);
    expect(sm.use('goldRain')).toBe(true);
    expect(eco.getGold()).toBe(150);
  });

  it('冷却中不可释放', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['meteor']);
    sm.use('meteor', [0, 0, 0]);
    expect(sm.canUse('meteor')).toBe(false);
    sm.update(31);
    expect(sm.canUse('meteor')).toBe(true);
  });

  it('次数耗尽不可释放', () => {
    const bus = new EventBus<GameEvents>();
    const em = new EnemyManager(bus, makeConfig(), waypoints);
    const eco = new EconomyManager(bus, 0, 20);
    const sm = new SkillManager(bus, makeConfig(), em, eco, ['meteor']);
    sm.use('meteor', [0, 0, 0]);
    sm.update(31);
    sm.use('meteor', [0, 0, 0]);
    expect(sm.getRemainingUses('meteor')).toBe(0);
    expect(sm.canUse('meteor')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/skillManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/SkillManager.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet, SkillType, Vec3 } from '../data/types';
import { EnemyManager } from './EnemyManager';
import { EconomyManager } from './EconomyManager';
import { distanceSquared } from '../rules/waypoint';

interface SkillRuntime {
  type: SkillType;
  remainingUses: number;
  cooldownRemaining: number;
}

export class SkillManager {
  private skills: Map<SkillType, SkillRuntime> = new Map();

  constructor(
    private bus: EventBus<GameEvents>,
    private config: ConfigSet,
    private enemyManager: EnemyManager,
    private economy: EconomyManager,
    skillTypes: SkillType[],
  ) {
    for (const type of skillTypes) {
      this.skills.set(type, { type, remainingUses: config.skills[type].maxUses, cooldownRemaining: 0 });
    }
  }

  canUse(type: SkillType): boolean {
    const s = this.skills.get(type);
    if (!s) return false;
    return s.remainingUses > 0 && s.cooldownRemaining <= 0;
  }

  use(type: SkillType, target?: Vec3): boolean {
    if (!this.canUse(type)) return false;
    const cfg = this.config.skills[type];
    if (type === 'meteor' && target) {
      for (const e of this.enemyManager.getEnemies()) {
        if (distanceSquared(e.position, target) <= (cfg.radius ?? 0) ** 2) {
          this.enemyManager.damageEnemy(e.id, cfg.damage ?? 0, false);
        }
      }
    } else if (type === 'frostNova') {
      this.enemyManager.applyBuffToAll({ type: 'slow', percent: cfg.slowPercent, duration: cfg.duration ?? 0 });
    } else if (type === 'goldRain') {
      this.economy.addGold(cfg.gold ?? 0);
    }
    const s = this.skills.get(type)!;
    s.remainingUses--;
    s.cooldownRemaining = cfg.cooldown;
    this.bus.emit('skillUsed', { type });
    return true;
  }

  update(dt: number): void {
    for (const s of this.skills.values()) {
      if (s.cooldownRemaining > 0) s.cooldownRemaining = Math.max(0, s.cooldownRemaining - dt);
    }
  }

  getRemainingUses(type: SkillType): number {
    return this.skills.get(type)?.remainingUses ?? 0;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/SkillManager.ts tests/managers/skillManager.test.ts
git commit -m "feat(managers): SkillManager 全局技能

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 10: BattleController 组装与胜负判定

**Files:**
- Create: `assets/scripts/managers/BattleController.ts`
- Test: `tests/managers/battleController.test.ts`

**Interfaces:**
- Consumes: 所有管理器、`LevelManager`、`EventBus`、`GameEvents`
- Produces（Plan 3 的 Cocos 绑定层依赖）：
  - `class BattleController`
  - `constructor(bus, config: ConfigSet, levelId: string)`
  - `start(): void`（setState 'playing'，startWave(0)）
  - `update(dt: number): void`（驱动每帧，接事件，判定胜负）

- [ ] **Step 1: 写失败测试**

```ts
// tests/managers/battleController.test.ts
import { describe, it, expect } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';
import type { GameEvents } from '../../assets/scripts/core/events';
import { BattleController } from '../../assets/scripts/managers/BattleController';
import type { ConfigSet } from '../../assets/scripts/data/types';

function makeConfig(): ConfigSet {
  return {
    towers: {
      arrow: { name: '箭塔', levels: [{ cost: 50, atk: 100, range: 10, attackInterval: 0.1 }] },
    } as any,
    enemies: { slime: { maxHp: 10, speed: 1, armor: 0, rewardGold: 5, damageToBase: 1 } },
    levels: {
      level1: {
        name: '初始之森', initialGold: 100, lives: 1,
        waypoints: [[0, 0, 0], [5, 0, 0]],
        buildSlots: [[0, 0, 0]],
        waves: ['w1'],
        skills: ['goldRain'],
      },
    },
    waves: { w1: { prepareTime: 0, rewardGold: 0, spawns: [{ type: 'slime', count: 1, interval: 0 }] } },
    skills: { goldRain: { name: '金币雨', gold: 10, cooldown: 1, maxUses: 1 } },
  };
}

describe('BattleController', () => {
  it('击杀所有敌人后胜利', () => {
    const bus = new EventBus<GameEvents>();
    const bc = new BattleController(bus, makeConfig(), 'level1');
    let state = '';
    bus.on('stateChanged', (p) => { state = p.state; });
    bc.start();
    expect(state).toBe('playing');
    bc.towers.buildTower(0, 'arrow'); // 塔在 buildSlots[0]=[0,0,0]，射程 10 覆盖路径
    bc.update(1.0); // 波次准备结束
    bc.update(0.1); // 刷怪 + 塔击杀（atk 100 对 hp 10 一击毙命）
    expect(state).toBe('won');
  });

  it('漏怪扣生命并失败', () => {
    const bus = new EventBus<GameEvents>();
    const bc = new BattleController(bus, makeConfig(), 'level1');
    let state = '';
    bus.on('stateChanged', (p) => { state = p.state; });
    bc.start();
    bc.update(0.1);  // 波次进入 spawning
    bc.update(10.0); // 刷怪 + 敌人走完 5 单位漏怪，lives 1->0
    expect(state).toBe('lost');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/managers/battleController.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/managers/BattleController.ts
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ConfigSet } from '../data/types';
import { LevelManager } from './LevelManager';
import { GameManager } from './GameManager';
import { EconomyManager } from './EconomyManager';
import { WaveManager } from './WaveManager';
import { EnemyManager } from './EnemyManager';
import { TowerManager } from './TowerManager';
import { SkillManager } from './SkillManager';

export class BattleController {
  readonly game: GameManager;
  readonly level: LevelManager;
  readonly economy: EconomyManager;
  readonly waves: WaveManager;
  readonly enemies: EnemyManager;
  readonly towers: TowerManager;
  readonly skills: SkillManager;

  constructor(private bus: EventBus<GameEvents>, config: ConfigSet, levelId: string) {
    const levelCfg = config.levels[levelId];
    this.game = new GameManager(bus);
    this.level = new LevelManager(config);
    this.economy = new EconomyManager(bus, levelCfg.initialGold, levelCfg.lives);
    this.waves = new WaveManager(bus, levelCfg.waves.map((w) => config.waves[w]));
    this.enemies = new EnemyManager(bus, config, levelCfg.waypoints);
    this.towers = new TowerManager(bus, config, this.enemies, this.economy, levelCfg.buildSlots);
    this.skills = new SkillManager(bus, config, this.enemies, this.economy, levelCfg.skills);

    // 接线：击杀加金币、漏怪扣生命
    bus.on('enemyKilled', (p) => this.economy.addGold(p.rewardGold));
    bus.on('enemyLeaked', (p) => {
      this.economy.addLives(-p.damageToBase);
      if (this.economy.isDefeated() && this.game.getState() === 'playing') {
        this.game.setState('lost');
      }
    });
    // 波次奖励
    bus.on('waveEnded', (p) => this.economy.addGold(p.rewardGold));
  }

  start(): void {
    this.game.setState('playing');
    this.waves.startWave(0);
  }

  update(dt: number): void {
    if (this.game.getState() !== 'playing') return;
    const due = this.waves.update(dt);
    for (const type of due) this.enemies.spawn(type);
    this.towers.update(dt);
    this.skills.update(dt);
    this.enemies.update(dt);
    if (this.game.getState() !== 'playing') return; // 已失败则不再判胜
    if (this.waves.allWavesDone && this.enemies.remainingCount() === 0) {
      this.game.setState('won');
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/managers/BattleController.ts tests/managers/battleController.test.ts
git commit -m "feat(managers): BattleController 组装与胜负判定

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 完成标准

- `npm test` 全绿，覆盖 8 个管理器 + BattleController + 事件类型的单测。
- `npm run typecheck` 无类型错误。
- 可 headless 通过 `BattleController` 跑通"刷怪 → 塔攻击 → 击杀 → 胜利"与"漏怪 → 失败"两条完整链路。
- 所有管理器不 `import 'cc'`，Plan 3 可直接绑定。
