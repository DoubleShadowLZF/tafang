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
