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
