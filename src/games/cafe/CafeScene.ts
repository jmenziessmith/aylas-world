import Phaser from 'phaser';
import { CAFE_ASSETS } from './assets';
import { CAFE_ITEMS, CAFE_ORDERS, createRound, addItem, validateLoadedOrder, markSpilled, markServed, beginRecovery, removeLoadedItem, type CafeRound, type CafeItemId } from './model';
import { createTrayBody, stepTrayPhysics, type TrayBody } from './physics';
import { CafeMotionInput } from './sensors';
import { CAFE_TUNING } from './tuning';
import { CAFE_LAYOUT, progressPosition, servingPositions } from './layout';

type Stage = 'INTRO' | 'SELECTING_ITEMS' | 'READY_TO_CARRY' | 'MOTION_PERMISSION' | 'CALIBRATING_TRAY' | 'CARRYING' | 'ARRIVING' | 'SERVING' | 'ROUND_COMPLETE';
type Art = Phaser.GameObjects.Container;
interface Drag { view: Art; itemId: CafeItemId; instanceId?: string; fromX: number; fromY: number; pointerId: number }
const W = CAFE_LAYOUT.width; const H = CAFE_LAYOUT.height;
const PREP_TRAY = CAFE_LAYOUT.prepTray;
const CARRY_TRAY = CAFE_LAYOUT.carryTray;
const SERVE_TRAY = CAFE_LAYOUT.serveTray;

