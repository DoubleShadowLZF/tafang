# 塔防单机游戏（微信小游戏）设计文档

- 日期：2026-11-15
- 状态：待评审
- 引擎：Cocos Creator 3.x（TypeScript）
- 发布平台：微信小游戏

---

## 1. 概述

开发一款 **奇幻题材（剑与魔法）** 的塔防单机游戏，具备完整核心玩法，并支持发布到微信小游戏。

**硬约束**

- 必须能构建并运行在微信小游戏平台。
- 单机游戏，无实时联网对战。

**已确认的范围决策**

| 维度 | 决策 |
|---|---|
| 引擎 | Cocos Creator 3.x (TypeScript) |
| 规模 | 完整核心玩法（多种塔+升级、精英/BOSS、多关卡、全局技能） |
| 视觉 | 3D 固定视角 |
| 题材 | 奇幻（剑与魔法） |
| 关卡架构 | 固定路线（路点）+ 固定建造格子 |
| 技能系统 | 全局主动技能（玩家点击释放，带冷却/次数限制） |
| 微信接入 | 登录 + 分享 + 生命周期 |
| 美术 | 占位素材 |

**范围外（本期不做）**

- 广告变现（激励视频/插屏/banner）
- 好友排行榜（开放数据域）
- 云存档 / 云开发
- 正式美术与音效资源
- 内购 / 虚拟支付

---

## 2. 架构

### 2.1 分层

```
┌─────────────────────────────────────────────┐
│  表现层  UI (HUD/塔面板/技能栏/结算)          │
│  逻辑层  管理器单例 + 战斗实体组件             │
│  规则层  纯函数（伤害/寻路/波次解析/经济）★可单测│
│  数据层  JSON 配置表 + 类型定义 + 存档        │
│  适配层  WeChatAdapter（登录/分享/生命周期）   │
└─────────────────────────────────────────────┘
```

- 模块间用 **EventBus（事件总线）** 解耦，管理器之间不直接互相调用。
- 所有数值用 **JSON 配置表** 外部化，平衡调整无需改代码。

### 2.2 目录结构（`assets/` 下）

```
assets/
├── scenes/          Startup / MainMenu / LevelSelect / Battle 四个场景
├── scripts/
│   ├── core/        EventBus、Singleton、GameStateMachine、SaveManager、WeChatAdapter
│   ├── data/        types.ts（类型）、ConfigLoader（配置加载/校验）
│   ├── managers/    GameManager、LevelManager、WaveManager、EconomyManager、
│   │                TowerManager、EnemyManager、SkillManager、SaveManager、AudioManager
│   ├── gameplay/    tower/（塔组件）、enemy/（敌人组件）、projectile/（弹道）、skill/（技能）
│   └── ui/          HUD、TowerPanel、SkillBar、ResultPanel 等
├── config/          towers.json、enemies.json、levels.json、waves.json、skills.json
├── prefabs/         塔、怪、弹道、建造格子的预制体
└── resources/       占位模型/贴图/音效
```

### 2.3 核心管理器（单例）

| 管理器 | 职责 |
|---|---|
| `GameManager` | 游戏状态机（主菜单→选关→战斗→结算），全局流程 |
| `LevelManager` | 加载关卡配置，构建地图/路点/建造格子，关卡数据 |
| `WaveManager` | 波次调度，按配置生成敌人，波次开始/结束 |
| `EconomyManager` | 金币（造塔/升级）、生命值（漏怪扣减） |
| `TowerManager` | 塔的建造/升级/出售，塔配置查询 |
| `EnemyManager` | 敌人生成/死亡回收、波次进度统计 |
| `SkillManager` | 全局技能栏、冷却、次数、释放 |
| `SaveManager` | 关卡进度/星级/金币的本地存档 |
| `AudioManager` | 音效/背景音乐播放（占位阶段可空实现） |

**战斗实体组件**（挂载在 3D 节点上）：

- `TowerBase`（基类）→ 箭塔 / 冰霜塔 / 烈焰塔 / 奥术塔
- `Enemy` + `EnemyMovement`（路点寻路）+ `EnemyHealth`
- `Projectile`（弹道）
- `BuildSlot`（建造格子）

---

## 3. 核心系统设计

### 3.1 波次系统（WaveManager）

- `waves.json` 定义每关波次序列，每波结构：`{ 准备倒计时, 敌人队列[{type, count, 间隔}], 是否精英/BOSS波, 波次奖励金币 }`
- 流程：波开始 → 准备倒计时 → 按队列逐只生成 → 全部死亡判定波结束 → 发放波次奖励 → 下一波
- 最后一波结束且场上无怪 → **胜利**；生命值归零 → **失败**

### 3.2 敌人系统（Enemy）

- **移动**：`EnemyMovement` 沿关卡定义的路点链（`Vector3[]`）移动，到达一点切下一点，走完全程则漏怪。
- **属性**：`maxHp / speed / armor / rewardGold / damageToBase`（漏怪扣几滴血）。
- **类型**：普通史莱姆（慢、血少）、狼（快）、石像（高甲高血）、蝙蝠（飞行，视觉悬浮，仍沿同一路径，所有塔可打）、精英（属性加成+标记）、BOSS（超高血甲）。
- **状态效果**：减速 / 冰冻 / 燃烧（持续伤害），用一个 buff 列表管理。
- 死亡 → 发金币 + 波次进度事件。

### 3.3 塔系统（Tower）

