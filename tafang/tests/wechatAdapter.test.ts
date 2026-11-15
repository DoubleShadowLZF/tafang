import { describe, it, expect } from 'vitest';
import { WeChatAdapter, WeChatEnv } from '../assets/scripts/core/WeChatAdapter';

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

  it('offShow/offHide 转发到 env 的 offShow/offHide', () => {
    let offShow = 0; let offHide = 0;
    const wx: WeChatEnv = {
      offShow: (cb) => { offShow++; cb(); },
      offHide: (cb) => { offHide++; cb(); },
    };
    const adapter = new WeChatAdapter(wx);
    adapter.offShow(() => {});
    adapter.offHide(() => {});
    expect(offShow).toBe(1);
    expect(offHide).toBe(1);
  });

  it('env 无 offShow/offHide 时静默（不抛错）', () => {
    const adapter = new WeChatAdapter({});
    expect(() => { adapter.offShow(() => {}); adapter.offHide(() => {}); }).not.toThrow();
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
