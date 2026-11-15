# 塔防游戏核心规则层 实现计划（Plan 1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现塔防游戏的纯规则层与基础设施——类型定义、EventBus、配置加载、伤害/寻路/经济/波次/状态/存档等纯函数，全部用 vitest 单测，不依赖 Cocos。

**Architecture:** 纯 TypeScript 模块，按「数据层（types + ConfigLoader）/ 框架层（EventBus）/ 规则层（rules/*）分层」。所有规则函数无副作用、可独立单测。这些文件放在 `assets/scripts/` 下，后续 Plan 3 由 Cocos 直接编译使用。

**Tech Stack:** TypeScript 5.x、vitest 1.x（Node 环境运行，无需 Cocos 运行时）。

**Spec:** `docs/superpowers/specs/2026-11-15-tower-defense-design.md`

## Global Constraints

- 纯规则层文件**禁止** `import 'cc'` 或任何 Cocos 依赖，保证 vitest 可直接运行。
- 伤害公式（护甲减免）：`damage = atk × (1 − armor/(armor+K))`，`K = 20`，奥术塔以 `armor=0` 代入。
- 出售塔返还造价 **70%**。
- 敌人坐标/路点统一用 `Vec3 = [number, number, number]`。
- 减速为比例值 0~1（0.6 = 减速 60%），燃烧为持续伤害（dps）。
- 存档版本号 `SAVE_VERSION = 1`，默认解锁关卡为 1。
- 所有提交信息末尾附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

---

## 文件结构

```
assets/scripts/
├── data/
│   ├── types.ts            # 所有领域类型定义
│   └── ConfigLoader.ts     # 配置加载+校验
├── core/
│   └── EventBus.ts         # 泛型类型安全事件总线
└── rules/
    ├── damage.ts           # 伤害公式
    ├── waypoint.ts         # 路点推进
    ├── economy.ts          # 金币/生命/出售
    ├── wave.ts             # 波次解析
    ├── buff.ts             # 减速/燃烧状态
    └── save.ts             # 存档归一化
tests/
├── smoke.test.ts
├── data/
│   ├── types.test.ts
│   └── configLoader.test.ts
├── core/
│   └── eventBus.test.ts
└── rules/
    ├── damage.test.ts
    ├── waypoint.test.ts
    ├── economy.test.ts
    ├── wave.test.ts
    ├── buff.test.ts
    └── save.test.ts
```

> 注：spec 的分层图里"规则层"未指定目录名，此处新增 `assets/scripts/rules/` 存放纯规则函数，与 `core/`（框架）区分开。

---

## Task 1: 项目脚手架（vitest + TypeScript）

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `npm test`（即 `vitest run`）命令可运行；目录骨架 `assets/scripts/{data,core,rules}`、`tests/{data,core,rules}` 存在

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "tafang",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["assets/scripts/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: 写 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: 写 .gitignore**

```
node_modules/
dist/
temp/
library/
local/
build/
profiles/
```

- [ ] **Step 5: 写冒烟测试**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('测试框架可运行', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: 建目录并安装依赖**

Run:
```bash
mkdir -p assets/scripts/data assets/scripts/core assets/scripts/rules tests/data tests/core tests/rules
npm install
```

- [ ] **Step 7: 运行测试验证通过**

Run: `npm test`
Expected: 1 个测试通过（smoke）

- [ ] **Step 8: 提交**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore tests/smoke.test.ts
git commit -m "chore: 初始化 vitest + TypeScript 项目骨架

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: 领域类型定义

**Files:**
- Create: `assets/scripts/data/types.ts`
- Test: `tests/data/types.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（后续所有任务依赖）：
  - `type TowerType = 'arrow' | 'ice' | 'fire' | 'arcane'`
  - `interface TowerConfig { name; armorIgnore?; aoe?; slow?; levels: TowerLevelConfig[] }`
  - `interface TowerLevelConfig { cost; atk; range; attackInterval; upgradeCost? }`
  - `type EnemyType = 'slime' | 'wolf' | 'golem' | 'bat' | 'elite' | 'boss'`
  - `interface EnemyConfig { maxHp; speed; armor; rewardGold; damageToBase }`
  - `interface WaveSpawn { type; count; interval }`
  - `interface WaveConfig { prepareTime; rewardGold; spawns; isElite?; isBoss? }`
  - `type Vec3 = [number, number, number]`
  - `interface LevelConfig { name; initialGold; lives; waypoints; buildSlots; waves; skills }`
  - `type SkillType = 'meteor' | 'frostNova' | 'goldRain'`
  - `interface SkillConfig { name; cooldown; maxUses; damage?; radius?; slowPercent?; duration?; gold? }`
  - `type BuffType = 'slow' | 'burn'`
  - `interface Buff { type; percent?; dps?; duration }`
  - `interface SaveData { version; unlockedLevel; levelStars; totalGold }`
  - `interface ConfigSet { towers; enemies; levels; waves; skills }`

- [ ] **Step 1: 写失败测试**

```ts
// tests/data/types.test.ts
import { describe, it, expect } from 'vitest';
import type { TowerConfig, LevelConfig, SkillConfig } from '../../assets/scripts/data/types';

const arrowTower: TowerConfig = {
  name: '箭塔',
  levels: [
    { cost: 50, atk: 12, range: 6, attackInterval: 0.6, upgradeCost: 60 },
    { cost: 60, atk: 24, range: 6.5, attackInterval: 0.5, upgradeCost: 100 },
    { cost: 100, atk: 45, range: 7, attackInterval: 0.4 },
  ],
};

const level1: LevelConfig = {
  name: '初始之森',
  initialGold: 200,
  lives: 20,
  waypoints: [[0, 0, 0], [10, 0, 0], [10, 0, 5]],
  buildSlots: [[2, 0, 1], [4, 0, 2]],
  waves: ['w1', 'w2'],
  skills: ['meteor', 'frostNova', 'goldRain'],
};

const meteor: SkillConfig = { name: '陨石术', damage: 100, radius: 3, cooldown: 30, maxUses: 2 };

describe('types', () => {
  it('TowerConfig 结构可构造', () => {
    expect(arrowTower.name).toBe('箭塔');
    expect(arrowTower.levels).toHaveLength(3);
    expect(arrowTower.levels[2].upgradeCost).toBeUndefined();
  });

  it('LevelConfig 含路点/建造格子/技能', () => {
    expect(level1.waypoints).toHaveLength(3);
    expect(level1.skills).toContain('meteor');
  });

  it('SkillConfig 可选字段不强制', () => {
    expect(meteor.damage).toBe(100);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/data/types.test.ts`
Expected: FAIL，报 `Cannot find module '../../assets/scripts/data/types'`（types.ts 尚未创建）

- [ ] **Step 3: 实现类型定义**

```ts
// assets/scripts/data/types.ts
export type TowerType = 'arrow' | 'ice' | 'fire' | 'arcane';

export interface TowerLevelConfig {
  cost: number;          // 升到该级的费用（第 1 级即建造费）
  atk: number;
  range: number;
  attackInterval: number; // 秒/次
  upgradeCost?: number;   // 升到下一级的费用，最后一级无
}

export interface TowerConfig {
  name: string;
  armorIgnore?: boolean;                                   // 奥术塔：无视护甲
  aoe?: { radius: number; burnDps: number; burnDuration: number }; // 烈焰塔：范围溅射+燃烧
  slow?: { percent: number; duration: number };             // 冰霜塔：减速
  levels: TowerLevelConfig[];
}

export type EnemyType = 'slime' | 'wolf' | 'golem' | 'bat' | 'elite' | 'boss';

export interface EnemyConfig {
  maxHp: number;
  speed: number;
  armor: number;
  rewardGold: number;
  damageToBase: number;
}

export interface WaveSpawn {
  type: EnemyType;
  count: number;
  interval: number; // 相邻生成间隔（秒）
}

export interface WaveConfig {
  prepareTime: number; // 波次准备倒计时（秒）
  rewardGold: number;
  spawns: WaveSpawn[];
  isElite?: boolean;
  isBoss?: boolean;
}

export type Vec3 = [number, number, number];

export interface LevelConfig {
  name: string;
  initialGold: number;
  lives: number;
  waypoints: Vec3[];
  buildSlots: Vec3[];
  waves: string[];
  skills: SkillType[];
}

export type SkillType = 'meteor' | 'frostNova' | 'goldRain';

export interface SkillConfig {
  name: string;
  cooldown: number; // 冷却（秒）
  maxUses: number;  // 每关可用次数
  damage?: number;      // meteor
  radius?: number;      // meteor 半径
  slowPercent?: number; // frostNova 减速比例 0~1
  duration?: number;    // frostNova 持续秒数
  gold?: number;        // goldRain 金币
}

export type BuffType = 'slow' | 'burn';

export interface Buff {
  type: BuffType;
  percent?: number; // slow: 减速比例 0~1
  dps?: number;     // burn: 每秒伤害
  duration: number; // 剩余持续时间（秒）
}

export interface SaveData {
  version: number;
  unlockedLevel: number;
  levelStars: Record<string, number>;
  totalGold: number;
}

export interface ConfigSet {
  towers: Record<TowerType, TowerConfig>;
  enemies: Record<EnemyType, EnemyConfig>;
  levels: Record<string, LevelConfig>;
  waves: Record<string, WaveConfig>;
  skills: Record<SkillType, SkillConfig>;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过（smoke + types 共 4 个断言组）

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/data/types.ts tests/data/types.test.ts
git commit -m "feat(data): 领域类型定义

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: 泛型事件总线 EventBus

**Files:**
- Create: `assets/scripts/core/EventBus.ts`
- Test: `tests/core/eventBus.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（后续管理器依赖）：
  - `class EventBus<T extends Record<string, unknown>>`
  - `on<K>(event: K, handler: (payload: T[K]) => void): () => void`
  - `off<K>(event: K, handler: (payload: T[K]) => void): void`
  - `emit<K>(event: K, payload: T[K]): void`
  - `clear(): void`

- [ ] **Step 1: 写失败测试**

```ts
// tests/core/eventBus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../assets/scripts/core/EventBus';

interface TestEvents {
  value: { n: number };
  tick: { t: number };
}

describe('EventBus', () => {
  it('on 后 emit 会调用处理器', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('value', fn);
    bus.emit('value', { n: 42 });
    expect(fn).toHaveBeenCalledWith({ n: 42 });
  });

  it('off 后不再调用', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('value', fn);
    bus.off('value', fn);
    bus.emit('value', { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('on 返回的取消订阅函数可用', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    const unsub = bus.on('tick', fn);
    unsub();
    bus.emit('tick', { t: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('clear 清空所有处理器', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('tick', fn);
    bus.clear();
    bus.emit('tick', { t: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/core/eventBus.test.ts`
Expected: FAIL（找不到模块 EventBus）

- [ ] **Step 3: 实现 EventBus**

```ts
// assets/scripts/core/EventBus.ts
export class EventBus<T extends Record<string, unknown>> {
  private handlers = new Map<keyof T, Set<(payload: any) => void>>();

  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) h(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/core/EventBus.ts tests/core/eventBus.test.ts
git commit -m "feat(core): 泛型事件总线 EventBus

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: 伤害公式

**Files:**
- Create: `assets/scripts/rules/damage.ts`
- Test: `tests/rules/damage.test.ts`

**Interfaces:**
- Consumes: `types.ts` 无（纯数值函数，不需要类型导入）
- Produces：
  - `const ARMOR_COEFFICIENT = 20`
  - `calculateDamage(atk: number, armor: number, armorIgnore?: boolean): number`

- [ ] **Step 1: 写失败测试**

```ts
// tests/rules/damage.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDamage, ARMOR_COEFFICIENT } from '../../assets/scripts/rules/damage';

describe('calculateDamage', () => {
  it('无护甲时全额伤害', () => {
    expect(calculateDamage(10, 0)).toBe(10);
  });

  it('护甲等于 K 时伤害减半', () => {
    expect(calculateDamage(10, ARMOR_COEFFICIENT)).toBe(5);
  });

  it('伤害至少为 1', () => {
    expect(calculateDamage(1, 9999)).toBe(1);
  });

  it('armorIgnore 无视护甲', () => {
    expect(calculateDamage(10, 9999, true)).toBe(10);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/rules/damage.test.ts`
Expected: FAIL（找不到模块）

- [ ] **Step 3: 实现**

```ts
// assets/scripts/rules/damage.ts
export const ARMOR_COEFFICIENT = 20;

export function calculateDamage(atk: number, armor: number, armorIgnore = false): number {
  const effectiveArmor = armorIgnore ? 0 : armor;
  const raw = atk * (1 - effectiveArmor / (effectiveArmor + ARMOR_COEFFICIENT));
  return Math.max(1, Math.round(raw));
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/rules/damage.ts tests/rules/damage.test.ts
git commit -m "feat(rules): 伤害公式（护甲减免）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: 路点推进

**Files:**
- Create: `assets/scripts/rules/waypoint.ts`
- Test: `tests/rules/waypoint.test.ts`

**Interfaces:**
- Consumes: `types.ts` 的 `Vec3`
- Produces：
  - `distanceSquared(a: Vec3, b: Vec3): number`
  - `reachedWaypoint(pos: Vec3, target: Vec3, tolerance: number): boolean`
  - `advanceWaypoint(pos: Vec3, waypoints: Vec3[], currentIndex: number, tolerance: number): number`

- [ ] **Step 1: 写失败测试**

```ts
// tests/rules/waypoint.test.ts
import { describe, it, expect } from 'vitest';
import { distanceSquared, reachedWaypoint, advanceWaypoint } from '../../assets/scripts/rules/waypoint';
import type { Vec3 } from '../../assets/scripts/data/types';

const path: Vec3[] = [[0, 0, 0], [10, 0, 0], [10, 0, 5]];

describe('waypoint', () => {
  it('distanceSquared 计算距离平方', () => {
    expect(distanceSquared([0, 0, 0], [3, 4, 0])).toBe(25);
  });

  it('reachedWaypoint 在容差内判定到达', () => {
    expect(reachedWaypoint([0.5, 0, 0], [0, 0, 0], 1)).toBe(true);
    expect(reachedWaypoint([2, 0, 0], [0, 0, 0], 1)).toBe(false);
  });

  it('到达当前路点则推进下标', () => {
    expect(advanceWaypoint([0, 0, 0], path, 0, 0.1)).toBe(1);
  });

  it('未到达则保持当前下标', () => {
    expect(advanceWaypoint([1, 0, 0], path, 1, 0.1)).toBe(1);
  });

  it('走完全程返回 waypoints.length', () => {
    expect(advanceWaypoint([10, 0, 5], path, 2, 0.1)).toBe(3);
    expect(advanceWaypoint([0, 0, 0], path, 3, 0.1)).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/rules/waypoint.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/rules/waypoint.ts
import type { Vec3 } from '../data/types';

export function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function reachedWaypoint(pos: Vec3, target: Vec3, tolerance: number): boolean {
  return distanceSquared(pos, target) <= tolerance * tolerance;
}

export function advanceWaypoint(pos: Vec3, waypoints: Vec3[], currentIndex: number, tolerance: number): number {
  if (currentIndex >= waypoints.length) return currentIndex;
  if (reachedWaypoint(pos, waypoints[currentIndex], tolerance)) return currentIndex + 1;
  return currentIndex;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/rules/waypoint.ts tests/rules/waypoint.test.ts
git commit -m "feat(rules): 路点推进

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: 经济结算

**Files:**
- Create: `assets/scripts/rules/economy.ts`
- Test: `tests/rules/economy.test.ts`

**Interfaces:**
- Consumes: 无
- Produces：
  - `const TOWER_SELL_RATIO = 0.7`
  - `addGold(gold: number, delta: number): number`（下限 0）
  - `addLives(lives: number, delta: number): number`（下限 0）
  - `sellRefund(spent: number): number`

- [ ] **Step 1: 写失败测试**

```ts
// tests/rules/economy.test.ts
import { describe, it, expect } from 'vitest';
import { addGold, addLives, sellRefund, TOWER_SELL_RATIO } from '../../assets/scripts/rules/economy';

describe('economy', () => {
  it('addGold 累加且不为负', () => {
    expect(addGold(100, 50)).toBe(150);
    expect(addGold(10, -999)).toBe(0);
  });

  it('addLives 累加且不为负', () => {
    expect(addLives(20, -3)).toBe(17);
    expect(addLives(1, -5)).toBe(0);
  });

  it('sellRefund 按 70% 四舍五入', () => {
    expect(TOWER_SELL_RATIO).toBe(0.7);
    expect(sellRefund(100)).toBe(70);
    expect(sellRefund(55)).toBe(39);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/rules/economy.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/rules/economy.ts
export const TOWER_SELL_RATIO = 0.7;

export function addGold(gold: number, delta: number): number {
  return Math.max(0, gold + delta);
}

export function addLives(lives: number, delta: number): number {
  return Math.max(0, lives + delta);
}

export function sellRefund(spent: number): number {
  return Math.round(spent * TOWER_SELL_RATIO);
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/rules/economy.ts tests/rules/economy.test.ts
git commit -m "feat(rules): 经济结算（金币/生命/出售）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: 波次解析

**Files:**
- Create: `assets/scripts/rules/wave.ts`
- Test: `tests/rules/wave.test.ts`

**Interfaces:**
- Consumes: `types.ts` 的 `WaveConfig`、`EnemyType`
- Produces：
  - `interface SpawnEvent { type: EnemyType; atTime: number }`
  - `buildSpawnSchedule(wave: WaveConfig): SpawnEvent[]`
  - `totalEnemies(wave: WaveConfig): number`

- [ ] **Step 1: 写失败测试**

```ts
// tests/rules/wave.test.ts
import { describe, it, expect } from 'vitest';
import { buildSpawnSchedule, totalEnemies } from '../../assets/scripts/rules/wave';
import type { WaveConfig } from '../../assets/scripts/data/types';

const wave: WaveConfig = {
  prepareTime: 5,
  rewardGold: 50,
  spawns: [
    { type: 'slime', count: 2, interval: 1.0 },
    { type: 'wolf', count: 2, interval: 0.5 },
  ],
};

describe('wave', () => {
  it('totalEnemies 统计总数', () => {
    expect(totalEnemies(wave)).toBe(4);
  });

  it('buildSpawnSchedule 按间隔展开时间线', () => {
    const schedule = buildSpawnSchedule(wave);
    expect(schedule).toEqual([
      { type: 'slime', atTime: 0 },
      { type: 'slime', atTime: 1.0 },
      { type: 'wolf', atTime: 2.0 },
      { type: 'wolf', atTime: 2.5 },
    ]);
  });

  it('空波次返回空数组', () => {
    expect(buildSpawnSchedule({ prepareTime: 0, rewardGold: 0, spawns: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/rules/wave.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/rules/wave.ts
import type { WaveConfig, EnemyType } from '../data/types';

export interface SpawnEvent {
  type: EnemyType;
  atTime: number;
}

export function buildSpawnSchedule(wave: WaveConfig): SpawnEvent[] {
  const events: SpawnEvent[] = [];
  let t = 0;
  for (const s of wave.spawns) {
    for (let i = 0; i < s.count; i++) {
      events.push({ type: s.type, atTime: t });
      t += s.interval;
    }
  }
  return events;
}

export function totalEnemies(wave: WaveConfig): number {
  return wave.spawns.reduce((sum, s) => sum + s.count, 0);
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/rules/wave.ts tests/rules/wave.test.ts
git commit -m "feat(rules): 波次解析（生成时间线）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: 状态效果（减速/燃烧）

**Files:**
- Create: `assets/scripts/rules/buff.ts`
- Test: `tests/rules/buff.test.ts`

**Interfaces:**
- Consumes: `types.ts` 的 `Buff`
- Produces：
  - `slowMultiplier(buffs: Buff[]): number`（返回 1 − 最大减速比例，范围 0~1）
  - `tickBuffs(buffs: Buff[], dt: number): number`（推进时间并移除到期，返回本帧燃烧伤害；**原地修改** buffs 数组）

- [ ] **Step 1: 写失败测试**

```ts
// tests/rules/buff.test.ts
import { describe, it, expect } from 'vitest';
import { slowMultiplier, tickBuffs } from '../../assets/scripts/rules/buff';
import type { Buff } from '../../assets/scripts/data/types';

describe('buff', () => {
  it('slowMultiplier 无减速为 1', () => {
    expect(slowMultiplier([])).toBe(1);
  });

  it('slowMultiplier 取最大减速比例', () => {
    const buffs: Buff[] = [
      { type: 'slow', percent: 0.3, duration: 2 },
      { type: 'slow', percent: 0.6, duration: 3 },
    ];
    expect(slowMultiplier(buffs)).toBeCloseTo(0.4);
  });

  it('tickBuffs 返回燃烧伤害并推进时间', () => {
    const buffs: Buff[] = [{ type: 'burn', dps: 10, duration: 2 }];
    const dmg = tickBuffs(buffs, 0.5);
    expect(dmg).toBeCloseTo(5);
    expect(buffs[0].duration).toBeCloseTo(1.5);
  });

  it('tickBuffs 移除到期 buff', () => {
    const buffs: Buff[] = [{ type: 'burn', dps: 10, duration: 0.1 }];
    tickBuffs(buffs, 0.2);
    expect(buffs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/rules/buff.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/rules/buff.ts
import type { Buff } from '../data/types';

export function slowMultiplier(buffs: Buff[]): number {
  let maxPercent = 0;
  for (const b of buffs) {
    if (b.type === 'slow' && b.percent !== undefined) {
      maxPercent = Math.max(maxPercent, b.percent);
    }
  }
  return 1 - maxPercent;
}

export function tickBuffs(buffs: Buff[], dt: number): number {
  let burnDamage = 0;
  for (const b of buffs) {
    if (b.type === 'burn' && b.dps !== undefined) {
      burnDamage += b.dps * dt;
    }
    b.duration -= dt;
  }
  for (let i = buffs.length - 1; i >= 0; i--) {
    if (buffs[i].duration <= 0) buffs.splice(i, 1);
  }
  return burnDamage;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/rules/buff.ts tests/rules/buff.test.ts
git commit -m "feat(rules): 状态效果（减速/燃烧）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 9: 存档归一化

**Files:**
- Create: `assets/scripts/rules/save.ts`
- Test: `tests/rules/save.test.ts`

**Interfaces:**
- Consumes: `types.ts` 的 `SaveData`
- Produces：
  - `const SAVE_VERSION = 1`
  - `const DEFAULT_SAVE: SaveData`
  - `normalizeSaveData(raw: unknown): SaveData`

- [ ] **Step 1: 写失败测试**

```ts
// tests/rules/save.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeSaveData, DEFAULT_SAVE, SAVE_VERSION } from '../../assets/scripts/rules/save';

describe('save', () => {
  it('非法输入回退默认存档', () => {
    expect(normalizeSaveData(null)).toEqual(DEFAULT_SAVE);
    expect(normalizeSaveData('bad')).toEqual(DEFAULT_SAVE);
    expect(normalizeSaveData(undefined)).toEqual(DEFAULT_SAVE);
  });

  it('合法存档保留字段并修正版本', () => {
    const out = normalizeSaveData({ unlockedLevel: 3, totalGold: 100, levelStars: { level1: 3 } });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.unlockedLevel).toBe(3);
    expect(out.totalGold).toBe(100);
    expect(out.levelStars).toEqual({ level1: 3 });
  });

  it('负值被钳制', () => {
    const out = normalizeSaveData({ unlockedLevel: -1, totalGold: -5 });
    expect(out.unlockedLevel).toBe(1);
    expect(out.totalGold).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/rules/save.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/rules/save.ts
import type { SaveData } from '../data/types';

export const SAVE_VERSION = 1;

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  unlockedLevel: 1,
  levelStars: {},
  totalGold: 0,
};

export function normalizeSaveData(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SAVE };
  const r = raw as Record<string, unknown>;
  const unlockedLevel =
    typeof r.unlockedLevel === 'number' && r.unlockedLevel >= 1
      ? Math.floor(r.unlockedLevel)
      : DEFAULT_SAVE.unlockedLevel;
  const totalGold =
    typeof r.totalGold === 'number' && r.totalGold >= 0
      ? Math.floor(r.totalGold)
      : DEFAULT_SAVE.totalGold;
  const levelStars =
    typeof r.levelStars === 'object' && r.levelStars !== null
      ? { ...(r.levelStars as Record<string, number>) }
      : {};
  return { version: SAVE_VERSION, unlockedLevel, totalGold, levelStars };
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/rules/save.ts tests/rules/save.test.ts
git commit -m "feat(rules): 存档归一化

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 10: 配置加载与校验 ConfigLoader

**Files:**
- Create: `assets/scripts/data/ConfigLoader.ts`
- Test: `tests/data/configLoader.test.ts`

**Interfaces:**
- Consumes: `types.ts` 的 `ConfigSet`
- Produces（Plan 2 依赖）：
  - `class ConfigLoader`
  - `constructor(load: (path: string) => unknown)`
  - `loadAll(): ConfigSet`
  - 加载校验：任何一份配置缺失或非对象时 `throw new Error(...)`

- [ ] **Step 1: 写失败测试**

```ts
// tests/data/configLoader.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../../assets/scripts/data/ConfigLoader';

function makeLoader() {
  const store: Record<string, unknown> = {
    'towers.json': { arrow: { name: '箭塔', levels: [] } },
    'enemies.json': { slime: { maxHp: 40, speed: 2, armor: 0, rewardGold: 5, damageToBase: 1 } },
    'levels.json': { level1: { name: '初始之森', initialGold: 200, lives: 20, waypoints: [], buildSlots: [], waves: [], skills: [] } },
    'waves.json': { w1: { prepareTime: 5, rewardGold: 50, spawns: [] } },
    'skills.json': { meteor: { name: '陨石术', cooldown: 30, maxUses: 2 } },
  };
  return new ConfigLoader((path) => store[path]);
}

describe('ConfigLoader', () => {
  it('加载全部配置', () => {
    const config = makeLoader().loadAll();
    expect(config.towers.arrow.name).toBe('箭塔');
    expect(config.enemies.slime.maxHp).toBe(40);
    expect(config.skills.meteor.cooldown).toBe(30);
  });

  it('配置缺失时抛错', () => {
    const loader = new ConfigLoader(() => undefined);
    expect(() => loader.loadAll()).toThrow();
  });

  it('配置为 null 时抛错', () => {
    const loader = new ConfigLoader((path) => (path === 'towers.json' ? null : {}));
    expect(() => loader.loadAll()).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/data/configLoader.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/data/ConfigLoader.ts
import type { ConfigSet } from './types';

export class ConfigLoader {
  constructor(private load: (path: string) => unknown) {}

  loadAll(): ConfigSet {
    return {
      towers: this.requireRecord('towers.json'),
      enemies: this.requireRecord('enemies.json'),
      levels: this.requireRecord('levels.json'),
      waves: this.requireRecord('waves.json'),
      skills: this.requireRecord('skills.json'),
    } as ConfigSet;
  }

  private requireRecord(path: string): Record<string, unknown> {
    const value = this.load(path);
    if (typeof value !== 'object' || value === null) {
      throw new Error(`配置 ${path} 缺失或格式错误`);
    }
    return value as Record<string, unknown>;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/data/ConfigLoader.ts tests/data/configLoader.test.ts
git commit -m "feat(data): 配置加载与校验 ConfigLoader

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 完成标准

- `npm test` 全绿（smoke + types + eventBus + damage + waypoint + economy + wave + buff + save + configLoader）。
- `npm run typecheck` 无类型错误。
- 纯规则层不 `import 'cc'`，Plan 2/3 可复用。
