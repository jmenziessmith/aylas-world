import Phaser from 'phaser';
import './style.css';
import { CrocodileRiverScene } from './games/crocodile-river/scenes/CrocodileRiverScene';
import { JumpPartyScene } from './games/jump-party/JumpPartyScene';

const selectedGame = new URLSearchParams(window.location.search).get('game');
const scene = selectedGame === 'jump-party' ? JumpPartyScene : selectedGame === 'crocodile-river' ? CrocodileRiverScene : undefined;
let game: Phaser.Game | undefined;

if (scene) {
  document.body.classList.add('playing');
  document.querySelector('#launcher')?.setAttribute('hidden', '');
  game = new Phaser.Game({
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
    scene: [scene]
  });
}

window.addEventListener('beforeunload', () => game?.destroy(true));

const fullscreenElement = document.documentElement as HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};
const fullscreenDocument = document as Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
};
const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreen-toggle');

const toggleFullscreen = async (): Promise<void> => {
  if (!game) return;
  if (document.fullscreenElement || fullscreenDocument.webkitFullscreenElement) {
    const exit = document.exitFullscreen?.bind(document) ?? fullscreenDocument.webkitExitFullscreen?.bind(fullscreenDocument);
    await exit?.().catch(() => undefined);
    return;
  }
  const request = fullscreenElement.requestFullscreen?.bind(fullscreenElement)
    ?? fullscreenElement.webkitRequestFullscreen?.bind(fullscreenElement);
  await request?.({ navigationUI: 'hide' }).catch(() => undefined);
};

fullscreenButton?.addEventListener('click', () => void toggleFullscreen());
