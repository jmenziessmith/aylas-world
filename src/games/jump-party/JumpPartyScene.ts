import Phaser from 'phaser';
import { BALLOON_TARGET, JUMP_TARGET, jumpPartyLevel, type PartyObject } from './level';
import { MotionJumpInput } from './MotionJumpInput';

const BASE_HEIGHT = 720;
const ASSETS = `${import.meta.env.BASE_URL}assets/jump-party`;
const NORMAL_JUMP_SPEED = 820;
const POWERED_JUMP_SPEED = 1080;
const GRAVITY = 2600;
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
  private powerText!: Phaser.GameObjects.Text;
  private cheerText!: Phaser.GameObjects.Text;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private balloons: Phaser.GameObjects.Image[] = [];
  private collectibles: Array<{ config: PartyObject; sprite: Phaser.GameObjects.Image }> = [];
  private puddles: Array<{ config: PartyObject; sprite: Phaser.GameObjects.Image; ready: boolean }> = [];
  private motionInput?: MotionJumpInput;

  constructor() { super('jump-party'); }

  preload(): void {
    const images = ['background', 'hud-jumps', 'hud-balloons', 'ayla-idle', 'ayla-jump', 'ayla-powered',
      'balloon-pink', 'balloon-yellow', 'balloon-teal', 'balloon-purple', 'balloon-pop', 'cake',
      'party-bag', 'puddle', 'splash', 'power-jump'];
    images.forEach((key) => this.load.image(key, `${ASSETS}/${key}.png`));
  }

  create(): void {
    this.resetState();
    this.cameras.main.setBackgroundColor('#76cef5').setBounds(0, 0, jumpPartyLevel.worldWidth, BASE_HEIGHT);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.resize(this.scale.gameSize);
  }

  update(_time: number, deltaMs: number): void {
    if (this.completed) return;
    const dt = Math.min(deltaMs / 1000, 0.035);
    const keyboardLeft = this.cursors?.left.isDown ?? false;
    const keyboardRight = this.cursors?.right.isDown ?? false;
    const direction = (this.rightDown || keyboardRight ? 1 : 0) - (this.leftDown || keyboardLeft ? 1 : 0);
    this.player.x = Phaser.Math.Clamp(this.player.x + direction * MOVE_SPEED * dt, 95, jumpPartyLevel.worldWidth - 95);
    if (direction !== 0) this.ayla.setFlipX(direction < 0);

    if (!this.onGround) {
      this.velocityY += GRAVITY * dt;
      this.player.y += this.velocityY * dt;
      this.player.angle = direction * 3;
      if (this.player.y >= jumpPartyLevel.groundY) this.land();
    }
    this.checkInteractions();
  }

  private createScenery(): void {
    const source = this.textures.get('background').getSourceImage() as HTMLImageElement;
    const scale = BASE_HEIGHT / source.height;
    this.add.image(640, BASE_HEIGHT / 2, 'background').setScale(scale).setDepth(-20);
  }

  private createObjects(): void {
    jumpPartyLevel.objects.forEach((config) => {
      if (config.type === 'balloon') {
        const balloon = this.add.image(config.x, config.y, `balloon-${config.colour}`).setScale(0.115).setDepth(8);
        balloon.setData('id', config.id);
        this.balloons.push(balloon);
        this.tweens.add({ targets: balloon, y: config.y - (config.bobHeight ?? 15), angle: Phaser.Math.Between(-2, 2), duration: config.bobDuration ?? 1700, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: Phaser.Math.Between(0, 600) });
      } else if (config.type === 'puddle') {
        const sprite = this.add.image(config.x, config.y, 'puddle').setScale(0.28).setDepth(2);
        this.puddles.push({ config, sprite, ready: true });
      } else {
        const sprite = this.add.image(config.x, config.y, config.type).setScale(config.type === 'cake' ? 0.105 : 0.11).setDepth(7);
        this.collectibles.push({ config, sprite });
        this.tweens.add({ targets: sprite, y: config.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    });
  }

  private createPlayer(): void {
    const shadow = this.add.ellipse(0, 2, 92, 24, 0x234c50, 0.25);
    this.ayla = this.add.image(0, 0, 'ayla-idle').setOrigin(0.5, 0.92).setScale(0.135);
    this.player = this.add.container(jumpPartyLevel.startX, jumpPartyLevel.groundY, [shadow, this.ayla]).setDepth(20);
    this.startIdle();
  }

  private createHud(): void {
    this.add.rectangle(190, 57, 340, 82, 0xffffff, 0.9).setStrokeStyle(4, 0x70ccea).setScrollFactor(0).setDepth(99);
    this.add.rectangle(1085, 57, 350, 82, 0xffffff, 0.9).setStrokeStyle(4, 0xf18ab4).setScrollFactor(0).setDepth(99);
    this.add.image(28, 25, 'hud-jumps').setOrigin(0).setDisplaySize(185, 62).setScrollFactor(0).setDepth(100);
    this.jumpText = this.add.text(220, 56, `0 / ${JUMP_TARGET}`, this.counterStyle()).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.add.image(915, 25, 'hud-balloons').setOrigin(0).setDisplaySize(205, 62).setScrollFactor(0).setDepth(100);
    this.balloonText = this.add.text(1125, 56, `0 / ${BALLOON_TARGET}`, this.counterStyle()).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.powerText = this.add.text(640, 112, '', { fontFamily: 'ui-rounded, system-ui', fontSize: '28px', color: '#7b287d', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.cheerText = this.add.text(640, 158, 'Let’s jump!', { fontFamily: 'ui-rounded, system-ui', fontSize: '30px', color: '#7b287d', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 7 }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.tweens.add({ targets: this.cheerText, scale: 1.08, duration: 650, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
  }

  private createControls(): void {
    this.makeHoldButton(92, 610, '◀', (down) => { this.leftDown = down; });
    this.makeHoldButton(1188, 610, '▶', (down) => { this.rightDown = down; });
    this.add.text(640, 665, 'TAP ANYWHERE TO JUMP', { fontFamily: 'ui-rounded, system-ui', fontSize: '22px', color: '#493453', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(109);

    const motion = this.add.text(640, 62, '📱 Enable motion jump', { fontFamily: 'ui-rounded, system-ui', fontSize: '21px', color: '#24495b', backgroundColor: '#ffffffdd', padding: { x: 15, y: 9 } }).setOrigin(0.5).setScrollFactor(0).setDepth(110).setInteractive({ cursor: 'pointer' });
    motion.on('pointerdown', async () => {
      const result = await this.motionInput?.enable() ?? 'unsupported';
      const status = result === 'enabled' ? '✓ Motion jump on'
        : result === 'insecure' ? '🔒 Motion needs HTTPS'
          : result === 'denied' ? 'Motion denied — tap to jump'
            : 'Motion unavailable — tap to jump';
      motion.setText(status);
      motion.disableInteractive();
    });
  }

  private handleScreenTap(_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    if (currentlyOver.length === 0) this.tryJump();
  }

  private makeHoldButton(x: number, y: number, label: string, set: (down: boolean) => void): void {
    const button = this.add.circle(x, y, 61, 0xffffff, 0.86).setStrokeStyle(6, 0x4fb7d6).setScrollFactor(0).setDepth(110).setInteractive({ cursor: 'pointer' });
    this.add.text(x, y, label, { fontFamily: 'system-ui', fontSize: '49px', color: '#23667d', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(111);
    button.on('pointerdown', () => { set(true); button.setScale(0.92); });
    ['pointerup', 'pointerout'].forEach((event) => button.on(event, () => { set(false); button.setScale(1); }));
  }

  private tryJump(): void {
    if (!this.onGround || this.completed) return;
    this.onGround = false;
    const powered = this.poweredJumps > 0;
    if (powered) this.poweredJumps -= 1;
    this.velocityY = powered ? -POWERED_JUMP_SPEED : -NORMAL_JUMP_SPEED;
    this.jumps += 1;
    this.ayla.setTexture(powered ? 'ayla-powered' : 'ayla-jump').setScale(powered ? 0.15 : 0.14);
    this.jumpText.setText(`${this.jumps} / ${JUMP_TARGET}`);
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
    this.tweens.killTweensOf(balloon);
    const effect = this.add.image(balloon.x, balloon.y, 'balloon-pop').setScale(0.02).setDepth(30);
    this.tweens.add({ targets: effect, scale: 0.16, alpha: 0, angle: 20, duration: 420, onComplete: () => effect.destroy() });
    balloon.destroy();
    this.balloonsPopped += 1;
    this.balloonText.setText(`${this.balloonsPopped} / ${BALLOON_TARGET}`);
    this.checkCompletion();
  }

  private collect(config: PartyObject, sprite: Phaser.GameObjects.Image): void {
    this.tweens.killTweensOf(sprite);
    this.tweens.add({ targets: sprite, y: sprite.y - 90, scale: sprite.scale * 1.35, alpha: 0, angle: 15, duration: 420, ease: 'Back.In', onComplete: () => sprite.destroy() });
    this.sparkles(sprite.x, sprite.y);
    if (config.type === 'cake') {
      this.poweredJumps = 2;
      this.updatePowerText();
    } else {
      this.bagsCollected += 1;
    }
  }

  private splash(puddle: { config: PartyObject; sprite: Phaser.GameObjects.Image; ready: boolean }): void {
    puddle.ready = false;
    const splash = this.add.image(puddle.config.x, jumpPartyLevel.groundY - 35, 'splash').setScale(0.05).setDepth(25);
    this.tweens.add({ targets: splash, scaleX: 0.25, scaleY: 0.22, alpha: { from: 1, to: 0 }, y: splash.y - 45, duration: 600, ease: 'Quad.Out', onComplete: () => splash.destroy() });
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
    return { fontFamily: 'ui-rounded, system-ui', fontSize: '31px', color: '#243d69', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 };
  }

  private resize(gameSize: Phaser.Structs.Size): void {
    const zoom = gameSize.height / BASE_HEIGHT;
    const visibleWidth = gameSize.width / zoom;
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height).setZoom(zoom).centerOn(640, BASE_HEIGHT / 2);
    if (visibleWidth < 1280) this.cameras.main.setZoom(gameSize.width / 1280);
  }

  private resetState(): void {
    this.velocityY = 0; this.onGround = true; this.leftDown = false; this.rightDown = false; this.completed = false;
    this.jumps = 0; this.balloonsPopped = 0; this.bagsCollected = 0; this.poweredJumps = 0;
    this.balloons = []; this.collectibles = []; this.puddles = [];
  }

  private shutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this);
    this.input.keyboard?.off('keydown-SPACE', this.tryJump, this);
    this.input.keyboard?.off('keydown-W', this.tryJump, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleScreenTap, this);
    this.motionInput?.destroy();
  }
}
