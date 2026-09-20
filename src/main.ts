import Phaser from 'phaser';
import './style.css';
import { CrocodileRiverScene } from './games/crocodile-river/scenes/CrocodileRiverScene';
import { JumpPartyScene } from './games/jump-party/JumpPartyScene';
import { MermaidGameScene } from './games/mermaid/MermaidGameScene';
import { CafeScene } from './games/cafe/CafeScene';

const selectedGame = new URLSearchParams(window.location.search).get('game');
const scene = selectedGame === 'cafe' ? CafeScene : selectedGame === 'jump-party' ? JumpPartyScene : selectedGame === 'crocodile-river' ? CrocodileRiverScene : selectedGame === 'mermaid' ? MermaidGameScene : undefined;
let game: Phaser.Game | undefined;
const gameHomeButton = document.querySelector<HTMLButtonElement>('#game-home');
gameHomeButton?.addEventListener('click', () => { window.location.href = import.meta.env.BASE_URL; });

const syncVisualViewport = (): void => {
  const width = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  document.documentElement.style.setProperty('--app-width', `${width}px`);
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  game?.scale.resize(width, height);
};

if (scene) {
  document.body.classList.add('playing');
  document.querySelector('#launcher')?.setAttribute('hidden', '');
  document.querySelector('#game-loader')?.removeAttribute('hidden');
  if (selectedGame === 'crocodile-river' || selectedGame === 'jump-party') gameHomeButton?.removeAttribute('hidden');
  const isIphoneSafari = /iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIphoneSafari && !isStandalone) document.querySelector('#ios-help')?.removeAttribute('hidden');
  game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  transparent: true,
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
  syncVisualViewport();
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
const fullscreenSupported = Boolean(fullscreenElement.requestFullscreen || fullscreenElement.webkitRequestFullscreen);
if (!fullscreenSupported) fullscreenButton?.setAttribute('hidden', '');

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
document.querySelector('#dismiss-ios-help')?.addEventListener('click', () => {
  document.querySelector('#ios-help')?.setAttribute('hidden', '');
});

window.visualViewport?.addEventListener('resize', syncVisualViewport);
window.addEventListener('resize', syncVisualViewport);
window.addEventListener('pageshow', syncVisualViewport);
window.addEventListener('orientationchange', () => {
  syncVisualViewport();
  window.setTimeout(syncVisualViewport, 180);
  window.setTimeout(syncVisualViewport, 600);
});

let checkingForUpdate = false;
const checkForAppUpdate = async (): Promise<void> => {
  if (checkingForUpdate || import.meta.env.DEV) return;
  checkingForUpdate = true;
  try {
    const checkUrl = new URL(window.location.href);
    checkUrl.searchParams.set('_check', Date.now().toString());
    const response = await fetch(checkUrl, { cache: 'no-store' });
    const latestHtml = await response.text();
    const latestScript = latestHtml.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
    const currentScript = document.querySelector<HTMLScriptElement>('script[type="module"]')?.getAttribute('src');
    if (latestScript && currentScript && latestScript !== currentScript) {
      const reloadUrl = new URL(window.location.href);
      reloadUrl.searchParams.set('_update', Date.now().toString());
      window.location.replace(reloadUrl);
    }
  } catch {
    // Staying on the current playable version is better than interrupting offline play.
  } finally {
    checkingForUpdate = false;
  }
};

window.addEventListener('pageshow', () => void checkForAppUpdate());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForAppUpdate();
});
