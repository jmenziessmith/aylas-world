import Phaser from 'phaser';
import { crocodileRiver as level } from '../levels/crocodileRiver';
import type { RetrievalItem } from '../types/level';

type Landing = {
  id: string;
  x: number;
  y: number;
  kind: 'bank' | 'rock' | 'log' | 'crocodile';
};

const BASE_HEIGHT = 720;
const WATER_TOP = 280;
const ASSETS = `${import.meta.env.BASE_URL}assets`;

export class CrocodileRiverScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private ayla!: Phaser.GameObjects.Image;
  private water!: Phaser.GameObjects.TileSprite;
  private current: Landing = { id: 'start', ...level.start, kind: 'bank' };
  private previousSafe: Landing = this.current;
  private moving = false;
  private briefing = true;
  private carrying = false;
  private missionIndex = 0;
  private carriedItem?: Phaser.GameObjects.Image;
  private carriedItemId?: string;
  private missionOrder: RetrievalItem[] = [];
  private targetSprites = new Map<string, Phaser.GameObjects.Image>();
  private movingLogs = new Map<string, { sprite: Phaser.GameObjects.Image; landingOffset: number }>();
  private itemSprites = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super('crocodile-river');
  }

  preload(): void {
    this.load.image('ayla', `${ASSETS}/character/ayla.webp`);
    this.load.image('rock', `${ASSETS}/river/rock.webp`);
    this.load.image('log', `${ASSETS}/river/log.png`);
    this.load.image('crocodile', `${ASSETS}/river/crocodile.webp`);
    this.load.image('water', `${ASSETS}/river/water.webp`);
    this.load.image('start-bank', `${ASSETS}/river/start-bank.webp`);
    this.load.image('far-bank', `${ASSETS}/river/far-bank.webp`);
    this.load.image('background', `${ASSETS}/background/river-valley.webp`);
    this.load.image('bicycle', `${ASSETS}/props/bicycle.webp`);
    this.load.image('teddy', `${ASSETS}/props/teddy.webp`);
    this.load.image('ball', `${ASSETS}/props/ball.webp`);
    this.load.image('car', `${ASSETS}/props/car.webp`);
    this.load.image('backpack', `${ASSETS}/props/backpack.webp`);
  }

  create(): void {
    this.resetState();
    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBackgroundColor('#89d6f5').setBounds(0, 0, level.worldWidth, BASE_HEIGHT);
    this.createBackground();
    this.createRiver();
    this.createBanks();
    this.createTargets();
    this.createItems();
    this.createPlayer();
    this.createMenuButton();

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this);
    });
    this.resize(this.scale.gameSize);
    this.showBriefing();
  }

  update(_time: number, delta: number): void {
    this.water.tilePositionX += delta * 0.012;
    const safeLog = this.movingLogs.get(this.previousSafe.id);
    if (safeLog) {
      this.previousSafe.x = safeLog.sprite.x;
      this.previousSafe.y = safeLog.sprite.y - safeLog.landingOffset;
    }
    const currentLog = this.movingLogs.get(this.current.id);
    if (!this.moving && currentLog) {
      this.current.x = currentLog.sprite.x;
      this.current.y = currentLog.sprite.y - currentLog.landingOffset;
      this.player.setPosition(this.current.x, this.current.y);
    }
  }

  private createBackground(): void {
    this.add.tileSprite(0, 0, level.worldWidth + 1800, BASE_HEIGHT, 'background')
      .setOrigin(0)
      .setTileScale(BASE_HEIGHT / 941)
      .setScrollFactor(0.18, 1)
      .setDepth(-30);
    this.add.rectangle(level.worldWidth / 2, 350, level.worldWidth, BASE_HEIGHT, 0xeef9ff, 0.13)
      .setScrollFactor(0.35, 1)
      .setDepth(-25);
  }

  private createRiver(): void {
    this.water = this.add.tileSprite(level.worldWidth / 2, WATER_TOP, level.worldWidth, BASE_HEIGHT - WATER_TOP, 'water')
      .setOrigin(0.5, 0)
      .setTileScale(0.72)
      .setDepth(-10);
  }

  private createBanks(): void {
    const start = { id: 'start', ...level.start, kind: 'bank' as const };
    const end = { id: 'far-bank', ...level.farBank, kind: 'bank' as const };
    const startBank = this.add.image(215, 510, 'start-bank').setScale(0.48).setDepth(3);
    const farBank = this.add.image(level.worldWidth - 245, 505, 'far-bank').setScale(0.47).setDepth(3);
    this.add.image(185, 450, 'bicycle').setScale(0.2).setDepth(10);

    this.makeInteractive(startBank, start);
    this.makeInteractive(farBank, end);
    this.makeInteractive(this.add.zone(start.x, start.y, 260, 220), start);
    this.makeInteractive(this.add.zone(end.x + 70, end.y, 480, 310), end);
  }

  private createTargets(): void {
    level.targets.forEach((authoredTarget) => {
      const target = {
        ...authoredTarget,
        x: authoredTarget.x + Phaser.Math.Between(-20, 20),
        y: authoredTarget.y + Phaser.Math.Between(-24, 24)
      };
      this.add.ellipse(target.x, target.y + 22, 130, 34, 0x174d63, 0.18).setDepth(4);
      const sprite = this.add.image(target.x, target.y, target.kind)
        .setScale(target.scale ?? 0.22)
        .setDepth(target.kind === 'crocodile' ? 6 : 7);
      this.targetSprites.set(target.id, sprite);
      const landingOffset = target.kind === 'rock' ? 58 : target.kind === 'log' ? 48 : 38;
      this.makeInteractive(sprite, () => ({ ...target, x: sprite.x, y: sprite.y - landingOffset }));

      if (target.kind === 'crocodile') {
        this.tweens.add({
          targets: sprite,
          x: target.x + 8,
          y: target.y + 6,
          angle: 2.5,
          duration: 1700 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });
      } else if (target.kind === 'log') {
        this.movingLogs.set(target.id, { sprite, landingOffset });
        this.tweens.add({
          targets: sprite,
          x: target.x + 18,
          y: target.y + 7,
          angle: 2,
          duration: 1250 + Math.random() * 350,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });
      }
    });
  }

  private createItems(): void {
    level.items.forEach((item) => {
      const sprite = this.add.image(item.x, item.y, item.texture)
        .setScale(item.scale)
        .setDepth(12)
        .setInteractive({ cursor: 'pointer' });
      this.itemSprites.set(item.id, sprite);
      sprite.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (this.current.id !== 'far-bank' || this.moving) return;
        if (this.carrying) {
          const previousSprite = this.carriedItemId ? this.itemSprites.get(this.carriedItemId) : undefined;
          previousSprite?.setVisible(true).setInteractive({ cursor: 'pointer' });
          this.carriedItem?.destroy();
        }
        this.carrying = true;
        this.carriedItemId = item.id;
        sprite.setVisible(false).disableInteractive();
        this.ayla.setFlipX(true);
        this.carriedItem = this.add.image(-30, -62, item.texture).setScale(item.scale * 0.72);
        this.player.add(this.carriedItem);
        this.tweens.add({ targets: this.player, y: this.player.y - 24, duration: 150, yoyo: true, repeat: 2 });
      });
    });
  }

  private createPlayer(): void {
    const shadow = this.add.ellipse(0, 5, 72, 20, 0x173d4d, 0.25);
    this.ayla = this.add.image(0, 0, 'ayla').setOrigin(0.5, 0.88).setScale(0.135);
    this.player = this.add.container(level.start.x, level.start.y, [shadow, this.ayla]).setDepth(20);
    this.startIdle();
  }

  private createMenuButton(): void {
    const button = this.add.text(1170, 42, '‹ Games', {
      fontFamily: 'ui-rounded, system-ui, sans-serif',
      fontSize: '24px',
      color: '#24495b',
      fontStyle: 'bold',
      backgroundColor: '#ffffffdd',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(90).setInteractive({ cursor: 'pointer' });
    button.on(Phaser.Input.Events.POINTER_DOWN, () => { window.location.href = import.meta.env.BASE_URL; });
  }

  private showBriefing(): void {
    this.briefing = true;
    const bubble = this.add.circle(235, 355, 58, 0xffffff, 0.9).setStrokeStyle(4, 0xffd96a, 0.9).setDepth(30);
    const item = this.missionOrder[this.missionIndex];
    if (!item) {
      this.briefing = false;
      return;
    }
    const picture = this.add.image(235, 355, item.texture)
      .setScale(item.scale * 0.72)
      .setDepth(31);
    const clue = [bubble, picture];
    this.tweens.add({
      targets: clue,
      scaleX: '+=0.08',
      scaleY: '+=0.08',
      duration: 420,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.tweens.add({
          targets: clue,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            bubble.destroy();
            picture.destroy();
            this.briefing = false;
          }
        });
      }
    });
  }

  private makeInteractive(object: Phaser.GameObjects.GameObject, destination: Landing | (() => Landing)): void {
    object.setInteractive({ cursor: 'pointer' });
    object.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.tryJump(typeof destination === 'function' ? destination() : destination);
    });
  }

  private tryJump(destination: Landing): void {
    if (this.briefing || this.moving || destination.id === this.current.id) return;
    if (Phaser.Math.Distance.BetweenPoints(this.current, destination) > level.maxJumpDistance) return;
    this.jump(destination);
  }

  private jump(destination: Landing): void {
    this.moving = true;
    const from = { x: this.player.x, y: this.player.y };
    const distance = Phaser.Math.Distance.BetweenPoints(from, destination);
    const duration = Phaser.Math.Clamp(460 + distance * 0.35, 500, 760);
    const height = Phaser.Math.Clamp(105 + Math.abs(destination.x - from.x) * 0.1, 115, 175);
    const progress = { value: 0 };

    this.tweens.killTweensOf(this.ayla);
    this.tweens.add({ targets: this.player, scaleX: 0.93, scaleY: 1.07, duration: 90, yoyo: true });
    this.tweens.add({
      targets: progress,
      value: 1,
      duration,
      ease: 'Sine.InOut',
      onUpdate: () => {
        const t = progress.value;
        this.player.x = Phaser.Math.Linear(from.x, destination.x, t);
        this.player.y = Phaser.Math.Linear(from.y, destination.y, t) - height * 4 * t * (1 - t);
        this.player.angle = Math.sin(Math.PI * t) * (destination.x > from.x ? 4 : -4);
      },
      onComplete: () => this.land(destination)
    });
  }

  private land(destination: Landing): void {
    this.player.setPosition(destination.x, destination.y).setAngle(0);
    this.current = destination;
    this.moving = false;
    this.startIdle();
    this.tweens.add({ targets: this.player, scaleX: 1.08, scaleY: 0.9, duration: 90, yoyo: true });

    if (destination.kind === 'crocodile') {
      this.time.delayedCall(120, () => this.bounceBack(destination));
    } else {
      this.previousSafe = destination;
      if (destination.id === 'start' && this.carrying) this.deliverItem();
    }
  }

  private deliverItem(): void {
    const item = level.items.find(({ id }) => id === this.carriedItemId);
    const requestedItem = this.missionOrder[this.missionIndex];
    if (!item || !requestedItem || !this.carriedItem) return;
    this.moving = true;
    this.carrying = false;
    this.ayla.setFlipX(false);

    const delivery = this.carriedItem;
    this.player.remove(delivery);
    this.carriedItem = undefined;
    delivery.setPosition(this.player.x - 30, this.player.y - 62).setDepth(30);
    this.tweens.add({
      targets: delivery,
      x: 213 + this.missionIndex * 13,
      y: 400 - this.missionIndex * 4,
      scale: item.scale * 0.44,
      angle: -8 + this.missionIndex * 5,
      duration: 520,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.carriedItemId = undefined;
        if (item.id === requestedItem.id) {
          this.missionIndex += 1;
          this.moving = false;
          if (this.missionIndex < this.missionOrder.length) {
            this.time.delayedCall(350, () => this.showBriefing());
          } else {
            this.showCompleted();
          }
        } else {
          this.returnWrongItem(delivery, item);
        }
      }
    });
  }

  private returnWrongItem(delivery: Phaser.GameObjects.Image, item: RetrievalItem): void {
    this.tweens.add({
      targets: delivery,
      x: 520,
      y: 330,
      angle: 360,
      alpha: 0,
      duration: 650,
      ease: 'Back.In',
      onComplete: () => {
        delivery.destroy();
        this.itemSprites.get(item.id)?.setVisible(true).setInteractive({ cursor: 'pointer' });
        this.moving = false;
        this.time.delayedCall(250, () => this.showBriefing());
      }
    });
  }

  private showCompleted(): void {
    this.briefing = true;
    const camera = this.cameras.main;
    const centerX = camera.worldView.centerX;
    const centerY = camera.worldView.centerY;
    const card = this.add.rectangle(centerX, centerY, 520, 400, 0xfffdf4, 0.96)
      .setStrokeStyle(8, 0xffd56a)
      .setDepth(100);
    const title = this.add.text(centerX, centerY - 35, 'All done!', {
      fontFamily: 'ui-rounded, system-ui, sans-serif',
      fontSize: '62px',
      color: '#75436a',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    const star = this.add.star(centerX, centerY + 70, 5, 26, 58, 0xffcf4a).setDepth(101);
    const button = this.add.rectangle(centerX, centerY + 178, 260, 76, 0x7bcf83)
      .setStrokeStyle(5, 0xffffff)
      .setDepth(101)
      .setInteractive({ cursor: 'pointer' });
    const buttonText = this.add.text(centerX, centerY + 178, 'Play again', {
      fontFamily: 'ui-rounded, system-ui, sans-serif',
      fontSize: '32px',
      color: '#173f39',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);
    button.on(Phaser.Input.Events.POINTER_DOWN, () => this.scene.restart());

    const home = this.add.text(centerX, centerY + 228, 'Back to games', {
      fontFamily: 'ui-rounded, system-ui, sans-serif', fontSize: '22px', color: '#356878', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102).setInteractive({ cursor: 'pointer' });
    home.on(Phaser.Input.Events.POINTER_DOWN, () => { window.location.href = import.meta.env.BASE_URL; });

    this.tweens.add({ targets: [card, title, star, button, buttonText, home], scale: { from: 0.8, to: 1 }, duration: 420, ease: 'Back.Out' });
    this.tweens.add({ targets: star, angle: 360, duration: 2200, repeat: -1, ease: 'Linear' });
  }

  private resetState(): void {
    this.current = { id: 'start', ...level.start, kind: 'bank' };
    this.previousSafe = this.current;
    this.moving = false;
    this.briefing = true;
    this.carrying = false;
    this.missionIndex = 0;
    this.carriedItem = undefined;
    this.carriedItemId = undefined;
    this.targetSprites.clear();
    this.movingLogs.clear();
    this.itemSprites.clear();
    this.missionOrder = Phaser.Utils.Array.Shuffle([...level.items]);
  }

  private bounceBack(crocodile: Landing): void {
    this.moving = true;
    const sprite = this.targetSprites.get(crocodile.id);
    if (sprite) {
      this.tweens.add({ targets: sprite, scaleY: sprite.scaleY * 0.72, angle: -5, duration: 100, yoyo: true });
    }

    const from = { x: this.player.x, y: this.player.y };
    const progress = { value: 0 };
    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 650,
      ease: 'Quad.Out',
      onUpdate: () => {
        const t = progress.value;
        this.player.x = Phaser.Math.Linear(from.x, this.previousSafe.x, t);
        this.player.y = Phaser.Math.Linear(from.y, this.previousSafe.y, t) - 220 * Math.sin(Math.PI * t);
        this.player.angle = t * (this.previousSafe.x < from.x ? -340 : 340);
      },
      onComplete: () => {
        this.player.setPosition(this.previousSafe.x, this.previousSafe.y).setAngle(0);
        this.current = this.previousSafe;
        this.moving = false;
        this.splash(from.x, from.y + 20);
      }
    });
  }

  private splash(x: number, y: number): void {
    for (let i = 0; i < 7; i += 1) {
      const drop = this.add.circle(x, y, Phaser.Math.Between(3, 7), 0xd8f7ff, 0.95).setDepth(30);
      this.tweens.add({
        targets: drop,
        x: x + Phaser.Math.Between(-65, 65),
        y: y - Phaser.Math.Between(45, 105),
        alpha: 0,
        duration: Phaser.Math.Between(360, 560),
        onComplete: () => drop.destroy()
      });
    }
  }

  private startIdle(): void {
    this.tweens.killTweensOf(this.ayla);
    this.ayla.setPosition(0, 0).setScale(0.135);
    this.tweens.add({
      targets: this.ayla,
      y: -3,
      scaleX: 0.137,
      scaleY: 0.133,
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private resize(gameSize: Phaser.Structs.Size): void {
    const camera = this.cameras.main;
    const zoom = gameSize.height / BASE_HEIGHT;
    camera.setViewport(0, 0, gameSize.width, gameSize.height).setZoom(zoom);
    camera.setDeadzone(Math.min(220, (gameSize.width / zoom) * 0.18), 220);
  }
}
