import { describe, it, expect } from 'vitest';
import { AudioManager, AudioSink } from '../assets/scripts/core/AudioManager';

describe('AudioManager', () => {
  it('委托 sink 播放', () => {
    const calls: string[] = [];
    const sink: AudioSink = {
      playSfx: (n) => calls.push('sfx:' + n),
      playBgm: (n) => calls.push('bgm:' + n),
      stopBgm: () => calls.push('stop'),
    };
    const audio = new AudioManager(sink);
    audio.playSfx('hit');
    audio.playBgm('main');
    audio.stopBgm();
    expect(calls).toEqual(['sfx:hit', 'bgm:main', 'stop']);
  });

  it('无 sink 时为 no-op 不抛错', () => {
    const audio = new AudioManager();
    expect(() => { audio.playSfx('x'); audio.playBgm('y'); audio.stopBgm(); }).not.toThrow();
  });
});
