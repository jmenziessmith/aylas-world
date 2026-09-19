import Phaser from 'phaser';
import { BALLOON_TARGET, JUMP_TARGET, jumpPartyLevel, type PartyObject } from './level';
import { MotionJumpInput } from './MotionJumpInput';

const BASE_HEIGHT = 720;
const ASSETS = `${import.meta.env.BASE_URL}assets/jump-party`;
const NORMAL_JUMP_SPEED = 1000;
const POWERED_JUMP_SPEED = 1550;
const GRAVITY = 4000;
const MOVE_SPEED = 360;

export class JumpPartyScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private ayla!: Phaser.GameObjects.Image;
  private velocityY = 0;
  private onGround = true;
  private leftDown = false;
  private rightDown = false;
  private completed = false;
  private jumps = 0;
  private balloonsPopped = 0;
  private bagsCollected = 0;
  private poweredJumps = 0;
  private jumpText!: Phaser.GameObjects.Text;
  private balloonText!: Phaser.GameObjects.Text;
  private jumpLabel!: Phaser.GameObjects.Image;
  private balloonLabel!: Phaser.GameObjects.Image;
  private powerText!: Phaser.GameObjects.Text;
  private cheerText!: Phaser.GameObjects.Text;
  private tapHint!: Phaser.GameObjects.Text;
  private gamesButton!: Phaser.GameObjects.Text;
  private leftZone!: Phaser.GameObjects.Zone;
  private rightZone!: Phaser.GameObjects.Zone;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private balloons: Phaser.GameObjects.Image[] = [];
  private collectibles: Array<{ config: PartyObject; sprite: Phaser.GameObjects.Image }> = [];
  private puddles: Array<{ config: PartyObject; sprite: Phaser.GameObjects.Image; ready: boolean }> = [];
  private motionInput?: MotionJumpInput;
  private motionPermissionButton?: HTMLButtonElement;
  private motionEnabled = false;
  private visibleWorldWidth = 1280;
  private playableWidth = 1280;

  constructor() { super('jump-party'); }

  preload(): void {
    const images = ['background', 'hud-jumps', 'hud-balloons', 'ayla-idle', 'ayla-jump', 'ayla-powered',
      'balloon-pink', 'balloon-yellow', 'balloon-teal', 'balloon-purple', 'balloon-pop', 'cake',
      'party-bag', 'puddle', 'splash', 'power-jump'];
    images.forEach((key) => this.load.image(key, `${ASSETS}/${key}.png`));
  }

  create(): void {
    document.querySelector('#game-loader')?.setAttribute('hidden', '');
    this.resetState();
    this.cameras.main.setBackgroundColor('#76cef5');
    this.createScenery();
    this.createObjects();
    this.createPlayer();
    this.createHud();
    this.createControls();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.keyboard?.on('keydown-SPACE', this.tryJump, this);
    this.input.keyboard?.on('keydown-W', this.tryJump, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleScreenTap, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this);
    this.motionInput = new MotionJumpInput(() => this.tryJump());
    this.setupMotionPermissionPrompt();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.resize(this.scale.gameSize);
  }

  update(_time: number, deltaMs: number): void {
    if (this.completed) return;
    const dt = Math.min(deltaMs / 1000, 0.035);
    const keyboardLeft = this.cursors?.left.isDown ?? false;
    const keyboardRight = this.cursors?.right.isDown ?? false;
    const direction = (this.rightDown || keyboardRight ? 1 : 0) - (this.leftDown || keyboardLeft ? 1 : 0);
    this.player.x = Phaser.Math.Clamp(this.player.x + direction * MOVE_SPEED * dt, 95, this.playableWidth - 95);
    if (direction !== 0) this.ayla.setFlipX(direction < 0);

    if (!this.onGround) {
      this.velocityY += GRAVITY * dt;
      this.player.y += this.velocityY * dt;
      this.player.angle = direction * 3;
      if (this.player.y >= jumpPartyLevel.groundY) this.land();
    }
    this.updateCamera(dt);
    this.checkInteractions();
  }

  private createScenery(): void {
    const source = this.textures.get('background').getSourceImage() as HTMLImageElement;
    const scale = BASE_HEIGHT / source.height;
    this.add.image(0, 0, 'background').setOrigin(0).setScale(scale).setDepth(-20);
  }

  private createObjects(): void {
    jumpPartyLevel.objects.forEach((config) => {
      if (config.type === 'balloon') {
        this.spawnBalloon(config);
      } else if (config.type === 'puddle') {
        const sprite = this.add.image(config.x, config.y, 'puddle').setScale(0.28).setDepth(2);
        this.puddles.push({ config, sprite, ready: true });
      } else {
        this.spawnCollectible(config);
      }
    });
  }

  private spawnBalloon(config: PartyObject, floatIn = false): void {
    const anchorX = this.getBalloonAnchorX(config.x);
    const balloon = this.add.image(anchorX, floatIn ? BASE_HEIGHT + 100 : config.y, `balloon-${config.colour}`)
      .setScale(0.115).setDepth(8);
    balloon.setData('config', config);
    this.balloons.push(balloon);
    const startBobbing = (): void => {
      this.startBalloonDrift(balloon, config);
    };
    if (floatIn) {
      this.tweens.add({ targets: balloon, y: config.y, duration: 900, ease: 'Back.Out', onComplete: startBobbing });
    } else {
      startBobbing();
    }
  }

  private startBalloonDrift(balloon: Phaser.GameObjects.Image, config: PartyObject): void {
    const anchorX = this.getBalloonAnchorX(config.x);
    const driftX = Phaser.Math.Clamp(anchorX + Phaser.Math.Between(-70, 70), 130, this.playableWidth - 130);
    const driftY = config.y - (config.bobHeight ?? 15) - Phaser.Math.Between(0, 20);
    this.tweens.add({
      targets: balloon,
      x: driftX,
      y: driftY,
      angle: Phaser.Math.Between(-3, 3),
      duration: config.bobDuration ?? 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      delay: Phaser.Math.Between(0, 600)
    });
  }

  private getBalloonAnchorX(configX: number): number {
    const margin = 145;
    const progress = Phaser.Math.Clamp((configX - 205) / (1135 - 205), 0, 1);
    return margin + progress * (this.playableWidth - margin * 2);
  }

  private spawnCollectible(config: PartyObject): void {
    const sprite = this.add.image(config.x, config.y + 35, config.type)
      .setScale(0).setDepth(7);
    this.collectibles.push({ config, sprite });
    const targetScale = config.type === 'cake' ? 0.105 : 0.11;
    this.tweens.add({
      targets: sprite,
      y: config.y,
      scale: targetScale,
      duration: 420,
      ease: 'Back.Out',
      onComplete: () => this.tweens.add({ targets: sprite, y: config.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    });
  }

  private createPlayer(): void {
    const shadow = this.add.ellipse(0, 2, 92, 24, 0x234c50, 0.25);
    this.ayla = this.add.image(0, 0, 'ayla-idle').setOrigin(0.5, 0.92).setScale(0.135);
    this.player = this.add.container(jumpPartyLevel.startX, jumpPartyLevel.groundY, [shadow, this.ayla]).setDepth(20);
    this.startIdle();
  }

  private createHud(): void {
    this.jumpLabel = this.add.image(465, 58, 'hud-jumps').setDisplaySize(300, 100).setScrollFactor(0).setDepth(100);
    this.jumpText = this.add.text(398, 60, '0', this.counterStyle()).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.balloonLabel = this.add.image(815, 58, 'hud-balloons').setDisplaySize(300, 100).setScrollFactor(0).setDepth(100);
    this.balloonText = this.add.text(755, 60, '0', this.counterStyle()).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.powerText = this.add.text(640, 112, '', { fontFamily: 'ui-rounded, system-ui', fontSize: '28px', color: '#7b287d', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.cheerText = this.add.text(640, 158, 'Let’s jump!', { fontFamily: 'ui-rounded, system-ui', fontSize: '30px', color: '#7b287d', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 7 }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.tweens.add({ targets: this.cheerText, scale: 1.08, duration: 650, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
  }

  private createControls(): void {
    this.leftZone = this.makeMovementZone(0, 360, 1280 / 3, 360, (down) => { this.leftDown = down; });
    this.rightZone = this.makeMovementZone(1280 * 2 / 3, 360, 1280 / 3, 360, (down) => { this.rightDown = down; });
    this.tapHint = this.add.text(640, 675, 'TAP TO JUMP', { fontFamily: 'ui-rounded, system-ui', fontSize: '20px', color: '#493453', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(109);

    this.gamesButton = this.add.text(1170, 42, '‹ Games', { fontFamily: 'ui-rounded, system-ui', fontSize: '20px', color: '#24495b', fontStyle: 'bold', backgroundColor: '#ffffffee', padding: { x: 13, y: 10 } }).setOrigin(0.5).setScrollFactor(0).setDepth(110).setInteractive({ cursor: 'pointer' });
    this.gamesButton.on(Phaser.Input.Events.POINTER_DOWN, () => { window.location.href = import.meta.env.BASE_URL; });
  }

  private handleScreenTap(_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    if (!this.motionEnabled && currentlyOver.length === 0) this.tryJump();
  }

  private makeMovementZone(x: number, y: number, width: number, height: number, set: (down: boolean) => void): Phaser.GameObjects.Zone {
    const zone = this.add.zone(x, y, width, height).setOrigin(0).setScrollFactor(0).setInteractive();
    zone.on(Phaser.Input.Events.POINTER_DOWN, () => set(true));
    zone.on(Phaser.Input.Events.POINTER_UP, () => set(false));
    zone.on(Phaser.Input.Events.POINTER_OUT, () => set(false));
    return zone;
  }

  private tryJump(): void {
    if (!this.onGround || this.completed) return;
    this.onGround = false;
    const powered = this.poweredJumps > 0;
    if (powered) this.poweredJumps -= 1;
    this.velocityY = powered ? -POWERED_JUMP_SPEED : -NORMAL_JUMP_SPEED;
    this.jumps += 1;
    this.ayla.setTexture(powered ? 'ayla-powered' : 'ayla-jump').setScale(powered ? 0.15 : 0.14);
    this.jumpText.setText(`${this.jumps}`);
    this.tweens.add({ targets: this.jumpText, scale: 1.22, duration: 100, yoyo: true, ease: 'Back.Out' });
    this.celebrateJumpMilestone();
    this.updatePowerText();
    this.tweens.killTweensOf(this.ayla);
    this.tweens.add({ targets: this.player, scaleX: 0.9, scaleY: 1.1, duration: 100, yoyo: true });
    if (powered) this.powerBurst();
    this.checkCompletion();
  }

  private land(): void {
    this.player.y = jumpPartyLevel.groundY;
    this.player.angle = 0;
    this.velocityY = 0;
    this.onGround = true;
    this.ayla.setTexture('ayla-idle').setScale(0.135);
    this.tweens.add({ targets: this.player, scaleX: 1.1, scaleY: 0.9, duration: 90, yoyo: true });
    this.startIdle();
    this.puddles.forEach((puddle) => {
      if (Math.abs(this.player.x - puddle.config.x) < 175 && puddle.ready) this.splash(puddle);
    });
  }

  private checkInteractions(): void {
    const playerCenterY = this.player.y - 80;
    this.balloons = this.balloons.filter((balloon) => {
      if (Math.abs(this.player.x - balloon.x) < 95 && Math.abs(playerCenterY - balloon.y) < 115) {
        this.popBalloon(balloon);
        return false;
      }
      return true;
    });
    this.collectibles = this.collectibles.filter(({ config, sprite }) => {
      if (Math.abs(this.player.x - sprite.x) < 105 && Math.abs(playerCenterY - sprite.y) < 125) {
        this.collect(config, sprite);
        return false;
      }
      return true;
    });
    this.puddles.forEach((puddle) => {
      if (Math.abs(this.player.x - puddle.config.x) > 210) puddle.ready = true;
    });
  }

  private popBalloon(balloon: Phaser.GameObjects.Image): void {
    const config = balloon.getData('config') as PartyObject;
    this.tweens.killTweensOf(balloon);
    const effect = this.add.image(balloon.x, balloon.y, 'balloon-pop').setScale(0.02).setDepth(30);
    this.tweens.add({ targets: effect, scale: 0.16, alpha: 0, angle: 20, duration: 420, onComplete: () => effect.destroy() });
    balloon.destroy();
    this.balloonsPopped += 1;
    this.balloonText.setText(`${this.balloonsPopped}`);
    this.checkCompletion();
    this.time.delayedCall(1800, () => {
      if (!this.completed) this.spawnBalloon(config, true);
    });
  }

  private collect(config: PartyObject, sprite: Phaser.GameObjects.Image): void {
    this.tweens.killTweensOf(sprite);
    this.tweens.add({ targets: sprite, y: sprite.y - 90, scale: sprite.scale * 1.35, alpha: 0, angle: 15, duration: 420, ease: 'Back.In', onComplete: () => sprite.destroy() });
    this.sparkles(sprite.x, sprite.y);
    if (config.type === 'cake' || config.type === 'party-bag') {
      this.poweredJumps = 2;
      this.updatePowerText();
    }
    if (config.type === 'party-bag') {
      this.bagsCollected += 1;
    }
    this.time.delayedCall(config.type === 'cake' ? 6500 : 4500, () => {
      if (!this.completed) this.spawnCollectible(config);
    });
  }

  private splash(puddle: { config: PartyObject; sprite: Phaser.GameObjects.Image; ready: boolean }): void {
    puddle.ready = false;
    const splash = this.add.image(puddle.config.x, jumpPartyLevel.groundY - 35, 'splash').setScale(0.05).setDepth(25);
    this.tweens.add({ targets: splash, scaleX: 0.25, scaleY: 0.22, alpha: { from: 1, to: 0 }, y: splash.y - 45, duration: 600, ease: 'Quad.Out', onComplete: () => splash.destroy() });
    this.time.delayedCall(250, () => { puddle.ready = true; });
  }

  private powerBurst(): void {
    const effect = this.add.image(this.player.x, this.player.y - 40, 'power-jump').setScale(0.04).setDepth(18);
    this.tweens.add({ targets: effect, scale: 0.22, alpha: 0, y: effect.y + 80, duration: 520, onComplete: () => effect.destroy() });
  }

  private sparkles(x: number, y: number): void {
    for (let i = 0; i < 7; i += 1) {
      const star = this.add.star(x, y, 4, 3, 9, i % 2 ? 0xff78b1 : 0xffdf54).setDepth(30);
      this.tweens.add({ targets: star, x: x + Phaser.Math.Between(-75, 75), y: y + Phaser.Math.Between(-90, 25), alpha: 0, angle: 180, duration: Phaser.Math.Between(350, 600), onComplete: () => star.destroy() });
    }
  }

  private checkCompletion(): void {
    if (this.jumps < JUMP_TARGET || this.balloonsPopped < BALLOON_TARGET || this.completed) return;
    this.completed = true;
    this.time.delayedCall(350, () => this.showCompleted());
  }

  private showCompleted(): void {
    const x = this.cameras.main.worldView.centerX;
    const y = this.cameras.main.worldView.centerY;
    for (let i = 0; i < 28; i += 1) {
      const confetti = this.add.rectangle(x + Phaser.Math.Between(-500, 500), y - 300, 12, 24, Phaser.Display.Color.RandomRGB().color).setDepth(201).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({ targets: confetti, y: y + 330, x: confetti.x + Phaser.Math.Between(-80, 80), angle: '+=420', duration: Phaser.Math.Between(1200, 2300), repeat: -1 });
    }
    this.add.rectangle(x, y, 610, 470, 0xfffcf2, 0.97).setStrokeStyle(9, 0xffca57).setDepth(200);
    this.add.text(x, y - 155, 'Party complete!', { fontFamily: 'ui-rounded, system-ui', fontSize: '57px', fontStyle: 'bold', color: '#9b3e79' }).setOrigin(0.5).setDepth(202);
    this.add.text(x, y - 55, `Jumps  ${this.jumps}\nBalloons  ${this.balloonsPopped}\nParty bags  ${this.bagsCollected}`, { fontFamily: 'ui-rounded, system-ui', fontSize: '31px', fontStyle: 'bold', color: '#24556a', align: 'center', lineSpacing: 9 }).setOrigin(0.5).setDepth(202);
    this.makeActionButton(x - 150, y + 155, 'Play again', () => this.scene.restart());
    this.makeActionButton(x + 150, y + 155, 'Games', () => { window.location.href = import.meta.env.BASE_URL; });
  }

  private makeActionButton(x: number, y: number, text: string, action: () => void): void {
    const button = this.add.rectangle(x, y, 245, 72, 0x77d495).setStrokeStyle(5, 0xffffff).setDepth(202).setInteractive({ cursor: 'pointer' });
    this.add.text(x, y, text, { fontFamily: 'ui-rounded, system-ui', fontSize: '28px', fontStyle: 'bold', color: '#214c48' }).setOrigin(0.5).setDepth(203);
    button.on('pointerdown', action);
  }

  private startIdle(): void {
    this.tweens.killTweensOf(this.ayla);
    if (!this.onGround) return;
    this.tweens.add({ targets: this.ayla, y: -4, scaleX: 0.138, scaleY: 0.132, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private updatePowerText(): void {
    this.powerText.setText(this.poweredJumps > 0 ? `✨ ${this.poweredJumps} SUPER JUMPS! ✨` : '');
  }

  private setupMotionPermissionPrompt(): void {
    const prompt = document.querySelector<HTMLElement>('#motion-permission');
    const button = document.querySelector<HTMLButtonElement>('#allow-motion');
    const skip = document.querySelector<HTMLButtonElement>('#skip-motion');
    const message = document.querySelector<HTMLElement>('#motion-permission-message');
    if (!prompt || !button || !skip || !message || !this.motionInput?.supported) return;

    if (!window.isSecureContext) {
      message.textContent = 'Motion jumping needs a secure HTTPS connection. You can still tap anywhere to jump.';
      button.hidden = true;
      prompt.removeAttribute('hidden');
      return;
    }

    this.motionPermissionButton = button;
    prompt.removeAttribute('hidden');
    button.addEventListener('click', this.requestMotionPermission);
    skip.addEventListener('click', this.dismissMotionPermission);
  }

  private readonly requestMotionPermission = async (): Promise<void> => {
    const prompt = document.querySelector<HTMLElement>('#motion-permission');
    const message = document.querySelector<HTMLElement>('#motion-permission-message');
    const result = await this.motionInput?.enable() ?? 'unsupported';
    if (result === 'enabled') {
      this.motionEnabled = true;
      this.tapHint.setVisible(false);
      prompt?.setAttribute('hidden', '');
      return;
    }
    if (message) {
      message.textContent = result === 'denied'
        ? 'Motion access was denied. On iPhone, check Settings › Safari › Motion & Orientation Access, then reload this page.'
        : 'Motion is unavailable on this device. You can still tap anywhere to jump.';
    }
    if (this.motionPermissionButton) this.motionPermissionButton.textContent = 'Try again';
  };

  private readonly dismissMotionPermission = (): void => {
    document.querySelector('#motion-permission')?.setAttribute('hidden', '');
  };

  private celebrateJumpMilestone(): void {
    const messages: Record<number, string> = {
      5: 'Great jumping!',
      10: 'Ten brilliant jumps!',
      15: 'Keep bouncing!',
      20: 'Halfway — amazing!',
      25: 'Jump Party superstar!',
      30: 'Ten jumps to go!',
      35: 'Nearly there!',
      40: 'Forty fantastic jumps!'
    };
    const message = messages[this.jumps];
    if (!message) return;
    this.cheerText.setText(message).setAlpha(1).setScale(0.75);
    this.tweens.killTweensOf(this.cheerText);
    this.tweens.add({
      targets: this.cheerText,
      scale: 1.18,
      duration: 260,
      ease: 'Back.Out',
      yoyo: true,
      hold: 650,
      onComplete: () => this.tweens.add({ targets: this.cheerText, alpha: 0, duration: 450 })
    });
    this.sparkles(this.player.x, this.player.y - 120);
  }

  private counterStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'ui-rounded, system-ui', fontSize: '22px', color: '#31245f', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 };
  }

  private resize(gameSize: Phaser.Structs.Size): void {
    const zoom = gameSize.height / BASE_HEIGHT;
    const visibleWidth = gameSize.width / zoom;
    this.visibleWorldWidth = visibleWidth;
    this.playableWidth = Phaser.Math.Clamp(visibleWidth, 1280, 2160);
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height).setOrigin(0, 0).setZoom(zoom).setScroll(0, 0);

    const centerX = visibleWidth / 2;
    this.jumpLabel?.setX(centerX - 175);
    this.jumpText?.setX(centerX - 242);
    this.balloonLabel?.setX(centerX + 175);
    this.balloonText?.setX(centerX + 115);
    this.powerText?.setX(centerX);
    this.cheerText?.setX(centerX);
    this.tapHint?.setX(centerX);
    this.gamesButton?.setX(visibleWidth - 110);
    this.leftZone?.setPosition(0, BASE_HEIGHT / 2).setSize(visibleWidth / 3, BASE_HEIGHT / 2);
    this.rightZone?.setPosition(visibleWidth * 2 / 3, BASE_HEIGHT / 2).setSize(visibleWidth / 3, BASE_HEIGHT / 2);

    this.balloons.forEach((balloon) => {
      const config = balloon.getData('config') as PartyObject;
      this.tweens.killTweensOf(balloon);
      balloon.setPosition(this.getBalloonAnchorX(config.x), config.y).setAngle(0);
      this.startBalloonDrift(balloon, config);
    });
  }

  private updateCamera(dt: number): void {
    const maxScroll = Math.max(0, this.playableWidth - this.visibleWorldWidth);
    const target = Phaser.Math.Clamp(this.player.x - this.visibleWorldWidth / 2, 0, maxScroll);
    this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, target, Math.min(1, dt * 6));
  }

  private resetState(): void {
    this.velocityY = 0; this.onGround = true; this.leftDown = false; this.rightDown = false; this.completed = false;
    this.jumps = 0; this.balloonsPopped = 0; this.bagsCollected = 0; this.poweredJumps = 0; this.motionEnabled = false;
    this.balloons = []; this.collectibles = []; this.puddles = [];
  }

  private shutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this);
    this.input.keyboard?.off('keydown-SPACE', this.tryJump, this);
    this.input.keyboard?.off('keydown-W', this.tryJump, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleScreenTap, this);
    this.motionInput?.destroy();
    this.motionPermissionButton?.removeEventListener('click', this.requestMotionPermission);
    document.querySelector<HTMLButtonElement>('#skip-motion')?.removeEventListener('click', this.dismissMotionPermission);
    document.querySelector('#motion-permission')?.setAttribute('hidden', '');
  }
}
