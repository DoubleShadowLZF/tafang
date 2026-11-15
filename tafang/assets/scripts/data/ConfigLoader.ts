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
