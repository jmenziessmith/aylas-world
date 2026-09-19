import Phaser from 'phaser';
import './style.css';
import { CrocodileRiverScene } from './game/scenes/CrocodileRiverScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#75c8ef',
  width: 1280,
  height: 720,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance'
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%'
  },
  input: {
    activePointers: 2
  },
  scene: [CrocodileRiverScene]
});

window.addEventListener('beforeunload', () => game.destroy(true));

const fullscreenElement = document.documentElement as HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

const enterMobileFullscreen = (): void => {
  if (navigator.maxTouchPoints === 0 || !matchMedia('(orientation: landscape)').matches || document.fullscreenElement) return;
  const request = fullscreenElement.requestFullscreen?.bind(fullscreenElement)
    ?? fullscreenElement.webkitRequestFullscreen?.bind(fullscreenElement);
  void request?.({ navigationUI: 'hide' }).catch(() => undefined);
};

window.addEventListener('pointerdown', enterMobileFullscreen, { capture: true });
