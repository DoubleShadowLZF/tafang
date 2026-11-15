# 塔防游戏 Cocos 表现层与微信适配 实现计划（Plan 3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Plan 1/2 的纯 TS 逻辑层绑定到 Cocos Creator 3.x 运行时，补齐微信适配层、音频、战斗表现（敌人/塔/建造格子的 3D 视图）、UI（HUD/塔面板/技能栏/结算）、场景导航与微信小游戏构建配置，产出可发布到微信小游戏的完整可玩原型（占位美术）。

**Architecture:** 继续沿用分层。逻辑层（Plan 2 的管理器）保持无 `cc` 依赖，由本计划的 `Bootstrap` 在运行时实例化并放进全局 `App` 单例；Cocos 组件只做「读状态 + 渲染 + 收集输入」，通过 EventBus 订阅与窄接口调用驱动管理器。所有 3D 场景节点按关卡配置**程序化构建**（数据驱动），`.scene` 文件只保留相机 + Canvas + 挂载脚本的空节点，避免手写场景文件。

**Tech Stack:** Cocos Creator 3.x (TypeScript)、复用 Plan 1 的 vitest/TypeScript 工程与 Plan 2 的管理器。占位美术用 `primitives` 原生图元 + 纯色材质；UI 用 `Label`/`Graphics` 程序化构建。

**Spec:** `docs/superpowers/specs/2026-11-15-tower-defense-design.md`
**前序计划:** `docs/superpowers/plans/2026-11-15-tower-defense-core-rules.md`、`docs/superpowers/plans/2026-11-15-tower-defense-managers.md`

## Global Constraints

- 逻辑/规则层**不修改**；本计划只做绑定与表现，不改数值、不改管理器接口。
- Cocos 组件通过 `assets/scripts/core/cc.d.ts` 声明 `cc` 模块（`export const X: any`），供 `tsc --noEmit` 通过；真实类型由 Cocos Creator 编辑器在打开项目时提供（`temp/declarations/cc.d.ts`）。
- Cocos 组件**无法用 vitest 单测**（依赖 `cc` 运行时），验证方式为「编辑器打开 → 构建 → 运行冒烟」；纯 TS 部分（WeChatAdapter/AudioManager/App）走 vitest。
- 微信环境降级：`WeChatAdapter` 在非微信环境回退 `localStorage` / no-op，保证编辑器与浏览器可跑。
- 配置 JSON 放在 `assets/resources/config/`（而非 spec 示意图中的 `assets/config/`），以支持 `resources.load` 运行时加载。
- 占位 3D 用原生图元 + 纯色；若材质 effect 名在不同 Cocos 版本有差异，逻辑仍可用（节点位置/输入不受影响）。
- 所有提交信息末尾附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

---

## 文件结构

```
assets/
├── scripts/
│   ├── core/
│   │   ├── cc.d.ts             # cc 模块类型 shim（本计划新增）
│   │   ├── WeChatAdapter.ts    # 微信适配层（纯 TS，可测）
│   │   ├── AudioManager.ts     # 音效/音乐（纯 TS，可测）
│   │   ├── App.ts              # 全局单例容器（纯 TS，可测）
│   │   └── Bootstrap.ts        # cc Component：初始化 + 进主菜单
│   ├── gameplay/
│   │   ├── worldKit.ts         # 占位 3D 图元 + 地面/路线构建
│   │   ├── EnemyView.ts        # 敌人 3D 视图
│   │   ├── TowerView.ts        # 塔 3D 视图
│   │   └── BuildSlotView.ts    # 建造格子 3D 视图
│   ├── ui/
│   │   ├── uiKit.ts            # Label/面板/按钮 程序化构建
│   │   ├── HUD.ts              # 金币/生命/波次
│   │   ├── TowerPanel.ts       # 塔面板（建造/升级/出售）
│   │   ├── SkillBar.ts         # 技能栏
│   │   └── ResultPanel.ts      # 结算面板
│   └── scenes/
│       ├── MainMenuScene.ts    # 主菜单
│       ├── LevelSelectScene.ts # 选关
│       └── BattleScene.ts      # 战斗组装 + 驱动 + 输入
├── resources/
│   └── config/
│       ├── towers.json
│       ├── enemies.json
│       ├── levels.json
│       ├── waves.json
│       └── skills.json
tests/
├── wechatAdapter.test.ts
├── audioManager.test.ts
└── app.test.ts
```

> 说明：Startup 场景只挂 `Bootstrap` 组件，无需独立脚本；`director.loadScene` 负责场景跳转。

---

## Task 1: WeChatAdapter 微信适配层

**Files:**
- Create: `assets/scripts/core/WeChatAdapter.ts`
- Test: `tests/wechatAdapter.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（Bootstrap/ResultPanel 依赖）：
  - `interface WeChatEnv`（可选注入的 wx 形状）
  - `class WeChatAdapter`
  - `constructor(env?: WeChatEnv)`
  - `login(cb?: (code: string) => void): void`
  - `share(title: string): void`
  - `onShow(cb: () => void): void`、`onHide(cb: () => void): void`
  - `getStorage(key: string): unknown`、`setStorage(key: string, data: unknown): void`
  - `isWeChat(): boolean`

- [ ] **Step 1: 写失败测试**

```ts
// tests/wechatAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { WeChatAdapter, WeChatEnv } from '../../assets/scripts/core/WeChatAdapter';

