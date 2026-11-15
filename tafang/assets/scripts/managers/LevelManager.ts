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
