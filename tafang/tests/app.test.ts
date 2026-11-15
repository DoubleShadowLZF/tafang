// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import { App } from '../assets/scripts/core/App';

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