describe('WeChatAdapter', () => {
  it('login 调用 wx.login 并回传 code', () => {
    const wx: WeChatEnv = {
      login: (opts) => { opts.success?.({ code: 'abc123' }); },
    };
    const adapter = new WeChatAdapter(wx);
    let code = '';
    adapter.login((c) => { code = c; });
    expect(code).toBe('abc123');
  });

  it('无 wx 时 login 回传空串（降级）', () => {
    const adapter = new WeChatAdapter({});
    let code = 'unset';
    adapter.login((c) => { code = c; });
    expect(code).toBe('');
  });

  it('share 调用 shareAppMessage', () => {
    const calls: unknown[] = [];
    const wx: WeChatEnv = { shareAppMessage: (opts) => { calls.push(opts); } };
    new WeChatAdapter(wx).share('帮我闯关');
    expect(calls).toEqual([{ title: '帮我闯关' }]);
  });

  it('onShow/onHide 注册回调', () => {
    let show = 0; let hide = 0;
    const wx: WeChatEnv = {
      onShow: (cb) => { show++; cb(); },
      onHide: (cb) => { hide++; cb(); },
    };
    const adapter = new WeChatAdapter(wx);
    adapter.onShow(() => {});
    adapter.onHide(() => {});
    expect(show).toBe(1);
    expect(hide).toBe(1);
  });

  it('setStorage/getStorage 委托 wx.setStorageSync/getStorageSync', () => {
    const store = new Map<string, unknown>();
    const wx: WeChatEnv = {
      setStorageSync: (k, v) => { store.set(k, v); },
      getStorageSync: (k) => store.get(k),
    };
    const adapter = new WeChatAdapter(wx);
    adapter.setStorage('k', 'v');
    expect(adapter.getStorage('k')).toBe('v');
  });

  it('isWeChat 反映 wx 是否存在', () => {
    expect(new WeChatAdapter({ login: () => {} }).isWeChat()).toBe(true);
    expect(new WeChatAdapter({}).isWeChat()).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/wechatAdapter.test.ts`
Expected: FAIL（找不到 `WeChatAdapter`）

- [ ] **Step 3: 实现**

```ts
// assets/scripts/core/WeChatAdapter.ts
export interface WeChatEnv {
  login?: (opts: { success?: (res: { code: string }) => void; fail?: (err: unknown) => void }) => void;
  shareAppMessage?: (opts: { title?: string; imageUrl?: string }) => void;
  onShow?: (cb: () => void) => void;
  onHide?: (cb: () => void) => void;
  setStorageSync?: (key: string, data: unknown) => void;
  getStorageSync?: (key: string) => unknown;
}

export class WeChatAdapter {
  private wx: WeChatEnv;

  constructor(env?: WeChatEnv) {
    const globalWx = (globalThis as { wx?: WeChatEnv }).wx;
    this.wx = env ?? (globalWx ?? {});
  }

  isWeChat(): boolean {
    return typeof this.wx.login === 'function';
  }

  login(cb?: (code: string) => void): void {
    if (this.wx.login) {
      this.wx.login({ success: (res) => cb?.(res.code), fail: () => cb?.('') });
    } else {
      cb?.('');
    }
  }

  share(title: string): void {
    this.wx.shareAppMessage?.({ title });
  }

  onShow(cb: () => void): void {
    this.wx.onShow?.(cb);
  }

  onHide(cb: () => void): void {
    this.wx.onHide?.(cb);
  }

  setStorage(key: string, data: unknown): void {
    if (this.wx.setStorageSync) {
      this.wx.setStorageSync(key, data);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  getStorage(key: string): unknown {
    if (this.wx.getStorageSync) return this.wx.getStorageSync(key);
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/core/WeChatAdapter.ts tests/wechatAdapter.test.ts
git commit -m "feat(core): WeChatAdapter 微信适配层（登录/分享/生命周期/存储）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: AudioManager 音效/音乐

**Files:**
- Create: `assets/scripts/core/AudioManager.ts`
- Test: `tests/audioManager.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（Bootstrap 依赖）：
  - `interface AudioSink { playSfx(name: string): void; playBgm(name: string): void; stopBgm(): void }`
  - `class AudioManager`
  - `constructor(sink?: AudioSink)`（缺省为 no-op sink）
  - `playSfx(name: string): void`、`playBgm(name: string): void`、`stopBgm(): void`

- [ ] **Step 1: 写失败测试**

```ts
// tests/audioManager.test.ts
import { describe, it, expect } from 'vitest';
import { AudioManager, AudioSink } from '../../assets/scripts/core/AudioManager';

describe('AudioManager', () => {
  it('委托 sink 播放', () => {
    const calls: string[] = [];
    const sink: AudioSink = {
      playSfx: (n) => calls.push('sfx:' + n),
      playBgm: (n) => calls.push('bgm:' + n),
      stopBgm: () => calls.push('stop'),
    };
    const audio = new AudioManager(sink);
    audio.playSfx('hit');
    audio.playBgm('main');
    audio.stopBgm();
    expect(calls).toEqual(['sfx:hit', 'bgm:main', 'stop']);
  });

  it('无 sink 时为 no-op 不抛错', () => {
    const audio = new AudioManager();
    expect(() => { audio.playSfx('x'); audio.playBgm('y'); audio.stopBgm(); }).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/audioManager.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/core/AudioManager.ts
export interface AudioSink {
  playSfx(name: string): void;
  playBgm(name: string): void;
  stopBgm(): void;
}

const noopSink: AudioSink = { playSfx() {}, playBgm() {}, stopBgm() {} };

export class AudioManager {
  constructor(private sink: AudioSink = noopSink) {}

  playSfx(name: string): void { this.sink.playSfx(name); }
  playBgm(name: string): void { this.sink.playBgm(name); }
  stopBgm(): void { this.sink.stopBgm(); }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/core/AudioManager.ts tests/audioManager.test.ts
git commit -m "feat(core): AudioManager 音效/音乐（占位 no-op sink）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: App 全局单例容器

**Files:**
- Create: `assets/scripts/core/App.ts`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `ConfigSet`、`SkillType`、`BattleController`、`SaveManager`、`WeChatAdapter`、`AudioManager`
- Produces（所有 Cocos 组件依赖）：`export const App`（可变单例对象，字段见下）

- [ ] **Step 1: 写失败测试**

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import { App } from '../../assets/scripts/core/App';

describe('App', () => {
  it('字段可赋值并读取', () => {
    App.pendingLevel = 'level2';
    expect(App.pendingLevel).toBe('level2');
  });

  it('battle/pendingSkill 初始为 null', () => {
    App.battle = null;
    App.pendingSkill = null;
    expect(App.battle).toBeNull();
    expect(App.pendingSkill).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npm test -- tests/app.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// assets/scripts/core/App.ts
import type { ConfigSet, SkillType } from '../data/types';
import type { BattleController } from '../managers/BattleController';
import type { SaveManager } from '../managers/SaveManager';
import type { WeChatAdapter } from './WeChatAdapter';
import type { AudioManager } from './AudioManager';

// 全局单例容器。注意：EventBus 不放在全局——每场战斗用 BattleScene 内的局部 bus，
// 场景重载时旧 bus 随旧 BattleController 一起回收，避免「再来一次」遗留监听器。
export const App = {
  config: null as unknown as ConfigSet,
  save: null as unknown as SaveManager,
  wechat: null as unknown as WeChatAdapter,
  audio: null as unknown as AudioManager,
  battle: null as unknown as BattleController | null,
  pendingSkill: null as unknown as SkillType | null,
  pendingLevel: null as unknown as string | null,  // LevelSelect 选中的关卡，BattleScene 消费
  currentLevel: null as unknown as string | null, // 当前战斗关卡，ResultPanel 结算用
};
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add assets/scripts/core/App.ts tests/app.test.ts
git commit -m "feat(core): App 全局单例容器

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: cc 类型 shim + Bootstrap 初始化 + 配置资源

本任务产出第一个 Cocos 组件（`Bootstrap`），并把 `cc` shim、`tsconfig` 装饰器开关、配置 JSON 一起落地（其交付物需要它们）。

**Files:**
- Create: `assets/scripts/core/cc.d.ts`
- Modify: `tsconfig.json`（加 `experimentalDecorators`）
- Create: `assets/scripts/core/Bootstrap.ts`
- Create: `assets/resources/config/{towers,enemies,levels,waves,skills}.json`

**Interfaces:**
- Consumes: `App`、`ConfigLoader`、`WeChatAdapter`、`AudioManager`、`SaveManager`、`Storage`
- Produces（后续所有场景依赖）：`App.config/save/wechat/audio` 初始化；进入 `MainMenu` 场景

- [ ] **Step 1: 写 cc 类型 shim**

```ts
// assets/scripts/core/cc.d.ts
// Cocos Creator 3.x 类型占位：仅供 vitest/tsc 环境编译通过；
// 真实类型由 Cocos Creator 编辑器打开项目后生成的 temp/declarations/cc.d.ts 提供。
declare module 'cc' {
  export const _decorator: any;
  export const Component: any;
  export const Node: any;
  export const Vec3: any;
  export const Color: any;
  export const director: any;
  export const resources: any;
  export const JsonAsset: any;
  export const Label: any;
  export const Button: any;
  export const Sprite: any;
  export const UITransform: any;
  export const Canvas: any;
  export const Camera: any;
  export const Graphics: any;
  export const Material: any;
  export const MeshRenderer: any;
  export const utils: any;
  export const primitives: any;
  export const input: any;
  export const Input: any;
  export const find: any;
  export const sys: any;
  export const view: any;
}
```

- [ ] **Step 2: 修改 tsconfig.json 启用装饰器**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "experimentalDecorators": true
  },
  "include": ["assets/scripts/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: 写配置 JSON（5 份，放在 `assets/resources/config/`）**

```json
// assets/resources/config/towers.json
{
  "arrow": { "name": "箭塔", "levels": [
    { "cost": 50,  "atk": 12, "range": 6,   "attackInterval": 0.6, "upgradeCost": 60 },
    { "cost": 60,  "atk": 24, "range": 6.5, "attackInterval": 0.5, "upgradeCost": 100 },
    { "cost": 100, "atk": 45, "range": 7,   "attackInterval": 0.4 }
  ] },
  "ice": { "name": "冰霜塔", "slow": { "percent": 0.5, "duration": 2 }, "levels": [
    { "cost": 70,  "atk": 6,  "range": 5.5, "attackInterval": 0.8, "upgradeCost": 80 },
    { "cost": 80,  "atk": 12, "range": 6,   "attackInterval": 0.8, "upgradeCost": 120 },
    { "cost": 120, "atk": 20, "range": 6.5, "attackInterval": 0.7 }
  ] },
  "fire": { "name": "烈焰塔", "aoe": { "radius": 2.5, "burnDps": 8, "burnDuration": 2 }, "levels": [
    { "cost": 90,  "atk": 18, "range": 5,   "attackInterval": 1.2, "upgradeCost": 110 },
    { "cost": 110, "atk": 32, "range": 5.5, "attackInterval": 1.2, "upgradeCost": 160 },
    { "cost": 160, "atk": 55, "range": 6,   "attackInterval": 1.0 }
  ] },
  "arcane": { "name": "奥术塔", "armorIgnore": true, "levels": [
    { "cost": 120, "atk": 60,  "range": 6,   "attackInterval": 1.5, "upgradeCost": 140 },
    { "cost": 140, "atk": 110, "range": 6.5, "attackInterval": 1.5, "upgradeCost": 200 },
    { "cost": 200, "atk": 200, "range": 7,   "attackInterval": 1.4 }
  ] }
}
```

```json
// assets/resources/config/enemies.json
{
  "slime": { "maxHp": 40,   "speed": 2,   "armor": 0,  "rewardGold": 5,   "damageToBase": 1 },
  "wolf":  { "maxHp": 70,   "speed": 3.5, "armor": 0,  "rewardGold": 8,   "damageToBase": 1 },
  "golem": { "maxHp": 300,  "speed": 1,   "armor": 20, "rewardGold": 30,  "damageToBase": 3 },
  "bat":   { "maxHp": 55,   "speed": 4,   "armor": 5,  "rewardGold": 10,  "damageToBase": 1 },
  "elite": { "maxHp": 400,  "speed": 1.8, "armor": 10, "rewardGold": 50,  "damageToBase": 2 },
  "boss":  { "maxHp": 2000, "speed": 0.8, "armor": 30, "rewardGold": 200, "damageToBase": 5 }
}
```

```json
// assets/resources/config/levels.json
{
  "level1": {
    "name": "初始之森", "initialGold": 200, "lives": 20,
    "waypoints": [[-8, 0, -8], [-8, 0, 0], [0, 0, 0], [0, 0, 8], [8, 0, 8]],
    "buildSlots": [[-6, 0, -3], [-3, 0, -4], [-4, 0, 2], [2, 0, 4], [5, 0, 2], [4, 0, -2]],
    "waves": ["w1", "w2", "w3"],
    "skills": ["meteor", "frostNova", "goldRain"]
  },
  "level2": {
    "name": "风语峡谷", "initialGold": 250, "lives": 18,
    "waypoints": [[-10, 0, 0], [-4, 0, 0], [-4, 0, 6], [4, 0, 6], [4, 0, -6], [10, 0, -6]],
    "buildSlots": [[-7, 0, 2], [-4, 0, 3], [0, 0, 6], [4, 0, 0], [7, 0, -3], [-1, 0, -3]],
    "waves": ["w4", "w5"],
    "skills": ["meteor", "frostNova", "goldRain"]
  },
  "level3": {
    "name": "远古遗迹", "initialGold": 300, "lives": 15,
    "waypoints": [[-10, 0, 10], [-5, 0, 10], [-5, 0, -10], [5, 0, -10], [5, 0, 10], [10, 0, 10]],
    "buildSlots": [[-8, 0, 6], [-5, 0, 0], [0, 0, -10], [5, 0, 0], [8, 0, 6], [0, 0, 10]],
    "waves": ["w6"],
    "skills": ["meteor", "frostNova", "goldRain"]
  }
}
```

```json
// assets/resources/config/waves.json
{
  "w1": { "prepareTime": 5, "rewardGold": 50, "spawns": [
    { "type": "slime", "count": 8, "interval": 1.0 },
    { "type": "wolf",  "count": 4, "interval": 1.5 }
  ] },
  "w2": { "prepareTime": 5, "rewardGold": 80, "spawns": [
    { "type": "wolf",  "count": 6, "interval": 1.0 },
    { "type": "bat",   "count": 5, "interval": 0.8 },
    { "type": "golem", "count": 2, "interval": 2.0 }
  ] },
  "w3": { "prepareTime": 8, "rewardGold": 120, "isElite": true, "spawns": [
    { "type": "elite", "count": 3, "interval": 2.0 },
    { "type": "golem", "count": 4, "interval": 1.5 },
    { "type": "boss",  "count": 1, "interval": 0 }
  ] },
  "w4": { "prepareTime": 5, "rewardGold": 70, "spawns": [
    { "type": "wolf", "count": 8, "interval": 1.0 },
    { "type": "bat",  "count": 6, "interval": 0.8 }
  ] },
  "w5": { "prepareTime": 8, "rewardGold": 130, "isBoss": true, "spawns": [
    { "type": "golem", "count": 5, "interval": 1.5 },
    { "type": "elite", "count": 3, "interval": 2.0 },
    { "type": "boss",  "count": 1, "interval": 0 }
  ] },
  "w6": { "prepareTime": 10, "rewardGold": 200, "isBoss": true, "spawns": [
    { "type": "elite", "count": 5, "interval": 2.0 },
    { "type": "golem", "count": 5, "interval": 1.5 },
    { "type": "boss",  "count": 2, "interval": 3.0 }
  ] }
}
```

```json
// assets/resources/config/skills.json
{
  "meteor":    { "name": "陨石术",   "damage": 100, "radius": 3, "cooldown": 30, "maxUses": 2 },
  "frostNova": { "name": "冰霜新星", "slowPercent": 0.6, "duration": 5, "cooldown": 20, "maxUses": 3 },
  "goldRain":  { "name": "金币雨",   "gold": 150, "cooldown": 45, "maxUses": 1 }
}
```

- [ ] **Step 4: 写 Bootstrap**

```ts
// assets/scripts/core/Bootstrap.ts
import { _decorator, Component, director, resources, JsonAsset } from 'cc';
import { App } from './App';
import { ConfigLoader } from '../data/ConfigLoader';
import { SaveManager, Storage } from '../managers/SaveManager';
import { WeChatAdapter } from './WeChatAdapter';
import { AudioManager } from './AudioManager';

const { ccclass } = _decorator;

function loadJson(name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    resources.load(`config/${name}`, JsonAsset, (err: unknown, asset: any) => {
      if (err) reject(err);
      else resolve(asset.json);
    });
  });
}

@ccclass('Bootstrap')
export class Bootstrap extends Component {
  async start(): Promise<void> {
    App.wechat = new WeChatAdapter();
    App.audio = new AudioManager();

    const [towers, enemies, levels, waves, skills] = await Promise.all([
      loadJson('towers'), loadJson('enemies'), loadJson('levels'), loadJson('waves'), loadJson('skills'),
    ]);
    const store: Record<string, unknown> = {
      'towers.json': towers,
      'enemies.json': enemies,
      'levels.json': levels,
      'waves.json': waves,
      'skills.json': skills,
    };
    App.config = new ConfigLoader((path) => store[path]).loadAll();

    const storage: Storage = {
      get: (key) => {
        const v = App.wechat.getStorage(key);
        return typeof v === 'string' ? v : null;
      },
      set: (key, value) => App.wechat.setStorage(key, value),
    };
    App.save = new SaveManager(storage);

    App.wechat.login(() => { /* 登录态回调占位 */ });
    director.loadScene('MainMenu');
  }
}
```

- [ ] **Step 5: 编辑器搭建 Startup 场景**

1. 在 Cocos Creator 新建场景 `assets/scenes/Startup.scene`。
2. 场景里新建空节点，命名 `Bootstrap`，把 `Bootstrap` 组件挂到该节点。
3. 保存场景。

- [ ] **Step 6: 验证**

Run: `npm run typecheck`（应通过，`cc` 由 shim 解析）；然后在 Cocos Creator 打开项目，确认 Startup 场景运行时能打印无报错并跳转到 MainMenu（MainMenu 场景在 Task 9 创建，先跳过跳转验证，仅确认 Bootstrap 初始化不抛错）。

- [ ] **Step 7: 提交**

```bash
git add assets/scripts/core/cc.d.ts tsconfig.json assets/scripts/core/Bootstrap.ts assets/resources/config/towers.json assets/resources/config/enemies.json assets/resources/config/levels.json assets/resources/config/waves.json assets/resources/config/skills.json
git commit -m "feat(core): Bootstrap 初始化 + cc shim + 配置资源

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: 占位 3D 图元 + 战斗实体视图

本任务产出 3D 视图构建工具与敌人/塔/建造格子的渲染组件。

**Files:**
- Create: `assets/scripts/gameplay/worldKit.ts`
- Create: `assets/scripts/gameplay/EnemyView.ts`
- Create: `assets/scripts/gameplay/TowerView.ts`
- Create: `assets/scripts/gameplay/BuildSlotView.ts`

**Interfaces:**
- Consumes: `EnemyRuntime`、`TowerRuntime`（`managers/runtime.ts`）；`EnemyType`、`TowerType`、`Vec3`
- Produces（BattleScene 依赖）：
  - `worldKit.createPrimitive(parent, size, color): Node`（占位立方体）
  - `worldKit.createGround(parent, waypoints)`（地面/路线可视标记）
  - `class EnemyView`（`runtime: EnemyRuntime | null`，每帧同步 `position`）
  - `class TowerView`（`setLevel(level)` 更新缩放）
  - `class BuildSlotView`（`slotIndex`，纯可视化标记）

- [ ] **Step 1: 写 worldKit.ts**

```ts
// assets/scripts/gameplay/worldKit.ts
import { Node, Color, Vec3, MeshRenderer, Material, utils, primitives } from 'cc';

// 创建纯色占位 3D 立方体。effect 名若在个别版本有差异，仅影响贴色，不影响节点位置/逻辑。
export function createPrimitive(parent: Node, size: number, color: Color): Node {
  const node = new Node('prim');
  const mr = node.addComponent(MeshRenderer);
  mr.mesh = utils.MeshUtils.createMesh(primitives.box({ width: size, height: size, length: size }));
  const mat = new Material();
  mat.initialize({ effectName: 'builtin-standard' });
  mat.setProperty('albedo', color);
  mr.material = mat;
  parent.addChild(node);
  return node;
}

// 地面：一个大的深色平面（放大薄盒）+ 沿路点的路线标记（建造槽位由 BattleScene 单独创建）。
export function createGround(parent: Node, waypoints: Vec3[]): Node {
  const ground = createPrimitive(parent, 24, new Color(40, 60, 40, 255));
  ground.setPosition(0, -0.6, 0);
  ground.setScale(1, 0.05, 1);

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const mid: Vec3 = [(a[0] + b[0]) / 2, 0.05, (a[2] + b[2]) / 2];
    const seg = createPrimitive(parent, 0.5, new Color(200, 180, 120, 255));
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    seg.setPosition(mid[0], mid[1], mid[2]);
    seg.setScale(len || 1, 0.1, 1);
    if (len > 0) seg.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
  }
  return ground;
}
```

- [ ] **Step 2: 写 EnemyView**

```ts
// assets/scripts/gameplay/EnemyView.ts
import { _decorator, Component } from 'cc';
import type { EnemyRuntime } from '../managers/runtime';

const { ccclass } = _decorator;

@ccclass('EnemyView')
export class EnemyView extends Component {
  runtime: EnemyRuntime | null = null;

  update(): void {
    if (!this.runtime) return;
    const p = this.runtime.position;
    // +0.5 让图元站到地面上
    this.node.setPosition(p[0], p[1] + 0.5, p[2]);
  }
}
```

- [ ] **Step 3: 写 TowerView**

```ts
// assets/scripts/gameplay/TowerView.ts
import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

@ccclass('TowerView')
export class TowerView extends Component {
  private level = 0;

  setLevel(level: number): void {
    this.level = level;
    const s = 1 + level * 0.35;
    this.node.setScale(s, s, s);
  }
}
```

- [ ] **Step 4: 写 BuildSlotView**

```ts
// assets/scripts/gameplay/BuildSlotView.ts
import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

// 建造格子仅作为可视化标记；点击拾取由 BattleScene 的全局 touch + raycast 完成
// （3D 节点不参与 2D touch 命中测试，不能在 node 上绑 TOUCH_START）。
@ccclass('BuildSlotView')
export class BuildSlotView extends Component {
  @property slotIndex = 0;
}
```

- [ ] **Step 5: 验证**

Run: `npm run typecheck`（应通过）。在编辑器打开项目，确认无编译报错（本任务的组件在 Task 6 才会被 BattleScene 实例化，此处先验证编译）。

- [ ] **Step 6: 提交**

```bash
git add assets/scripts/gameplay/worldKit.ts assets/scripts/gameplay/EnemyView.ts assets/scripts/gameplay/TowerView.ts assets/scripts/gameplay/BuildSlotView.ts
git commit -m "feat(gameplay): 占位 3D 图元 + 敌人/塔/建造格子视图

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: UI 工具 + HUD

**Files:**
- Create: `assets/scripts/ui/uiKit.ts`
- Create: `assets/scripts/ui/HUD.ts`

**Interfaces:**
- Consumes: `App`
- Produces（BattleScene/TowerPanel/SkillBar/ResultPanel 依赖）：
  - `uiKit.createLabel(parent, text, opts?): Label`、`createPanel(parent, name, w, h, color): Node`、`createButton(parent, name, text, opts): Label`
  - `class HUD`（`refresh()` 读取 `App.battle` 更新金币/生命/波次）

- [ ] **Step 1: 写 uiKit.ts**

```ts
// assets/scripts/ui/uiKit.ts
import { Node, Label, Color, UITransform, Graphics } from 'cc';

export function createLabel(parent: Node, text: string, opts: { fontSize?: number; color?: Color; x?: number; y?: number } = {}): Label {
  const node = new Node('Label');
  node.addComponent(UITransform);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = opts.fontSize ?? 24;
  label.lineHeight = (opts.fontSize ?? 24) + 6;
  label.color = opts.color ?? Color.WHITE;
  parent.addChild(node);
  node.setPosition(opts.x ?? 0, opts.y ?? 0, 0);
  return label;
}

export function createPanel(parent: Node, name: string, width: number, height: number, color: Color): Node {
  const node = new Node(name);
  node.addComponent(UITransform).setContentSize(width, height);
  const g = node.addComponent(Graphics);
  g.fillColor = color;
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();
  parent.addChild(node);
  return node;
}

export function createButton(parent: Node, name: string, text: string, opts: { width?: number; height?: number; x?: number; y?: number; onClick: () => void }): Label {
  const node = createPanel(parent, name, opts.width ?? 160, opts.height ?? 48, new Color(70, 110, 200, 255));
  node.setPosition(opts.x ?? 0, opts.y ?? 0, 0);
  const label = createLabel(node, text, { fontSize: 22 });
  label.node.setPosition(0, 0, 0);
  node.on(Node.EventType.TOUCH_END, opts.onClick);
  return label;
}
```

- [ ] **Step 2: 写 HUD.ts**

```ts
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
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck`（应通过）。在编辑器确认无编译报错（HUD 在 Task 6/7 由 BattleScene 场景挂载后生效）。

- [ ] **Step 4: 提交**

```bash
git add assets/scripts/ui/uiKit.ts assets/scripts/ui/HUD.ts
git commit -m "feat(ui): UI 工具 + HUD（金币/生命/波次）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: TowerPanel 塔面板 + SkillBar 技能栏

**Files:**
- Create: `assets/scripts/ui/TowerPanel.ts`
- Create: `assets/scripts/ui/SkillBar.ts`

**Interfaces:**
- Consumes: `App`、`uiKit`
- Produces（BattleScene 依赖）：
  - `class TowerPanel`（`open(slotIndex: number, hasTower: boolean)`、`close()`；建造/升级/出售）
  - `class SkillBar`（刷新技能按钮；陨石设 `App.pendingSkill`，其余即时释放）

- [ ] **Step 1: 写 TowerPanel.ts**

```ts
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
```

- [ ] **Step 2: 写 SkillBar.ts**

```ts
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
      // 陨石需点选目标点，记录待释放
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
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck`。在编辑器确认编译通过。

- [ ] **Step 4: 提交**

```bash
git add assets/scripts/ui/TowerPanel.ts assets/scripts/ui/SkillBar.ts
git commit -m "feat(ui): TowerPanel 塔面板 + SkillBar 技能栏

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: BattleScene 战斗组装与驱动

本任务把管理器与视图组装起来，是 Plan 3 的核心。

**Files:**
- Create: `assets/scripts/scenes/BattleScene.ts`

**Interfaces:**
- Consumes: `App`、`BattleController`、`worldKit`、`EnemyView`、`TowerView`、`BuildSlotView`、`HUD`、`TowerPanel`、`SkillBar`、`ResultPanel`
- Produces：可运行的战斗场景（刷怪→塔攻击→胜负判定→结算）

- [ ] **Step 1: 写 BattleScene.ts**

```ts
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
```

> 注：`camera.screenPointToRay` 返回 `{ o, d }`（Vec3）；若个别版本字段名不同（如 `origin/direction`），在编辑器内按实际返回结构微调 `screenToGround`。UI 组件通过 `find('Canvas/...')` 定位，需保证场景层级正确（见 Step 2）。

- [ ] **Step 2: 编辑器搭建 Battle 场景**

1. 新建场景 `assets/scenes/Battle.scene`。
2. 建空节点 `BattleScene`（3D 根节点），挂 `BattleScene` 组件（`levelId` 留空，运行时由 `App.pendingLevel` 传入，默认 `level1`）。
3. 建 `Canvas`（默认 2D Canvas），在其下建 4 个空子节点并分别挂组件：
   - `HUD`（挂 `HUD`）
   - `TowerPanel`（挂 `TowerPanel`）
   - `SkillBar`（挂 `SkillBar`）
   - `ResultPanel`（挂 `ResultPanel`，Task 9 创建）
4. 保存场景。

> 说明：3D 世界（地面/路线/槽位/敌人/塔）与 3D 相机由 `BattleScene` 在运行时创建于 `BattleScene` 节点下；2D UI 放在 `Canvas` 下，`BattleScene` 用 `find('Canvas/HUD')` 等路径定位。

- [ ] **Step 3: 验证**

Run: `npm run typecheck`。在编辑器打开 Battle 场景，点击「预览」，验证：金币/生命/波次显示；点建造槽位弹塔面板；造塔后自动攻击敌人；技能栏可点；漏怪扣血、全灭判胜、生命归零判负；结算面板弹出。

- [ ] **Step 4: 提交**

```bash
git add assets/scripts/scenes/BattleScene.ts
git commit -m "feat(scenes): BattleScene 战斗组装与驱动

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 9: ResultPanel 结算 + 场景导航

**Files:**
- Create: `assets/scripts/ui/ResultPanel.ts`
- Create: `assets/scripts/scenes/MainMenuScene.ts`
- Create: `assets/scripts/scenes/LevelSelectScene.ts`

**Interfaces:**
- Consumes: `App`、`uiKit`
- Produces：结算存档；主菜单/选关/返回战斗的场景跳转

- [ ] **Step 1: 写 ResultPanel.ts**

```ts
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
```

> 注：星级计算与解锁为占位规则（按剩余生命粗略分级），后续可调。

- [ ] **Step 2: 写 MainMenuScene.ts**

```ts
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
```

- [ ] **Step 3: 写 LevelSelectScene.ts**

```ts
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
```

> 注：关卡 id 通过 `App.pendingLevel` 暂存，BattleScene.start 用 `App.pendingLevel ?? this.levelId ?? 'level1'` 读取（`this.levelId` 是组件属性，可留空，默认 `level1`）。

- [ ] **Step 4: 编辑器搭建 MainMenu / LevelSelect 场景**

1. 新建 `assets/scenes/MainMenu.scene`：建空节点挂 `MainMenuScene` 组件（作为 Canvas 子节点即可）。
2. 新建 `assets/scenes/LevelSelect.scene`：建空节点挂 `LevelSelectScene` 组件。
3. 确认场景名与 `director.loadScene` 传参一致（`MainMenu`、`LevelSelect`、`Battle`）。

- [ ] **Step 5: 验证**

Run: `npm run typecheck`。在编辑器按 Startup → MainMenu → LevelSelect → Battle 顺序预览，验证完整流程：主菜单进入选关 → 选关进战斗 → 战斗胜利/失败 → 结算面板 → 再来一次/返回选关；胜利后重进选关能看到下一关解锁、星星记录（通过 `App.save` 持久化）。

- [ ] **Step 6: 提交**

```bash
git add assets/scripts/ui/ResultPanel.ts assets/scripts/scenes/MainMenuScene.ts assets/scripts/scenes/LevelSelectScene.ts
git commit -m "feat(ui): ResultPanel 结算 + 主菜单/选关场景导航

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 10: 微信小游戏构建配置

**Files:**
- Create: `project.json`
- Create: `settings/v2/packages/project.json`（Cocos 项目包配置占位）
- Create: `docs/wechat-build.md`（构建步骤说明）

**Interfaces:**
- Consumes: 无
- Produces：可在 Cocos Creator 中构建并发布到微信小游戏的工程配置

- [ ] **Step 1: 写 project.json**

```json
{
  "name": "tafang",
  "type": "3d",
  "version": "0.1.0",
  "description": "塔防单机游戏（微信小游戏）",
  "author": "",
  "main": "",
  "uuid": "00000000-0000-0000-0000-000000000000"
}
```

- [ ] **Step 2: 写 settings/v2/packages/project.json**

```json
{
  "__version__": "1.0.0"
}
```

- [ ] **Step 3: 写构建步骤说明 docs/wechat-build.md**

```markdown
# 微信小游戏构建步骤

1. 用 Cocos Creator 3.x 打开本工程（D:\\project\\tafang）。
2. 首次打开会生成 `library/`、`temp/`、`local/`、`profiles/`（已在 .gitignore 中排除）。
3. 菜单「项目 → 构建发布」。
4. 平台选「微信小游戏」，填写：
   - 初始场景：Startup
   - 主包资源按默认（本项目资源量小，无需分包）
5. 点击「构建」。
6. 用「微信开发者工具」打开构建产物目录 `build/wechatgame/`。
7. 填入 AppID（测试可用测试号），编译预览 / 上传。
8. 微信 API（login/share/onShow/onHide/storage）由 WeChatAdapter 自动检测 `wx` 对象；开发者工具内 `wx` 存在，会走真实微信接口；浏览器/编辑器内自动降级为 no-op / localStorage。
```

- [ ] **Step 4: 验证**

在 Cocos Creator 中执行「构建发布 → 微信小游戏」，确认构建成功无报错；在微信开发者工具中预览，确认登录/分享按钮可触发、切后台自动暂停、回前台自动恢复。

- [ ] **Step 5: 提交**

```bash
git add project.json settings/v2/packages/project.json docs/wechat-build.md
git commit -m "chore: 微信小游戏构建配置与步骤说明

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 完成标准

- `npm test` 全绿（Plan 1/2 单测 + 本计划 WeChatAdapter/AudioManager/App 单测）。
- `npm run typecheck` 无类型错误（Cocos 组件经 `cc.d.ts` shim 通过）。
- 在 Cocos Creator 中可跑通完整流程：Startup → MainMenu → LevelSelect → Battle → 结算，覆盖刷怪/造塔/升级/出售/技能/胜负判定/存档。
- 微信小游戏可构建并在开发者工具预览；登录/分享/生命周期/存储经 WeChatAdapter 正常工作。
- 逻辑/规则层（Plan 1/2）未被改动。
