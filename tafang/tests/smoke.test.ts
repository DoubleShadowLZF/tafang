// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('测试框架可运行', () => {
    expect(1 + 1).toBe(2);
  });
});
