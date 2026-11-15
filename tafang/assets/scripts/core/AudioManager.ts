export interface AudioSink {
  playSfx(name: string): void;
  playBgm(name: string): void;
  stopBgm(): void;
}

const noopSink: AudioSink = { playSfx() {}, playBgm() {}, stopBgm() {} };

export class AudioManager {
  constructor(private sink: AudioSink = noopSink) {}

  playSfx(name: string): void { this.sink.playSfx(name); }
  playBgm(name: string): void { this.sink.playBgm(name); }
  stopBgm(): void { this.sink.stopBgm(); }
}
