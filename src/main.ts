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
