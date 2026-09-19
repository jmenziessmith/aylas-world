import Phaser from 'phaser';
import { createRound, worldBridgePrompts, type Choice, type Mode, type ObjectKind, type Round } from './rounds';

const W = 960; const H = 720; const ASSETS = `${import.meta.env.BASE_URL}assets/mermaid`;
const SAVE_KEY = 'aylas-world-mermaid-progress-v1';
const DIRECT_STAGE = { x: 480, y: 405, width: 840, height: 600 } as const;
const MENU_STAGE_INNER = { x: 245, y: 280, width: 440, height: 135 } as const;
const SORT_STAGE_INNER = { x: 245, y: 285, width: 440, height: 170 } as const;
const NECKLACE_SLOTS = [{ x: 296, y: 386 }, { x: 375, y: 426 }, { x: 480, y: 451 }, { x: 585, y: 426 }, { x: 664, y: 386 }] as const;
const CROP: Record<ObjectKind, [number, number, number, number]> = {
  'pink-shell': [35, 20, 430, 410], 'yellow-shell': [500, 20, 430, 405], 'teal-shell': [960, 20, 445, 415],
  'purple-spiral': [35, 435, 385, 310], 'pink-spiral': [420, 420, 335, 335], 'orange-spiral': [755, 425, 330, 325],
  pearl: [1100, 445, 300, 300], star: [15, 745, 320, 310], 'sand-dollar': [325, 745, 310, 315],
  'teal-spiral': [640, 745, 310, 315], conch: [920, 735, 315, 335], gem: [1200, 755, 230, 300]
};
const OUTLINE: Record<ObjectKind, string> = {
  'pink-shell': 'outline-scallop', 'yellow-shell': 'outline-scallop', 'teal-shell': 'outline-scallop',
  'purple-spiral': 'outline-spiral', 'pink-spiral': 'outline-spiral', 'orange-spiral': 'outline-spiral',
  pearl: 'outline-pearl', star: 'outline-star', 'sand-dollar': 'outline-sand-dollar',
  'teal-spiral': 'outline-spiral', conch: 'outline-conch', gem: 'outline-gem'
};
const CHARM: Record<ObjectKind, string> = {
  'pink-shell': 'charm-shell', 'yellow-shell': 'charm-shell', 'teal-shell': 'charm-shell',
  'purple-spiral': 'charm-rainbow', 'pink-spiral': 'charm-rainbow', 'orange-spiral': 'charm-rainbow',
  pearl: 'charm-pearl', star: 'charm-star', 'sand-dollar': 'charm-rainbow',
  'teal-spiral': 'charm-rainbow', conch: 'charm-rainbow', gem: 'charm-rainbow'
};
interface Progress { wins: number; attempts: number; charms: ObjectKind[]; }

