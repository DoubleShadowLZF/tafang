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