export class CafeScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private stage: Stage = 'INTRO';
  private round: CafeRound = createRound();
  private roundIndex = 0;
  private motion!: CafeMotionInput;
  private fallback = true;
  private bodies: TrayBody[] = [];
  private bodyViews = new Map<string, Art>();
  private positions = new Map<string, { x: number; y: number }>();
  private drag?: Drag;
  private carryGroup?: Phaser.GameObjects.Container;
  private carryBackground?: Phaser.GameObjects.Image;
  private walker?: Art;
  private steps = 0;
  private lastStep = -1000;
  private lastDetectedStep = -1000;
  private autoWalkActive = false;
  private nextFoot = 0;
  private stepDots: Art[] = [];
  private footButtons: Phaser.GameObjects.Container[] = [];
  private instruction?: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Container;
  private calibrationStarted = false;
  private calibrationUntil = 0;
  private sourceViews = new Map<CafeItemId, Art>();
  private targets: { itemId: CafeItemId; x: number; y: number; served: boolean; view: Art }[] = [];
  private keyboard?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private swipeTilt = { x: 0, y: 0 };
  private touchTrayPointer?: number;
  private audio?: AudioContext;
  private muted = false;
  private alive = true;
  private motionGranted = false;
  private carryOnboardingComplete = false;
  private showCarryInstruction = false;
  private customerStartIndex = 0;
  private sensorNote = '';
  private tiltWarning?: Phaser.GameObjects.Rectangle;
  private debug?: Phaser.GameObjects.Text;

  constructor() { super('aylas-cafe'); }

  preload(): void {
    const needed = new Set(['counter-bg', 'carry-bg', 'serve-bg', 'ayla-welcome', 'ayla-carry', 'ayla-cheer', 'customer-bunny', 'customer-elephant', 'customer-monster', 'customer-bunny-happy', 'customer-elephant-happy', 'customer-monster-happy', 'tray', 'table', 'hand-left', 'hand-right', 'instruction', 'footprint', 'target-cookie', 'target-drink', 'target-cupcake', 'counter-tray', 'storage-box-heart', 'storage-box-flower', 'order-paper', 'speech-bubble-pink', 'status-empty', 'status-complete', 'step-progress-empty', ...Object.keys(CAFE_ITEMS).map(id => `item-${id}`)]);
    for (const [key, path] of Object.entries(CAFE_ASSETS)) if (needed.has(key)) this.load.image(`cafe-${key}`, `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`);
    for (const key of ['home-button', 'audio-button']) this.load.image(`cafe-${key}`, `${import.meta.env.BASE_URL}assets/mermaid/sprites/${key}.png`);
  }

  create(): void {
    document.querySelector('#game-loader')?.setAttribute('hidden', '');
    this.root = this.add.container(0, 0);
    this.motion = new CafeMotionInput({ onStep: () => {
      if (!this.fallback) {
        this.lastDetectedStep = this.time.now;
        this.acceptStep();
      }
    } });
    this.customerStartIndex = Phaser.Math.Between(0, 2);
    try {
      const previouslyEnabled = localStorage.getItem('aylas-cafe-motion-enabled') === '1';
      this.motionGranted = previouslyEnabled && !this.motion.requiresGesturePermission;
    } catch { /* Motion can still be enabled from its button. */ }
    if (this.motionGranted) this.motion.enablePreviouslyGranted();
    this.keyboard = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
      event.preventDefault(); if (!event.repeat && this.fallback) this.acceptStep();
    });
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', this.pointerUp, this);
    this.scale.on('resize', this.resize, this);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    this.events.once('shutdown', () => {
      this.alive = false; this.motion.destroy(); this.scale.off('resize', this.resize, this);
      document.removeEventListener('visibilitychange', this.onVisibility); window.removeEventListener('blur', this.onBlur);
      window.speechSynthesis?.cancel(); void this.audio?.close();
    });
    this.render(); this.resize();
  }

  private resize(): void {
    const { width, height } = this.scale.gameSize;
    const scale = Math.min((width - 24) / W, (height - 12) / H);
    this.root.setPosition((width - W * scale) / 2, (height - H * scale) / 2).setScale(scale);
    this.cancelDrag();
    if (this.stage === 'CARRYING' && !this.fallback) this.showCalibration();
  }

  private readonly onVisibility = (): void => {
    this.cancelDrag(); this.swipeTilt = { x: 0, y: 0 };
    if (document.hidden) window.speechSynthesis?.cancel();
    else if (this.stage === 'CARRYING') this.showCalibration();
  };
  private readonly onBlur = (): void => { this.cancelDrag(); this.swipeTilt = { x: 0, y: 0 }; };

  private text(x: number, y: number, value: string, size = 24, color = '#684268'): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, value, { fontFamily: 'Arial, sans-serif', fontSize: size, color, fontStyle: 'bold', align: 'center' }).setOrigin(.5);
    this.root.add(text); return text;
  }

  private panel(x: number, y: number, width: number, height: number, color = 0xfff9ea, alpha = .96): Phaser.GameObjects.Graphics {
    const g = this.add.graphics(); g.fillStyle(0x6d4269, .13).fillRoundedRect(x - width / 2, y - height / 2 + 6, width, height, 25);
    g.fillStyle(color, alpha).fillRoundedRect(x - width / 2, y - height / 2, width, height, 25);
    g.lineStyle(4, 0xffffff, .95).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 25);
    this.root.add(g); return g;
  }

  /** Missing artwork stays an obvious solid block, never a substituted character. */
  private art(key: string, x: number, y: number, width: number, height = width, label = key, parent = this.root): Art {
    const view = this.add.container(x, y).setSize(width, height).setName(key);
    if (this.textures.exists(`cafe-${key}`)) {
      const image = this.add.image(0, 0, `cafe-${key}`);
      image.setScale(Math.min(width / image.width, height / image.height)); view.add(image);
    } else {
      view.add(this.add.rectangle(0, 0, width * .85, height * .85, 0xcaa1da).setStrokeStyle(3, 0xffffff));
      view.add(this.add.text(0, 0, label, { fontFamily: 'Arial', fontSize: Math.min(20, height / 4), color: '#493351', align: 'center', wordWrap: { width: width * .8 } }).setOrigin(.5));
    }
    parent.add(view); return view;
  }

  private button(x: number, y: number, label: string, action: () => void, width = 195, color = 0xace1bf): Phaser.GameObjects.Container {
    // Extra invisible height keeps controls easy to hit on short phone screens.
    const view = this.add.container(x, y).setSize(width, 80);
    view.add(this.add.rectangle(0, 5, width, 66, 0x6b497a, .24));
    view.add(this.add.rectangle(0, 0, width, 66, color).setStrokeStyle(4, 0xffffff));
    view.add(this.add.text(0, 0, label, { fontFamily: 'Arial', fontSize: 25, fontStyle: 'bold', color: '#4f3e61', align: 'center' }).setOrigin(.5));
    view.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.unlockAudio(); action(); });
    this.root.add(view); return view;
  }

  private navigation(): void {
    const home = this.art('home-button', 48, 48, 80).setInteractive({ useHandCursor: true });
    home.on('pointerdown', () => { window.location.href = import.meta.env.BASE_URL; });
    const sound = this.art('audio-button', 952, 48, 80).setAlpha(this.muted ? .5 : 1).setInteractive({ useHandCursor: true });
    sound.on('pointerdown', () => {
      this.muted = !this.muted; sound.setAlpha(this.muted ? .5 : 1);
      if (this.muted) window.speechSynthesis?.cancel();
      else { this.unlockAudio(); this.speak(this.instruction?.text || 'Welcome to Ayla’s Café!'); }
    });
  }

  private orderPaper(x: number, y: number, serving = false): void {
    this.art('order-paper', x, y, 286, 300);
    this.text(x, y - 68, 'Their order', 23, '#76533d');
    this.round.order.lines.forEach((line, i) => {
      const rowY = y - 8 + i * 78;
      this.art(this.itemKey(line.itemId), x - 25, rowY, 64);
      const placed = this.round.items.filter(item => item.itemId === line.itemId && (serving ? item.status === 'served' : item.status === 'loaded')).length;
      this.text(x + 44, rowY, `${placed}/${line.count}`, 25, placed === line.count ? '#477d56' : '#76533d');
    });
  }

  /** Reuses the exact background pixels in front of Ayla to put her behind the counter. */
  private counterForeground(): void {
    if (!this.textures.exists('cafe-counter-bg')) return;
    const image = this.add.image(0, 0, 'cafe-counter-bg').setOrigin(0, 0);
    image.setScale(Math.max(W / image.width, H / image.height));
    image.setCrop(0, 488, image.width, image.height - 488); this.root.add(image);
  }

  private boxFront(key: string, x: number, y: number, width: number, height: number): void {
    if (!this.textures.exists(`cafe-${key}`)) return;
    const image = this.add.image(x, y, `cafe-${key}`);
    image.setScale(Math.min(width / image.width, height / image.height));
    image.setCrop(0, image.height * .57, image.width, image.height * .43); this.root.add(image);
  }

  private render(): void {
    this.cancelDrag(); this.tweens.killAll(); this.root.removeAll(true);
    this.bodyViews.clear(); this.sourceViews.clear(); this.targets = []; this.stepDots = []; this.footButtons = [];
    this.carryGroup = undefined; this.carryBackground = undefined; this.walker = undefined; this.tiltWarning = undefined; this.hint = undefined; this.debug = undefined;
    const servingScene = this.stage === 'SERVING' || this.stage === 'ROUND_COMPLETE';
    const background = servingScene ? 'serve-bg' : ['CARRYING', 'CALIBRATING_TRAY', 'ARRIVING'].includes(this.stage) ? 'carry-bg' : 'counter-bg';
    // One wide background is decorative; the independently rendered tray/food remain interactive.
    this.cameras.main.setBackgroundColor('#efc9a3');
    if (this.textures.exists(`cafe-${background}`)) {
      // Every café scene uses the same left edge, so its landmarks never jump between modes.
      const bg = this.add.image(0, 0, `cafe-${background}`).setOrigin(0, 0);
      bg.setScale(Math.max(W / bg.width, H / bg.height)); this.root.add(bg);
      if (background === 'carry-bg') this.carryBackground = bg;
    }
    this.instruction = undefined;
    if (['INTRO', 'MOTION_PERMISSION', 'CALIBRATING_TRAY'].includes(this.stage)) {
      this.panel(500, 40, 680, 62, 0xfff7e7); this.text(500, 38, 'Ayla’s Café', 33);
      this.instruction = this.text(500, 91, '', 22);
    }
    switch (this.stage) {
      case 'INTRO': this.renderIntro(); break;
      case 'SELECTING_ITEMS': case 'READY_TO_CARRY': this.renderSelection(); break;
      case 'MOTION_PERMISSION': this.renderPermission(); break;
      case 'CALIBRATING_TRAY': this.renderCalibration(); break;
      case 'CARRYING': case 'ARRIVING': this.renderCarry(); break;
      case 'SERVING': this.renderServing(); break;
      case 'ROUND_COMPLETE': this.renderComplete(); break;
    }
    this.navigation();
  }

  private renderIntro(): void {
    this.panel(500, 327, 850, 430);
    this.art('ayla-welcome', 228, 324, 220, 300, 'Ayla');
    this.text(625, 159, 'A little café adventure', 29);
    ['cookie', 'juice', 'cupcake'].forEach((key, i) => this.art(`item-${key}`, 500 + i * 126, 247, 90));
    this.text(625, 333, 'Choose it  →  Carry it  →  Serve it', 24);
    this.text(625, 378, 'No hurry. Let’s help a hungry friend!', 20);
    this.button(625, 461, 'Let’s play!', () => { this.stage = 'SELECTING_ITEMS'; this.render(); this.speak('Make the order. Put it on the tray!'); }, 245);
  }

  private itemKey(item: CafeItemId): string { return `item-${item}`; }
  private customerKey(): string { return ['customer-bunny', 'customer-elephant', 'customer-monster'][(this.customerStartIndex + this.roundIndex) % 3]; }
  private loaded() { return this.round.items.filter(item => item.status === 'loaded'); }

  private renderSelection(): void {
    this.art('ayla-welcome', 500, 301, 334, 386, 'Ayla');
    this.counterForeground();
    this.orderPaper(855, 229);
    const ids = Object.keys(CAFE_ITEMS) as CafeItemId[];
    ids.forEach((id, i) => {
      const x = CAFE_LAYOUT.sourceCenters[i]; const boxKey = i % 2 ? 'storage-box-flower' : 'storage-box-heart';
      const boxY = CAFE_LAYOUT.sourceBoxY;
      this.art(boxKey, x, boxY, 162, 112);
      this.art(this.itemKey(id), x - 32, boxY - 34, 58).setAngle(-12);
      this.art(this.itemKey(id), x + 33, boxY - 32, 58).setAngle(10);
      const view = this.art(this.itemKey(id), x, CAFE_LAYOUT.sourceY, 88, 88, CAFE_ITEMS[id].label).setSize(150, 126);
      this.sourceViews.set(id, view); this.makeDraggable(view, id);
      this.boxFront(boxKey, x, boxY, 162, 112);
    });
    this.drawTray(PREP_TRAY, 'counter-tray');
    this.loaded().forEach((item, i) => {
      const pos = this.positions.get(item.id) ?? { x: PREP_TRAY.x + (i - (this.loaded().length - 1) / 2) * 80, y: PREP_TRAY.y };
      this.positions.set(item.id, pos);
      const view = this.art(this.itemKey(item.itemId), pos.x, pos.y, 82);
      this.makeDraggable(view, item.itemId, item.id);
    });
    this.selectionHint();
  }

  private drawTray(rect: { x: number; y: number; w: number; h: number }, key = 'tray'): void {
    this.art(key, rect.x, rect.y, rect.w + 40, rect.h + 40, 'TRAY');
  }

  private selectionHint(): void {
    if (this.roundIndex > 0 || this.loaded().length > 0) return;
    const id = this.round.order.lines[0].itemId; const source = this.sourceViews.get(id); if (!source) return;
    this.hint = this.art(this.itemKey(id), source.x, source.y, 75); this.hint.setAlpha(.35);
    this.tweens.add({ targets: this.hint, x: PREP_TRAY.x, y: PREP_TRAY.y, duration: 1500, delay: 900, repeat: -1, repeatDelay: 1500, ease: 'Sine.InOut' });
  }

  private makeDraggable(view: Art, itemId: CafeItemId, instanceId?: string): void {
    view.setInteractive({ useHandCursor: true });
    view.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.drag) return;
      this.unlockAudio(); this.hint?.destroy(); this.hint = undefined;
      const dragged = instanceId ? view : this.art(this.itemKey(itemId), view.x, view.y, 92);
      this.root.bringToTop(dragged); dragged.setScale(1.08);
      this.drag = { view: dragged, itemId, instanceId, fromX: view.x, fromY: view.y, pointerId: pointer.id };
    });
  }

  private local(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: (pointer.x - this.root.x) / this.root.scaleX, y: (pointer.y - this.root.y) / this.root.scaleY };
  }
  private pointerMove(pointer: Phaser.Input.Pointer): void {
    const p = this.local(pointer);
    if (this.drag?.pointerId === pointer.id) this.drag.view.setPosition(p.x, p.y);
    if (this.touchTrayPointer === pointer.id && this.fallback) this.swipeTilt = { x: Phaser.Math.Clamp((p.x - CARRY_TRAY.x) / 220, -1, 1), y: Phaser.Math.Clamp((p.y - CARRY_TRAY.y) / 120, -1, 1) };
  }
  private pointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.touchTrayPointer === pointer.id) { this.touchTrayPointer = undefined; this.swipeTilt = { x: 0, y: 0 }; }
    const drag = this.drag; if (!drag || drag.pointerId !== pointer.id) return;
    this.drag = undefined; const p = this.local(pointer); drag.view.setScale(1);
    if (this.stage === 'SELECTING_ITEMS' || this.stage === 'READY_TO_CARRY') {
      const over = Math.abs(p.x - PREP_TRAY.x) < PREP_TRAY.w / 2 + 25 && Math.abs(p.y - PREP_TRAY.y) < PREP_TRAY.h / 2 + 30;
      const requested = this.round.order.lines.find(line => line.itemId === drag.itemId)?.count ?? 0;
      const already = this.round.items.filter(item => item.itemId === drag.itemId && item.status !== 'spilled').length;
      if (over && (drag.instanceId || already < requested)) {
        const item = drag.instanceId ? this.round.items.find(item => item.id === drag.instanceId) : addItem(this.round, drag.itemId);
        if (item) {
          const desired = { x: Phaser.Math.Clamp(p.x, PREP_TRAY.x - 80, PREP_TRAY.x + 80), y: Phaser.Math.Clamp(p.y, PREP_TRAY.y - 40, PREP_TRAY.y + 40) };
          // A broad drop zone is forgiving; a free slot prevents treats hiding each other.
          const occupied = [...this.positions.entries()].filter(([id]) => id !== item.id).map(([, pos]) => pos);
          const candidates = [desired, ...[-80, 0, 80].map(offset => ({ x: PREP_TRAY.x + offset, y: PREP_TRAY.y }))];
          this.positions.set(item.id, candidates.find(pos => occupied.every(other => Math.hypot(pos.x - other.x, pos.y - other.y) >= 72)) ?? desired);
        }
        this.chime();
        if (validateLoadedOrder(this.round)) this.beginCarryFromOrder();
        else { this.stage = 'SELECTING_ITEMS'; this.render(); }
        return;
      }
      this.instruction?.setText('Look at your friend’s pictures');
    } else if (this.stage === 'SERVING' && drag.instanceId) {
      const target = this.targets.find(t => !t.served && t.itemId === drag.itemId && Math.hypot(t.x - p.x, t.y - p.y) < CAFE_LAYOUT.serveTargetRadius);
      if (target && markServed(this.round, drag.instanceId, target.itemId)) {
        this.chime(660); this.render(); this.checkServed(); return;
      }
      const correct = this.targets.find(t => !t.served && t.itemId === drag.itemId);
      if (correct) this.tweens.add({ targets: correct.view, alpha: .35, duration: 220, yoyo: true, repeat: 2 });
      this.instruction?.setText('Match the little picture');
    }
    this.tweens.add({ targets: drag.view, x: drag.fromX, y: drag.fromY, duration: 260, ease: 'Back.Out', onComplete: () => { if (!drag.instanceId) drag.view.destroy(); } });
  }

  private cancelDrag(): void {
    if (this.drag) { if (this.drag.instanceId) this.drag.view.setPosition(this.drag.fromX, this.drag.fromY).setScale(1); else this.drag.view.destroy(); this.drag = undefined; }
    this.touchTrayPointer = undefined;
  }

  private renderPermission(): void {
    this.panel(500, 333, 810, 450);
    this.art('instruction', 275, 314, 285, 250, 'Hold phone flat');
    this.text(665, 178, 'Your phone is the tray!', 29);
    this.text(665, 246, 'Hold it flat.\nWalk 10 careful steps.', 27);
    this.button(665, 346, this.motion.requiresGesturePermission ? 'Turn phone motion on' : 'Use phone motion', () => { void this.enableMotion(); }, 288);
    this.button(665, 433, 'Play with buttons', () => { this.fallback = true; this.sensorNote = ''; this.showCalibration(); }, 288, 0xf6d4e5);
    this.text(500, 518, 'Desktop: drag with the mouse · arrows / WASD to tilt · Space to step', 18);
  }

  private async enableMotion(): Promise<void> {
    // Called directly from pointerdown: permission requests remain inside the iOS gesture.
    const result = await this.motion.enable();
    if (!this.alive || this.stage !== 'MOTION_PERMISSION') return;
    this.motionGranted = result === 'enabled';
    if (this.motionGranted) {
      try { localStorage.setItem('aylas-cafe-motion-enabled', '1'); } catch { /* Keep this round enabled when storage is restricted. */ }
    } else {
      try { localStorage.removeItem('aylas-cafe-motion-enabled'); } catch { /* The on-screen fallback remains available. */ }
    }
    this.fallback = !this.motionGranted;
    this.sensorNote = this.fallback ? 'Motion unavailable — buttons work too!' : '';
    this.showCalibration();
  }

  private beginCarryFromOrder(): void {
    if (this.carryOnboardingComplete) {
      this.fallback = !this.motionGranted;
      this.startCarry();
      return;
    }
    if (this.motionGranted) {
      this.fallback = false;
      this.showCalibration();
      return;
    }
    this.stage = 'MOTION_PERMISSION';
    this.render();
    this.speak('Hold your phone like a tray.');
  }

  private showCalibration(): void {
    this.stage = 'CALIBRATING_TRAY'; this.calibrationStarted = false; this.render();
  }
  private renderCalibration(): void {
    this.panel(500, 331, 780, 445);
    this.art('instruction', 314, 311, 310, 275, 'Hold phone flat');
    this.text(681, 183, 'Hold it like a tray', 29);
    this.text(681, 257, this.fallback ? 'Arrows tilt the tray.\nSpace takes a step.\nOr use the touch controls.' : 'Hold still for a moment.\nThis is your level tray.', 23);
    this.text(500, 502, this.sensorNote || 'You can level your tray again whenever you need.', 20);
    this.button(677, 392, 'Ready ✓', () => {
      if (this.calibrationStarted) return;
      this.calibrationStarted = true; this.calibrationUntil = this.time.now + 950;
      this.motion.startCalibration(); this.instruction?.setText('Hold still…');
    }, 236);
    this.button(150, 556, '← Controls', () => { this.stage = 'MOTION_PERMISSION'; this.render(); }, 225, 0xf6d4e5);
  }

  private startCarry(): void {
    if (this.bodies.length === 0) {
      const items = this.loaded(); this.bodies = items.map((item, i) => {
        const pos = this.positions.get(item.id);
        return createTrayBody(item.id, item.itemId, pos ? .5 + (pos.x - PREP_TRAY.x) / PREP_TRAY.w : .5 + (i - (items.length - 1) / 2) * .22, pos ? .5 + (pos.y - PREP_TRAY.y) / PREP_TRAY.h : .5);
      });
    }
    this.showCarryInstruction = !this.carryOnboardingComplete;
    this.carryOnboardingComplete = true;
    this.stage = 'CARRYING'; this.lastStep = this.time.now; this.lastDetectedStep = this.time.now; this.autoWalkActive = false;
    this.render(); this.speak('Walk carefully. Ten steps to your friend!');
  }

  private renderCarry(): void {
    // The journey and progress strip sit directly on the café artwork, without a UI box.
    const journey = CAFE_LAYOUT.walker;
    const journeyProgress = this.steps / this.round.order.steps;
    this.carryBackground?.setX(this.carryBackgroundX(journeyProgress));
    this.art(this.customerKey(), 865, 130, 90, 104, 'Friend');
    this.art('table', 860, 220, 170, 104, 'Table');
    this.walker = this.art('ayla-carry', journey.startX + journeyProgress * (journey.endX - journey.startX), journey.y, 180, 170, 'Ayla');
    const bar = CAFE_LAYOUT.progress;
    this.art('step-progress-empty', bar.x, bar.y, bar.width, bar.height);
    for (let i = 0; i < this.round.order.steps; i++) {
      const position = progressPosition(i, this.round.order.steps);
      this.art('status-empty', position.x, position.y, 39);
      const done = this.art('status-complete', position.x, position.y, 39).setVisible(i < this.steps);
      this.stepDots.push(done);
    }
    if (this.showCarryInstruction) {
      this.art('speech-bubble-pink', 852, 307, 251, 132);
      this.instruction = this.text(852, 299, this.stage === 'ARRIVING' ? 'We’re here!' : this.fallback ? 'Press Space\nto walk!' : 'Walk carefully!', 22, '#74523e').setWordWrapWidth(191);
    }
    this.carryGroup = this.add.container(CARRY_TRAY.x, CARRY_TRAY.y); this.root.add(this.carryGroup);
    this.art('tray', 0, 0, CARRY_TRAY.w + 34, CARRY_TRAY.h + 30, 'TRAY', this.carryGroup);
    this.tiltWarning = this.add.rectangle(0, 0, CARRY_TRAY.w, CARRY_TRAY.h).setStrokeStyle(7, 0xf3b266, 0).setFillStyle(0, 0); this.carryGroup.add(this.tiltWarning);
    this.art('hand-left', -CARRY_TRAY.w / 2 - 22, 52, 84, 160, 'Hand', this.carryGroup);
    this.art('hand-right', CARRY_TRAY.w / 2 + 22, 52, 84, 160, 'Hand', this.carryGroup);
    const touch = this.add.rectangle(0, 0, CARRY_TRAY.w, CARRY_TRAY.h, 0xffffff, .001).setInteractive(); this.carryGroup.add(touch);
    touch.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (this.fallback) { this.touchTrayPointer = pointer.id; this.pointerMove(pointer); } });
    this.bodies.filter(body => !body.spilled).forEach(body => {
      const view = this.art(this.itemKey(body.itemId), (body.x - .5) * CARRY_TRAY.w, (body.y - .5) * CARRY_TRAY.h, 86, 86, body.itemId, this.carryGroup!); this.bodyViews.set(body.instanceId, view);
    });
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) this.debug = this.text(495, 589, '', 14);
  }

  /** Scroll to the far available artwork edge, whatever width cover-scaling produced. */
  private carryBackgroundX(progress: number): number {
    const farEdge = Math.min(0, W - (this.carryBackground?.displayWidth ?? W));
    return Phaser.Math.Linear(0, farEdge, progress);
  }

  private refreshFeet(): void { this.footButtons.forEach((button, i) => button.setAlpha(i === this.nextFoot ? 1 : .5)); }
  private acceptStep(automatic = false): void {
    if (this.stage !== 'CARRYING' || document.hidden || this.time.now - this.lastStep < 300) return;
    if (automatic && !this.autoWalkActive) {
      this.autoWalkActive = true;
      this.instruction?.setText('Holding steady...\nwalking slowly!');
    } else if (!automatic && this.autoWalkActive) {
      this.autoWalkActive = false;
      this.instruction?.setText('Walk carefully!');
    }
    this.lastStep = this.time.now; this.steps++; this.nextFoot = 1 - this.nextFoot; this.refreshFeet();
    this.stepDots.forEach((dot, i) => dot.setVisible(i < this.steps));
    const journey = CAFE_LAYOUT.walker;
    const journeyProgress = this.steps / this.round.order.steps;
    if (this.walker) this.tweens.add({ targets: this.walker, x: journey.startX + journeyProgress * (journey.endX - journey.startX), duration: 280, ease: 'Sine.Out' });
    if (this.carryBackground) this.tweens.add({ targets: this.carryBackground, x: this.carryBackgroundX(journeyProgress), duration: 280, ease: 'Sine.Out' });
    for (const body of this.bodies) if (!body.spilled) { body.vx += (this.steps % 2 ? .012 : -.012); body.vy += .009; }
    if (this.steps % 2 === 0) this.chime(380, .025);
    if (this.steps >= this.round.order.steps) {
      this.stage = 'ARRIVING'; this.instruction?.setText('We’re here!'); this.chime(780);
      this.time.delayedCall(650, () => { this.stage = 'SERVING'; this.render(); this.speak('Serve your friend. Match the pictures!'); this.checkServed(); });
    }
  }

  private renderServing(complete = false): void {
    const customer = CAFE_LAYOUT.customer; const table = CAFE_LAYOUT.table;
    this.art(complete ? `${this.customerKey()}-happy` : this.customerKey(), customer.x, customer.y, customer.width, customer.height, 'Customer');
    this.art('table', table.x, table.y, table.width, table.height, 'TABLE');
    const orderItems = this.round.order.lines.flatMap(line => Array.from({ length: line.count }, () => line.itemId));
    const positions = servingPositions(orderItems.length);
    const assigned = new Set<string>();
    orderItems.forEach((itemId, i) => {
      const { x, y } = positions[i];
      const served = this.round.items.find(item => item.itemId === itemId && item.status === 'served' && !assigned.has(item.id));
      if (served) assigned.add(served.id);
      const target = this.art(`target-${itemId === 'juice' ? 'drink' : itemId}`, x, y, 132, 112);
      target.setAlpha(served ? 1 : .4);
      this.targets.push({ itemId, x, y, served: Boolean(served), view: target });
    });
    this.drawTray(SERVE_TRAY);
    this.loaded().forEach((item, i, items) => {
      const view = this.art(this.itemKey(item.itemId), SERVE_TRAY.x + (i - (items.length - 1) / 2) * 126, SERVE_TRAY.y, 125);
      this.makeDraggable(view, item.itemId, item.id);
    });
    this.orderPaper(856, 224, true);
    if (complete) this.text(218, 535, 'Thank you!', 30, '#72523d');
  }

  private checkServed(): void {
    if (this.loaded().length) return;
    if (this.round.items.some(item => item.status === 'spilled')) {
      this.instruction?.setText('One more little trip!');
      this.button(244, 196, 'Fetch missing →', () => {
        beginRecovery(this.round); this.bodies = []; this.steps = 0; this.nextFoot = 0;
        this.showCalibration(); this.speak('One more little trip. Let’s bring the missing treats!');
      }, 245, 0xffe1a2);
    } else if (this.round.items.length > 0) {
      this.stage = 'ROUND_COMPLETE'; this.render(); this.chime(880); this.speak('Thank you! What a lovely café!');
    }
  }

  private renderComplete(): void {
    this.renderServing(true);
    this.button(250, 196, 'Another friend →', () => {
      this.nextRound();
    }, 290);
    this.time.delayedCall(10_000, () => { if (this.stage === 'ROUND_COMPLETE') this.nextRound(); });
  }

  private nextRound(): void {
    this.roundIndex++; this.round = createRound(CAFE_ORDERS[this.roundIndex % CAFE_ORDERS.length]);
    this.bodies = []; this.positions.clear(); this.steps = 0; this.nextFoot = 0; this.stage = 'SELECTING_ITEMS'; this.render();
  }

  private returnAllDroppedItemsToCounter(): void {
    if (this.stage !== 'CARRYING') return;
    // Start over at the counter only when every treat falls. Partial spills keep
    // the child's successful serving work and use the gentle recovery trip.
    beginRecovery(this.round).forEach(item => removeLoadedItem(this.round, item.id));
    this.bodies = []; this.positions.clear(); this.steps = 0; this.nextFoot = 0;
    this.stage = 'SELECTING_ITEMS';
    this.render();
    this.speak('Oops! Let’s make the order again.');
  }

  update(_time: number, delta: number): void {
    if (!this.motion || document.hidden || this.scale.width < this.scale.height) return;
    this.motion.update();
    if (this.stage === 'CALIBRATING_TRAY' && this.calibrationStarted && this.time.now >= this.calibrationUntil) {
      if (this.fallback || (this.motion.ready && this.motion.hasRecentMotion())) { this.startCarry(); return; }
      if (this.time.now - this.calibrationUntil > 2000) {
        this.fallback = true; this.sensorNote = 'No motion readings — let’s use buttons instead.'; this.showCalibration();
      }
      return;
    }
    if (this.stage !== 'CARRYING') return;
    if (!this.fallback
      && this.time.now - this.lastDetectedStep >= CAFE_TUNING.autoWalk.idleBeforeStartingMs
      && this.time.now - this.lastStep >= CAFE_TUNING.autoWalk.intervalMs) {
      this.acceptStep(true);
    }
    const keyX = (this.keyboard?.right.isDown || this.wasd?.D.isDown ? 1 : 0) - (this.keyboard?.left.isDown || this.wasd?.A.isDown ? 1 : 0);
    const keyY = (this.keyboard?.down.isDown || this.wasd?.S.isDown ? 1 : 0) - (this.keyboard?.up.isDown || this.wasd?.W.isDown ? 1 : 0);
    const tilt = this.fallback ? { x: keyX || this.swipeTilt.x, y: keyY || this.swipeTilt.y } : this.motion.tilt;
    // Browser device axes are opposite to the tray's on-screen local axes.
    const result = stepTrayPhysics(this.bodies, { x: -tilt.x, y: -tilt.y }, delta / 1000);
    this.carryGroup?.setAngle(tilt.x * 4);
    this.tiltWarning?.setStrokeStyle(7, 0xf3b266, Math.max(Math.abs(tilt.x), Math.abs(tilt.y)) > .65 ? .65 : 0);
    this.bodies.forEach(body => {
      if (!body.spilled) this.bodyViews.get(body.instanceId)?.setPosition((body.x - .5) * CARRY_TRAY.w, (body.y - .5) * CARRY_TRAY.h);
    });
    result.spilledIds.forEach(id => {
      markSpilled(this.round, id); const view = this.bodyViews.get(id);
      if (view) this.tweens.add({ targets: view, y: view.y + 90, angle: 65, alpha: 0, scale: .45, duration: 420 });
      this.instruction?.setText('Oops! We can bring another.'); this.chime(240, .035);
    });
    if (this.bodies.length > 0 && this.bodies.every(body => body.spilled)) this.returnAllDroppedItemsToCounter();
    this.debug?.setText(`tilt ${tilt.x.toFixed(2)}, ${tilt.y.toFixed(2)} · steps ${this.steps}/${this.round.order.steps} · ${this.fallback ? 'buttons' : 'motion'}`);
  }

  private unlockAudio(): void { if (this.muted) return; try { this.audio ??= new AudioContext(); void this.audio.resume(); } catch { /* Sound is optional. */ } }
  private chime(frequency = 540, volume = .06): void {
    if (!this.audio || this.muted) return;
    const oscillator = this.audio.createOscillator(); const gain = this.audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, this.audio.currentTime);
    gain.gain.setValueAtTime(volume, this.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, this.audio.currentTime + .17);
    oscillator.connect(gain); gain.connect(this.audio.destination); oscillator.start(); oscillator.stop(this.audio.currentTime + .18);
  }
  private speak(words: string): void {
    if (this.muted || !window.speechSynthesis) return; window.speechSynthesis.cancel();
    const voice = new SpeechSynthesisUtterance(words); voice.rate = .86; voice.pitch = 1.16; window.speechSynthesis.speak(voice);
  }
}
