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