export class MermaidGameScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container; private necklace!: Phaser.GameObjects.Container;
  private mermaid!: Phaser.GameObjects.Image; private prompt!: Phaser.GameObjects.Text; private title!: Phaser.GameObjects.Text; private audioButton!: Phaser.GameObjects.Image;
  private round?: Round; private progress: Progress = { wins: 0, attempts: 0, charms: [] };
  private selectedSort = new Set<number>(); private busy = false; private lastMode?: Mode; private worldBridge = false;
  private visibleWidth = W; private layoutOffset = 0; private chapterIndex = 0; private chapterStep = 0;
  private chapterJewels: ObjectKind[] = [];
  private debugModeActive = false; private soundEnabled = true; private speechUnlocked = false; private lastEdgeTap = 0;
  private gamesSinceBridge = 0; private nextBridgeAt = 3;
  private readonly chapters: Mode[] = ['match', 'count', 'pattern', 'add', 'sort', 'compare', 'subtract', 'number'];

  constructor() { super('mermaid-game'); }
  preload(): void {
    this.load.image('mermaid-bg', `${ASSETS}/background.png`); this.load.image('mermaid-happy', `${ASSETS}/mermaid-happy.png`);
    this.load.image('mermaid-present', `${ASSETS}/mermaid-present.png`); this.load.image('mermaid-think', `${ASSETS}/mermaid-think.png`);
    this.load.image('mermaid-cheer', `${ASSETS}/mermaid-cheer.png`);
    (Object.keys(CROP) as ObjectKind[]).forEach(kind => this.load.image(`sea-${kind}`, `${ASSETS}/sprites/${kind}.png`));
    this.load.image('shell-stand', `${ASSETS}/sprites/shell-stand.png`); this.load.image('chalkboard', `${ASSETS}/sprites/chalkboard.png`); this.load.image('title-banner', `${ASSETS}/sprites/title-banner.png`);
    ['home-button', 'audio-button', 'activity-frame', 'progress-panel', 'answer-tray', 'message-panel', 'option-panel', 'necklace-base', 'pearl-shell', 'reward-charms', 'shell-basket', 'shape-outlines', 'magic-effects']
      .forEach(key => this.load.image(key, `${ASSETS}/sprites/${key}.png`));
    [...new Set(Object.values(OUTLINE)), 'effect-bubbles', 'effect-gold-sparkle', 'effect-blue-sparkle', 'effect-pink-sparkle', 'effect-star-burst']
      .forEach(key => this.load.image(key, `${ASSETS}/sprites/${key}.png`));
    [...new Set(Object.values(CHARM))].forEach(key => this.load.image(key, `${ASSETS}/sprites/${key}.png`));
  }
  create(): void {
    document.querySelector('#game-loader')?.setAttribute('hidden', ''); this.loadProgress();
    this.nextBridgeAt = Phaser.Math.Between(2, 3);
    const bgSource = this.textures.get('mermaid-bg').getSourceImage() as HTMLImageElement;
    const bg = this.add.image(W / 2, 0, 'mermaid-bg').setOrigin(.5, 0).setScale(H / bgSource.height).setDepth(-10).setName('mermaid-background');
    this.add.rectangle(W / 2, H / 2, 2400, H, 0x073e66, .06).setDepth(-9).setName('mermaid-wash');
    this.makeTopBar(); this.makeHost(); this.makeNecklace(); this.content = this.add.container(0, 0);
    const needsSpeechGesture = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.speechUnlocked = !needsSpeechGesture;
    if (needsSpeechGesture) this.game.canvas.addEventListener('pointerdown', () => { this.speechUnlocked = true; this.speak(this.worldBridge ? this.prompt.text : this.round?.prompt ?? 'Welcome to Mermaid Magic!'); }, { once: true, capture: true });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this); this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => speechSynthesis?.cancel());
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search); const debugMode = params.get('mode') as Mode | null;
      if (debugMode && this.chapters.includes(debugMode)) { this.chapterIndex = this.chapters.indexOf(debugMode); this.debugModeActive = true; }
      if (params.has('necklace-preview')) this.chapterJewels = ['pink-shell', 'pearl', 'star', 'gem', 'pink-shell'];
      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
        const index = Number(event.key) - 1; if (index >= 0 && index < this.chapters.length) { this.debugModeActive = true; this.chapterIndex = index; this.chapterStep = 0; this.chapterJewels = []; this.nextRound(); }
        if (event.key.toLowerCase() === 'p') { this.chapterIndex = 0; this.chapterJewels = ['pink-shell', 'pearl', 'star', 'gem', 'pink-shell']; this.nextRound(); }
        if (event.key.toLowerCase() === 'w') this.showWorldBridge();
        if (event.key === 'ArrowRight') this.skipMode();
      });
    }
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const atRightEdge = pointer.x > this.scale.gameSize.width * .9 && pointer.y > this.scale.gameSize.height * .18;
      if (!atRightEdge) { this.lastEdgeTap = 0; return; }
      const now = performance.now(); if (now - this.lastEdgeTap < 360) { this.lastEdgeTap = 0; this.skipMode(); } else this.lastEdgeTap = now;
    });
    this.resize(this.scale.gameSize); this.nextRound();
    bg.setInteractive().on('pointerdown', () => { if (!this.busy && this.round) this.speak(this.round.prompt); });
  }
  private makeTopBar(): void {
    const panel = this.add.image(480, 51, 'title-banner').setDisplaySize(450, 105).setDepth(50).setName('top-panel');
    this.title = this.add.text(480, 55, 'Mermaid Magic', this.textStyle(29, '#234b74')).setOrigin(.5).setDepth(51);
    const home = this.artButton(48, 52, 'home-button', () => { window.location.href = import.meta.env.BASE_URL; }); home.setDepth(60).setName('home-control');
    this.audioButton = this.artButton(912, 52, 'audio-button', () => { this.soundEnabled = !this.soundEnabled; this.audioButton.setAlpha(this.soundEnabled ? 1 : .5); if (!this.soundEnabled) window.speechSynthesis?.cancel(); else this.speak(this.worldBridge ? this.prompt.text : this.round?.prompt ?? 'Sound is on!'); }); this.audioButton.setDepth(60).setName('audio-control');
    panel.setScrollFactor(0); this.title.setScrollFactor(0);
  }
  private artButton(x: number, y: number, key: string, callback: () => void): Phaser.GameObjects.Image {
    const button = this.add.image(x, y, key).setDisplaySize(78, 78).setInteractive({ cursor: 'pointer' });
    button.on('pointerdown', () => { this.tweens.add({ targets: button, scale: .88, duration: 80, yoyo: true }); callback(); }); return button;
  }
  private makeHost(): void {
    this.mermaid = this.add.image(875, 418, 'mermaid-present').setDisplaySize(370, 495).setDepth(10);
    this.add.graphics().setDepth(15).setName('host-bubble').setVisible(false);
    this.prompt = this.add.text(778, 163, '', { ...this.textStyle(21, '#284967'), align: 'center', wordWrap: { width: 250 }, lineSpacing: 3 }).setOrigin(.5).setDepth(16).setVisible(false);
    this.tweens.add({ targets: this.mermaid, y: 435, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  private makeNecklace(): void {
    this.necklace = this.add.container(882, 370).setDepth(8).setVisible(false);
    this.necklace.add(this.add.image(0, 0, 'progress-panel').setDisplaySize(132, 330)); this.refreshNecklace();
  }
  private refreshNecklace(): void {
    this.necklace.list.slice(1).forEach(item => item.destroy()); const shown = this.progress.charms.slice(-6);
    shown.forEach((kind, index) => { const row = Math.floor(index / 2); const col = index % 2; this.necklace.add(this.objectImage((col - .5) * 42, -105 + row * 105, kind, 34).setDepth(2)); });
  }
  private nextRound(): void {
    this.busy = false; this.worldBridge = !this.debugModeActive && this.gamesSinceBridge >= this.nextBridgeAt;
    if (this.worldBridge) { this.showWorldBridge(); return; }
    const chapterMode = this.chapters[this.chapterIndex % this.chapters.length];
    this.round = createRound(this.level(), this.lastMode, chapterMode); this.lastMode = this.round.mode; this.selectedSort.clear(); this.renderRound(this.round);
  }
  private skipMode(): void { this.time.removeAllEvents(); window.speechSynthesis?.cancel(); const skippingBridge = this.worldBridge; this.busy = false; this.worldBridge = false; if (skippingBridge) { this.gamesSinceBridge = 0; this.nextBridgeAt = Phaser.Math.Between(2, 3); } this.chapterIndex = (this.chapterIndex + 1) % this.chapters.length; this.chapterStep = 0; this.chapterJewels = []; const mode = this.chapters[this.chapterIndex]; this.round = createRound(this.level(), this.lastMode, mode); this.lastMode = mode; this.selectedSort.clear(); this.renderRound(this.round); }
  private level(): number { return Math.max(0, Math.min(10, Math.floor(this.progress.wins / 2) - Math.floor((this.progress.attempts - this.progress.wins) / 3))); }
  private renderRound(round: Round): void {
    this.content.removeAll(true); this.necklace.setVisible(false); this.title.setText(round.mode === 'match' ? 'Necklace' : round.title); this.prompt.setText(round.mode === 'match' ? 'Match this shape for the necklace!' : round.prompt); this.setMermaid('mermaid-present'); this.speak(round.mode === 'match' ? 'Match this shape for the necklace!' : round.prompt);
    if (round.mode === 'pattern') this.renderPattern(round); else if (round.mode === 'number') this.renderNumberGroups(round);
    else if (round.mode === 'compare') this.renderCompare(round); else if (round.mode === 'match') this.renderNecklaceChapter(round);
    else if (round.mode === 'sort') this.renderSort(round); else if (round.mode === 'add') { this.renderAddition(round); this.renderChoices(round.choices); }
    else if (round.mode === 'subtract') { this.renderSubtraction(round); this.renderChoices(round.choices); }
    else { this.renderObjectField(round.objects); this.renderChoices(round.choices); }
  }
  private renderObjectField(objects: ObjectKind[]): void {
    this.addActivityStage();
    const positions = this.gridPositions(objects.length, MENU_STAGE_INNER.x, MENU_STAGE_INNER.y, MENU_STAGE_INNER.width, MENU_STAGE_INNER.height); objects.forEach((kind, index) => { const item = this.objectImage(positions[index].x, positions[index].y, kind, objects.length > 7 ? 64 : 82); this.content.add(item);
    });
  }
  private renderSubtraction(round: Round): void {
    this.addActivityStage(); this.busy = true;
    const positions = this.gridPositions(round.objects.length, MENU_STAGE_INNER.x, MENU_STAGE_INNER.y, MENU_STAGE_INNER.width, MENU_STAGE_INNER.height);
    const leavingFrom = round.objects.length - (round.remove ?? 0);
    round.objects.forEach((kind, index) => {
      const position = positions[index]; const item = this.objectImage(position.x, position.y, kind, round.objects.length > 7 ? 64 : 82); this.content.add(item);
      if (index < leavingFrom) return;
      this.time.delayedCall(700 + (index - leavingFrom) * 180, () => {
        this.tweens.add({ targets: item, x: position.x + 65, y: position.y - 65, angle: 18, alpha: 0, duration: 520, ease: 'Sine.In', onComplete: () => {
          item.setPosition(position.x, position.y).setAngle(0).setAlpha(.14);
          const gone = this.add.text(position.x, position.y, '×', this.textStyle(62, '#775b94')).setOrigin(.5); this.content.add(gone);
        } });
        const bubbles = this.add.image(position.x + 30, position.y - 20, 'effect-bubbles').setDisplaySize(72, 72).setAlpha(.65); this.content.add(bubbles);
        this.tweens.add({ targets: bubbles, y: bubbles.y - 70, alpha: 0, duration: 700, onComplete: () => bubbles.destroy() });
      });
    });
    this.time.delayedCall(1400 + (round.remove ?? 0) * 180, () => { this.busy = false; });
  }
  private renderAddition(round: Round): void {
    this.addActivityStage();
    const rightObjects = round.secondGroup ?? [];
    const left = this.gridPositions(round.objects.length, 285, 285, 165, 170);
    const right = this.gridPositions(rightObjects.length, 525, 285, 150, 170);
    const leftSize = round.objects.length > 4 ? 50 : round.objects.length > 2 ? 60 : 76;
    const rightSize = rightObjects.length > 2 ? 58 : 76;
    left.forEach((position, index) => this.content.add(this.objectImage(position.x, position.y, round.objects[index], leftSize)));
    this.content.add(this.add.text(487, 370, '+', this.textStyle(54, '#345578')).setOrigin(.5));
    right.forEach((position, index) => this.content.add(this.objectImage(position.x, position.y, rightObjects[index], rightSize)));
  }
  private renderChoices(choices: Choice[], groups = false): void {
    this.content.add(this.add.image(480, 620, 'answer-tray').setDisplaySize(590, 145));
    const width = groups ? 185 : 125; const gap = groups ? 190 : choices.length > 3 ? 120 : 145; const start = 480 - (choices.length - 1) * gap / 2;
    choices.forEach((choice, index) => { const x = start + index * gap; const card = this.choiceCard(x, 620, width, 112, () => this.choose(choice, card));
      if (choice.label) card.add(this.add.text(0, 0, choice.label, this.textStyle(55, index % 2 ? '#e25f75' : '#7652ae')).setOrigin(.5));
      else choice.objects?.forEach((kind, objectIndex) => { const cols = Math.ceil(Math.sqrt(choice.objects!.length)); const row = Math.floor(objectIndex / cols); const col = objectIndex % cols; const single = choice.objects!.length === 1; card.add(this.objectImage((col - (cols - 1) / 2) * 43, single ? 0 : (row - .5) * 42, kind, single ? 76 : choice.objects!.length > 5 ? 34 : 43)); });
    });
  }
  private renderPattern(round: Round): void {
    this.addActivityStage();
    round.sequence?.forEach((kind, index) => this.content.add(this.objectImage(295 + index * 72, 365, kind, 68)));
    this.content.add(this.add.text(295 + (round.sequence?.length ?? 0) * 72, 365, '?', this.textStyle(58, '#74559b')).setOrigin(.5)); this.renderChoices(round.choices);
  }
  private renderNumberGroups(round: Round): void {
    const answerCount = round.choices.find(choice => choice.answer)?.objects?.length ?? 1;
    this.content.add(this.add.image(80, 360, 'chalkboard').setDisplaySize(298, 459));
    this.content.add(this.add.text(80, 270, 'FIND', { fontFamily: '"Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive', fontSize: '30px', color: '#fffbe8', fontStyle: 'bold', align: 'center' }).setOrigin(.5));
    this.content.add(this.add.text(80, 338, `${answerCount}`, { fontFamily: '"Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive', fontSize: '64px', color: '#fffbe8', fontStyle: 'bold', align: 'center' }).setOrigin(.5));
    const groupPositions = [{ x: 420, y: 290 }, { x: 780, y: 290 }, { x: 600, y: 550 }];
    round.choices.forEach((choice, choiceIndex) => {
      const point = groupPositions[choiceIndex]; this.content.add(this.add.image(point.x, point.y, 'message-panel').setDisplaySize(345, 255));
      const card = this.choiceCard(point.x, point.y, 315, 220, () => this.choose(choice, card)); const objects = choice.objects ?? [];
      const positions = this.gridPositions(objects.length, -120, -82, 240, 164); const size = objects.length > 7 ? 52 : objects.length > 4 ? 64 : 78; objects.forEach((kind, index) => card.add(this.objectImage(positions[index].x, positions[index].y, kind, size)));
    });
  }
  private renderNecklaceChapter(round: Round): void {
    // The main shell and necklace are the activity, matching the supplied visual direction.
    this.content.add(this.add.image(480, 350, 'shell-stand').setDisplaySize(400, 388));
    this.content.add(this.add.image(480, 390, 'necklace-base').setDisplaySize(520, 336));
    // Anchor by the top of each charm so its hoop stays on the gold connector while the body covers the stitched circle.
    this.chapterJewels.forEach((jewel, index) => this.addNecklacePendant(jewel, index));
    const board = this.add.image(145, 355, 'chalkboard').setDisplaySize(280, 430); this.content.add(board);
    this.content.add(this.add.text(145, 270, 'FIND THE\nMATCH', { fontFamily: '"Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive', fontSize: '23px', color: '#fffbe8', fontStyle: 'bold', align: 'center', lineSpacing: 4 }).setOrigin(.5));
    this.content.add(this.add.image(145, 390, OUTLINE[round.target!]).setDisplaySize(128, 128));
    this.content.add(this.add.image(205, 540, 'shell-basket').setDisplaySize(160, 100));
    this.content.add(this.add.text(480, 588, `${this.chapterStep + 1} of 5`, this.textStyle(20, '#ffffff')).setOrigin(.5));
    this.content.add(this.add.image(480, 625, 'answer-tray').setDisplaySize(590, 145));
    const choices = round.choices; const gap = choices.length > 3 ? 120 : 145; const start = 480 - (choices.length - 1) * gap / 2;
    choices.forEach((choice, index) => { const card = this.choiceCard(start + index * gap, 630, 118, 105, () => this.choose(choice, card)); card.add(this.objectImage(0, 0, choice.objects![0], 78)); });
  }
  private renderCompare(round: Round): void {
    this.addActivityStage(true);
    const groups = [round.objects, round.secondGroup ?? []]; groups.forEach((objects, groupIndex) => { const x = 355 + groupIndex * 250; const card = this.choiceCard(x, 350, 235, 200, () => this.choose(round.choices[groupIndex], card));
      const positions = this.gridPositions(objects.length, -88, -68, 176, 136); const size = objects.length > 7 ? 48 : objects.length > 4 ? 60 : 74; objects.forEach((kind, index) => card.add(this.objectImage(positions[index].x, positions[index].y, kind, size))); });
  }
  private renderSort(round: Round): void {
    this.addActivityStage(true);
    const sample = this.add.circle(190, 315, 62, 0xfff7e7, .95).setStrokeStyle(4, 0xffffff); this.content.add(sample); this.content.add(this.objectImage(190, 315, round.target!, 86));
    const positions = this.gridPositions(round.objects.length, SORT_STAGE_INNER.x, SORT_STAGE_INNER.y, SORT_STAGE_INNER.width, SORT_STAGE_INNER.height); round.objects.forEach((kind, index) => { const size = round.objects.length > 7 ? 78 : 94; const item = this.objectImage(positions[index].x, positions[index].y, kind, size).setInteractive({ cursor: 'pointer' }); this.content.add(item);
      item.on('pointerdown', () => { if (this.busy || this.selectedSort.has(index)) return; if (kind === round.target) { this.selectedSort.add(index); this.sparkle(item.x, item.y); const finished = this.selectedSort.size === round.sortTargets?.length; this.tweens.add({ targets: item, y: item.y - 35, scale: item.scale * .35, alpha: 0, duration: 280, ease: 'Back.In', onComplete: () => { item.destroy(); if (finished) this.correct(); } }); } else this.wrong(item); });
    });
  }
  private showWorldBridge(): void {
    this.content.removeAll(true); this.necklace.setVisible(false); this.title.setText('In Your World'); this.setMermaid('mermaid-happy'); const challenge = worldBridgePrompts[Math.floor(Math.random() * worldBridgePrompts.length)]; this.prompt.setText(challenge); this.speak(`Let’s try this in your world! ${challenge}`);
    const card = this.add.image(480, 370, 'message-panel').setDisplaySize(660, 340); this.content.add(card);
    this.content.add(this.add.text(480, 285, '🌍  ✨  🐚', this.textStyle(52, '#664c83')).setOrigin(.5)); this.content.add(this.add.text(480, 385, challenge, { ...this.textStyle(37, '#284967'), align: 'center', wordWrap: { width: 560 } }).setOrigin(.5));
    this.content.add(this.add.image(480, 610, 'answer-tray').setDisplaySize(590, 145));
    const button = this.choiceCard(480, 610, 350, 104, () => { if (this.busy) return; this.busy = true; this.gamesSinceBridge = 0; this.nextBridgeAt = Phaser.Math.Between(2, 3); this.progress.charms.push('gem'); this.saveProgress(); this.refreshNecklace(); this.celebrate('A rainbow gem!'); });
    button.add(this.add.text(0, 0, 'I DID IT!  ★', this.textStyle(34, '#6b3f76')).setOrigin(.5));
  }
  private choiceCard(x: number, y: number, width: number, height: number, callback: () => void): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ cursor: 'pointer' }); const card = this.add.container(x, y, [bg]); this.content.add(card);
    bg.on('pointerdown', () => { if (this.busy) return; this.tweens.add({ targets: card, scale: .93, duration: 90, yoyo: true }); callback(); }); return card;
  }
  private addNecklacePendant(jewel: ObjectKind, index: number): void { const slot = NECKLACE_SLOTS[index]; if (!slot) return; const width = jewel === 'star' ? 126 : jewel === 'gem' ? 122 : 118; this.content.add(this.add.image(slot.x, slot.y, CHARM[jewel]).setOrigin(.5, 0).setDisplaySize(width, 128)); }
  private choose(choice: Choice, card: Phaser.GameObjects.Container): void { if (choice.answer) { if (this.round?.mode === 'match' && this.round.target) { const index = this.chapterJewels.length; this.chapterJewels.push(this.round.target); this.addNecklacePendant(this.round.target, index); } this.correct(); } else this.wrong(card); }
  private correct(): void { if (this.busy) return; this.busy = true; this.progress.wins++; this.progress.attempts++; this.gamesSinceBridge++; const rewards: ObjectKind[] = ['pearl', 'pink-shell', 'star', 'gem', 'teal-spiral']; const reward = rewards[this.progress.wins % rewards.length]; this.progress.charms.push(reward); this.chapterStep++;
    const finishedChapter = this.chapterStep >= 5;
    this.saveProgress(); this.refreshNecklace();
    if (finishedChapter) this.celebrate('You completed the necklace!', 3500, () => { this.chapterStep = 0; this.chapterIndex++; this.chapterJewels = []; });
    else this.celebrate(['That’s it!', 'You found it!', 'Wonderful thinking!', 'Yes! Well done!'][this.progress.wins % 4]); }
  private celebrate(message: string, delay = 1500, beforeNext?: () => void): void { this.setMermaid('mermaid-cheer'); this.prompt.setText(message); this.speak(message);
    for (let i = 0; i < 9; i++) this.time.delayedCall(i * 90, () => {
      const size = Phaser.Math.Between(24, 48); const bubble = this.add.image(Phaser.Math.Between(150, 900) + this.layoutOffset, 700, 'effect-bubbles').setDisplaySize(size, size).setDepth(-1).setAlpha(.55);
      this.tweens.add({ targets: bubble, y: Phaser.Math.Between(100, 360), x: bubble.x + Phaser.Math.Between(-35, 35), alpha: 0, duration: Phaser.Math.Between(1100, 1700), ease: 'Sine.Out', onComplete: () => bubble.destroy() });
    });
    this.time.delayedCall(delay, () => { beforeNext?.(); this.nextRound(); }); }
  private wrong(target: Phaser.GameObjects.GameObject): void { this.progress.attempts++; this.saveProgress(); this.setMermaid('mermaid-think'); this.prompt.setText('Nearly! Try another one.'); this.speak('Nearly! Try another one.'); this.tweens.add({ targets: target, x: '+=10', duration: 65, yoyo: true, repeat: 3 }); this.time.delayedCall(900, () => { if (this.round && !this.busy) { this.setMermaid('mermaid-present'); this.prompt.setText(this.round.prompt); } }); }
  private sparkle(x: number, y: number): void {
    const effects = ['effect-gold-sparkle', 'effect-blue-sparkle', 'effect-pink-sparkle', 'effect-star-burst'];
    const effect = this.add.image(x, y, Phaser.Utils.Array.GetRandom(effects)).setDisplaySize(Phaser.Math.Between(35, 62), Phaser.Math.Between(45, 76)).setDepth(100).setAlpha(.95);
    this.tweens.add({ targets: effect, y: y - 70, x: x + Phaser.Math.Between(-45, 45), alpha: 0, scale: 1.5, angle: Phaser.Math.Between(-25, 25), duration: 750, onComplete: () => effect.destroy() });
  }
  private objectImage(x: number, y: number, kind: ObjectKind, size: number): Phaser.GameObjects.Image { return this.add.image(x, y, `sea-${kind}`).setDisplaySize(size, size); }
  private addActivityStage(_expanded = false): void { this.content.add(this.add.image(DIRECT_STAGE.x, DIRECT_STAGE.y, 'activity-frame').setDisplaySize(DIRECT_STAGE.width, DIRECT_STAGE.height)); }
  private gridPositions(count: number, x: number, y: number, width: number, height: number): Phaser.Math.Vector2[] {
    const cols = Math.ceil(Math.sqrt(count * width / height)); const rows = Math.ceil(count / cols);
    return Array.from({ length: count }, (_, index) => new Phaser.Math.Vector2(x + (index % cols + .5) * width / cols, y + (Math.floor(index / cols) + .5) * height / rows));
  }
  private setMermaid(key: string): void { const hostX = this.round?.mode === 'number' && !this.worldBridge ? 1045 : 875; this.mermaid.setTexture(key).setDisplaySize(385, 510).setX(hostX + this.layoutOffset); }
  private speak(text: string): void { if (!this.soundEnabled || !this.speechUnlocked || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); window.speechSynthesis.resume(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-GB'; utterance.volume = 1; utterance.rate = .88; utterance.pitch = 1.12; const voices = speechSynthesis.getVoices(); utterance.voice = voices.find(voice => voice.lang.startsWith('en') && /female|samantha|victoria|serena/i.test(voice.name)) ?? voices.find(voice => voice.lang.startsWith('en')) ?? null; speechSynthesis.speak(utterance); }
  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle { return { fontFamily: 'ui-rounded, "Arial Rounded MT Bold", system-ui', fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#ffffff', strokeThickness: size > 25 ? 3 : 0 }; }
  private loadProgress(): void { try { const stored = localStorage.getItem(SAVE_KEY); if (stored) this.progress = { ...this.progress, ...JSON.parse(stored) }; } catch { /* Keep play available when storage is restricted. */ } }
  private saveProgress(): void { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.progress)); } catch { /* Progress is optional. */ } }
  private resize(gameSize: Phaser.Structs.Size): void {
    const zoom = gameSize.height / H; this.visibleWidth = gameSize.width / zoom; this.layoutOffset = (this.visibleWidth - W) / 2;
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height).setOrigin(0, 0).setZoom(zoom).setScroll(0, 0);
    const move = (object: Phaser.GameObjects.GameObject | null | undefined, baseX: number): void => { const positioned = object as Phaser.GameObjects.Components.Transform | undefined; positioned?.setX(baseX + this.layoutOffset); };
    move(this.children.getByName('mermaid-background'), this.visibleWidth / 2 - this.layoutOffset); move(this.children.getByName('mermaid-wash'), this.visibleWidth / 2 - this.layoutOffset); this.content?.setX(this.layoutOffset);
    move(this.title, 480); move(this.mermaid, this.round?.mode === 'number' && !this.worldBridge ? 1045 : 875); move(this.prompt, 805); move(this.necklace, 910);
    move(this.children.getByName('top-panel'), 480); move(this.children.getByName('home-control'), 48); move(this.children.getByName('audio-control'), 912);
    const bubble = this.children.getByName('host-bubble') as Phaser.GameObjects.Graphics | null; bubble?.setX(this.layoutOffset);
  }
}