- **建造**：点击空 `BuildSlot` → 弹塔面板 → 选类型（扣金币）→ 生成塔；已建塔点击可**升级/出售**。
- **4 种塔**（每塔 3 级，升级提属性）：

| 塔 | 定位 | 机制 |
|---|---|---|
| 箭塔 | 便宜快速 | 单体物理，攻速快 |
| 冰霜塔 | 控场 | 单体减速（叠加减速 debuff） |
| 烈焰塔 | AOE | 范围溅射 + 燃烧持续伤害 |
| 奥术塔 | 攻坚 | 单体高伤、无视护甲 |

- **攻击循环**：索敌（射程内，优先"离终点最近"）→ 冷却 → 发射弹道 → 命中结算。
- **伤害公式（纯函数）**：`damage = atk × (1 − armor/(armor+K))`，奥术塔用 `armor=0` 代入。

### 3.4 经济系统（EconomyManager）

- 金币来源：初始金币、击杀奖励、波次奖励；消耗：造塔、升级、技能。
- 生命值：漏怪扣 `damageToBase`，归零失败。
- 出售塔返还造价的 **70%**（含升级花费）。
- 事件驱动：`onGoldChanged` / `onLivesChanged` → UI 自动刷新。

### 3.5 全局技能系统（SkillManager）

- 每关携带 3 个技能，底部技能栏点击释放，**冷却 + 每关次数限制**。
- 技能：**陨石术**（点选目标点，范围高伤）、**冰霜新星**（全场敌人减速数秒）、**金币雨**（立即获得一笔金币）。
- 释放判定（纯函数）：目标点/范围/数值，命中敌人生效。

---

## 4. 数据流

```
启动 → 加载全部配置表(校验) → 主菜单 → 选关
  → LevelManager 读 levels.json 构建地图/路点/建造格子
  → 进入战斗 → WaveManager 按波次刷怪
  → 敌人沿路点移动 / 塔索敌攻击 / 技能点击释放
  → 纯函数结算(伤害/经济) → EventBus 广播 → UI 刷新
  → 胜利/失败 → 结算面板 → SaveManager 存档
```

---

## 5. 配置表 schema（示例）

`config/towers.json`
```json
{ "arrow": { "name":"箭塔", "levels":[
    { "cost":50,  "atk":12, "range":6,  "attackInterval":0.6, "upgradeCost":60 },
    { "cost":60,  "atk":24, "range":6.5,"attackInterval":0.5, "upgradeCost":100 },
    { "cost":100, "atk":45, "range":7,  "attackInterval":0.4 } ] } }
```

`config/enemies.json`
```json
{ "slime":{ "maxHp":40,  "speed":2, "armor":0,  "rewardGold":5,  "damageToBase":1 },
  "golem":{ "maxHp":300, "speed":1, "armor":20,"rewardGold":30, "damageToBase":3 } }
```

`config/levels.json`
```json
{ "level1":{ "name":"初始之森", "initialGold":200, "lives":20,
    "waypoints":[[0,0,0],[10,0,0],[10,0,5]],
    "buildSlots":[[2,0,1],[4,0,2]],
    "waves":["w1","w2"], "skills":["meteor","frostNova","goldRain"] } }
```

`config/waves.json`
```json
{ "w1":{ "prepareTime":5, "rewardGold":50,
    "spawns":[ { "type":"slime","count":8,"interval":1.0 },
               { "type":"wolf","count":4,"interval":1.5 } ] } }
```

`config/skills.json`
```json
{ "meteor":{ "name":"陨石术","damage":100,"radius":3,"cooldown":30,"maxUses":2 },
  "frostNova":{ "name":"冰霜新星","slowPercent":0.6,"duration":5,"cooldown":20,"maxUses":3 },
  "goldRain":{ "name":"金币雨","gold":150,"cooldown":45,"maxUses":1 } }
```

---

## 6. 存档系统（SaveManager）

- 存到 `wx.setStorageSync`（微信）或 `localStorage`（浏览器调试），由适配层统一封装。
- 结构：`{ version, unlockedLevel, levelStars, totalGold }`。
- 容错：读档失败/字段缺失 → 回退默认值，不崩溃。

---

## 7. 微信适配层（WeChatAdapter）

- 封装 `wx.login`（登录态）、`wx.shareAppMessage`（分享）、`wx.onShow/onHide`（切后台暂停游戏、回前台恢复）。
- **非微信环境降级为 no-op**——在浏览器/编辑器里照样能跑，方便开发调试。

---

## 8. 错误处理

| 场景 | 策略 |
|---|---|
| 配置表缺失/格式错误 | 加载时校验，报错并回退默认配置，控制台告警 |
| 存档损坏 | 丢弃，重建默认存档 |
| 微信 API 不存在 | 适配层 no-op 降级 |

---

## 9. 测试策略

- **纯规则单测（vitest，不依赖 Cocos）**：伤害公式、护甲减免、波次解析、经济结算、寻路（路点推进）、技能范围判定、存档容错。
- **战斗核心循环**：场景手动测试 + 关键管理器集成冒烟测试。

---

## 10. 关键技术点（Cocos Creator 3.x）

- 3D 场景 + 正交/透视固定相机。
- 地图、路点、建造格子由关卡配置数据驱动，在场景初始化时构建。
- 敌人/塔用占位 3D 模型（立方体/胶囊体），弹道用小球或射线。
- UI 用 Cocos Canvas + 2D UI 叠加在 3D 场景之上。
- 管理器单例与战斗实体组件通过 EventBus 通信，避免循环依赖。
