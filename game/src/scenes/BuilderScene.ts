import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, setText, textWidth, fitText } from '../art/font5x7';
import { MONSTER_ART } from '../art/textures';
import { blockBounds, blockParts, blocksOverlap, closestBlockPoint, findDraftOverlaps, localToWorld, pointInBlock, snapBlock } from '../builder/geometry';
import { cloneDraft, newDraft, settle, toLevel, validateDraft, type BuilderDocument } from '../builder/document';
import { blockTextureKey, createBlockBody, ensureBlockTextures, installConnections } from '../builder/physics';
import { getSettings } from '../config/settings';
import { H, W } from '../config/constants';
import { goTo } from '../core/flow';
import { data } from '../data/load';
import type { BuilderConfig, LevelBlock, LevelConnection, LevelMonster } from '../data/types';
import { platform } from '../platform';
import { makeButton, type Btn } from '../ui/widgets';

const STORAGE_KEY = 'monster-mash.builder.v1';
const FILE_LIMIT = 100000;
const VIEW = { x: 116, y: 34, w: 360, h: 196 };
let currentDraft: BuilderDocument | undefined;
let saveQueue: Promise<void> = Promise.resolve();
let nextId = 0;
type Tool = 'piece' | 'select' | 'target' | 'glue' | 'rope';
type Family = BuilderConfig['presets'][number]['family'] | 'Targets';
type Selection = { kind: 'block'; id: string } | { kind: 'monster'; index: number };
type Point = { x: number; y: number };
interface Group { blocks: Set<string>; monsters: Set<number> }
interface GroupDrag { start: Point; preview: BuilderDocument; valid: boolean; moved: boolean }
interface Drag { selection: Selection; offset: Point; preview: BuilderDocument; valid: boolean; moved: boolean; start: Point }

/** A paused authoring view; only Test advances its isolated Matter world. */
export default class BuilderScene extends Phaser.Scene {
  private config!: BuilderConfig;
  private draft = newDraft();
  private past: BuilderDocument[] = [];
  private future: BuilderDocument[] = [];
  private tool: Tool = 'piece';
  private preset = 0;
  private family: Family = 'Planks';
  private target = 0;
  private targetPage = 0;
  private placementAngle = 0;
  private material = 'wood';
  private selection?: Selection;
  private pending?: { id: string | null; point: Point };
  private drag?: Drag;
  private group?: Group;
  private groupDrag?: GroupDrag;
  private marquee?: { a: Point; b: Point };
  private hover?: Point;
  private gridGfx?: Phaser.GameObjects.Graphics;
  private running = false;
  private loading = false;
  private restoreGeneration = 0;
  private acc = 0;
  private worldRoot?: Phaser.GameObjects.Container;
  private clip?: Phaser.GameObjects.Graphics;
  private overlay?: Phaser.GameObjects.Graphics;
  private bodies: any[] = [];
  private blockBodies: any[] = [];
  private monsterBodies: any[] = [];
  private sprites: { body: any; image: Phaser.GameObjects.Image }[] = [];
  private links?: ReturnType<typeof installConnections>;
  private status!: Phaser.GameObjects.Image;
  private warning!: Phaser.GameObjects.Image;
  private testButton!: Btn;
  private editButtons: Btn[] = [];
  private undoButton!: Btn;
  private redoButton!: Btn;
  private anchorButton!: Btn;
  private pinButton!: Btn;
  private releaseButtons: Btn[] = [];
  private paletteRows: Btn[] = [];
  private paletteMarkers: Phaser.GameObjects.Rectangle[] = [];
  private targetPrev!: Btn;
  private targetNext!: Btn;
  private activeMarkers: { marker: Phaser.GameObjects.Rectangle; active: () => boolean }[] = [];
  private importInput?: HTMLInputElement;
  private exportUrls = new Set<string>();

  constructor() { super('builder'); }

  create(): void {
    if (!getSettings().features.builder) { goTo(this, 'title'); return; }
    this.config = data.content.builder;
    const generation = ++this.restoreGeneration;
    this.running = false;
    this.loading = currentDraft === undefined;
    this.acc = 0;
    this.past = [];
    this.future = [];
    this.selection = undefined;
    this.pending = undefined;
    this.drag = undefined;
    this.group = undefined;
    this.groupDrag = undefined;
    this.marquee = undefined;
    this.gridGfx = undefined;
    this.tool = 'piece';
    this.preset = 0;
    this.family = 'Planks';
    this.target = 0;
    this.targetPage = 0;
    this.placementAngle = 0;
    this.material = this.config.materials[0];
    this.editButtons = [];
    this.releaseButtons = [];
    this.paletteRows = [];
    this.paletteMarkers = [];
    this.activeMarkers = [];
    this.draft = newDraft();
    let message = this.loading ? 'Loading your saved design...' : 'Draft restored. Select to move; Lock joins blocks; Rope hangs them.';
    try {
      if (currentDraft) this.draft = validateDraft(currentDraft, this.config, this.monsterSize);
    } catch { message = 'Saved draft could not be read. A new empty design is ready.'; }
    this.cameras.main.setBackgroundColor(C('f'));
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    this.add.rectangle(56, 130, 112, 200, C('8'));
    this.add.rectangle(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2, VIEW.w, VIEW.h, C('9'));
    this.status = text(this, 5, 261, '', C('c')).setOrigin(0, 0.5).setDepth(20);
    this.warning = text(this, VIEW.x + VIEW.w / 2, 38, '', C('4')).setOrigin(0.5, 0).setDepth(20);
    this.buildControls();
    this.renderWorld();
    this.say(message);
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', this.pointerUp, this);
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-R', this.rotateKey, this);
    this.input.keyboard?.on('keydown-DELETE', this.deleteSelection, this);
    this.input.keyboard?.on('keydown-ESC', this.cancelLink, this);
    this.events.once('shutdown', () => {
      this.restoreGeneration++;
      this.input.off('pointerdown', this.pointerDown, this);
      this.input.off('pointermove', this.pointerMove, this);
      this.input.off('pointerup', this.pointerUp, this);
      this.input.off('pointerupoutside', this.pointerUp, this);
      this.input.keyboard?.off('keydown-R', this.rotateKey, this);
      this.input.keyboard?.off('keydown-DELETE', this.deleteSelection, this);
      this.input.keyboard?.off('keydown-ESC', this.cancelLink, this);
      this.clearWorld();
      this.importInput?.remove();
      this.importInput = undefined;
      for (const url of this.exportUrls) URL.revokeObjectURL(url);
      this.exportUrls.clear();
    });
    if (this.loading) void this.restoreDraft(generation);
  }

  private async restoreDraft(generation: number): Promise<void> {
    let message = 'Choose a piece, then tap the grid. Test checks your structure.';
    let restored = newDraft();
    try {
      const json = await platform.storage.get(STORAGE_KEY);
      if (json) {
        if (json.length > FILE_LIMIT) throw new Error('Saved draft is too large');
        restored = validateDraft(JSON.parse(json), this.config, this.monsterSize);
        message = 'Draft restored. Select to move; Lock joins blocks; Rope hangs them.';
      }
    } catch { message = 'Saved draft could not be read. A new empty design is ready.'; }
    if (generation !== this.restoreGeneration || !this.scene.isActive()) return;
    this.draft = restored;
    currentDraft = cloneDraft(restored);
    this.loading = false;
    this.renderWorld();
    this.refreshControls();
    this.say(message);
  }

  getDocument(): BuilderDocument { return cloneDraft(this.draft); }

  setDocument(value: unknown): void {
    if (this.loading) throw new Error('Wait for the saved design to load');
    if (this.running) throw new Error('Stop the physics test before changing the design');
    const safe = validateDraft(value, this.config, this.monsterSize);
    this.selection = undefined;
    this.pending = undefined;
    this.drag = undefined;
    this.commit(safe, 'Design loaded');
  }

  isSimulating(): boolean { return this.running; }

  simulate(on: boolean): void {
    if (this.loading) return;
    if (this.running === on) return;
    this.drag = undefined;
    this.pending = undefined;
    this.running = on;
    this.acc = 0;
    this.renderWorld();
    this.refreshControls();
    this.say(on ? 'Physics test - Stop restores your design. Overlaps remain unsaved.' : 'Design restored. Fix red overlaps before saving.');
  }

  private buildControls(): void {
    const button = (x: number, y: number, w: number, label: string, action: () => void, kind: 'plain' | 'go' = 'plain', h = 24): Btn => {
      const btn = makeButton(this, x, y, w, h, fitText(label, w - 8), kind, action, 12);
      // Compact palette rows have exact hit areas, so neighbouring rows cannot steal a click.
      btn.box.setSize(w, h);
      (btn.box.input!.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, w, h);
      return btn;
    };
    button(22, 15, 38, 'Home', () => goTo(this, 'title'));
    this.undoButton = button(63, 15, 40, 'Undo', () => this.history(false));
    this.redoButton = button(105, 15, 40, 'Redo', () => this.history(true));
    this.editButtons.push(button(147, 15, 40, 'Clear', () => this.clearAll()));
    this.testButton = button(199, 15, 56, 'Test', () => this.simulate(!this.running), 'go');
    const play = button(255, 15, 52, 'Play', () => this.play(), 'go');
    const save = button(307, 15, 46, 'Save', () => { void this.save(true); });
    const exportBtn = button(357, 15, 46, 'Export', () => this.exportFile());
    const challenge = button(436, 15, 76, 'Challenge', () => this.publish());
    this.editButtons.push(play, save, exportBtn, challenge);
    this.releaseButtons.push(save, exportBtn, challenge);
    text(this, 56, 35, 'PIECES', C('4')).setDepth(12);
    (['Planks', 'Square', 'Circle', 'Wedge'] as Family[]).forEach((family, i) => {
      const x = i % 2 ? 84 : 29, y = i < 2 ? 49 : 69;
      this.editButtons.push(button(x, y, 48, family, () => this.chooseFamily(family), 'plain', 18));
      const marker = this.add.rectangle(x, y, 50, 20).setStrokeStyle(1, C('4')).setFillStyle(C('4'), 0).setDepth(14);
      this.activeMarkers.push({ marker, active: () => this.family === family });
    });
    this.editButtons.push(button(38, 89, 68, 'Targets', () => this.chooseFamily('Targets'), 'plain', 18));
    this.targetPrev = button(84, 89, 18, '<', () => this.pageTargets(-1), 'plain', 18);
    this.targetNext = button(104, 89, 18, '>', () => this.pageTargets(1), 'plain', 18);
    this.editButtons.push(this.targetPrev, this.targetNext);
    for (let i = 0; i < 4; i++) {
      const y = 109 + i * 20;
      this.paletteRows.push(button(56, y, 104, '', () => this.choosePalette(i), 'plain', 18));
      this.paletteMarkers.push(this.add.rectangle(56, y, 106, 20).setStrokeStyle(1, C('b')).setFillStyle(C('b'), 0).setDepth(14));
    }
    text(this, 56, 182, 'MATERIAL', C('4')).setDepth(12);
    this.config.materials.forEach((material, i) => {
      const x = i % 2 ? 84 : 29, y = i < 2 ? 198 : 220;
      this.editButtons.push(button(x, y, 48, material.charAt(0).toUpperCase() + material.slice(1), () => {
        if (this.running || this.loading) return;
        this.material = material;
        this.refreshControls();
        this.say(`${material} selected for new pieces.`);
      }, 'plain', 20));
      const marker = this.add.rectangle(x, y, 50, 22).setStrokeStyle(1, C('b')).setFillStyle(C('b'), 0).setDepth(14);
      this.activeMarkers.push({ marker, active: () => this.material === material });
    });
    for (const [tool, label, x] of [['select', 'Select', 25], ['glue', 'Glue', 77], ['rope', 'Rope', 129]] as [Tool, string, number][]) {
      this.editButtons.push(button(x, 243, 48, label, () => this.choose(tool)));
      const marker = this.add.rectangle(x, 243, 50, 26).setStrokeStyle(1, C('4')).setFillStyle(C('4'), 0).setDepth(14);
      this.activeMarkers.push({ marker, active: () => this.tool === tool });
    }
    this.pinButton = button(181, 243, 48, 'Pin', () => this.pinWheel());
    this.editButtons.push(this.pinButton, button(221, 243, 26, '-45', () => this.rotate(-45)), button(249, 243, 26, '+45', () => this.rotate(45)));
    this.anchorButton = button(289, 243, 48, 'Anchor', () => this.anchor());
    this.editButtons.push(this.anchorButton, button(341, 243, 48, 'Delete', () => this.deleteSelection()), button(393, 243, 48, 'Unlink', () => this.unlink()), button(449, 243, 54, 'Import', () => this.importFile()));
    this.refreshControls();
  }

  private chooseFamily(family: Family): void {
    if (this.running || this.loading) return;
    this.family = family;
    this.choosePalette(0);
  }

  private pageTargets(delta: number): void {
    if (this.running || this.loading || this.family !== 'Targets') return;
    this.targetPage = Phaser.Math.Clamp(this.targetPage + delta, 0, Math.ceil(this.config.targets.length / 4) - 1);
    this.choosePalette(0);
  }

  private choices(): number[] {
    return this.family === 'Targets' ? this.config.targets.map((_t, i) => i).slice(this.targetPage * 4, this.targetPage * 4 + 4) : this.config.presets.map((p, i) => p.family === this.family ? i : -1).filter(i => i >= 0);
  }

  private choosePalette(row: number): void {
    if (this.running || this.loading) return;
    const index = this.choices()[row];
    if (index === undefined) return;
    if (this.family === 'Targets') { this.target = index; this.choose('target'); }
    else this.choose('piece', index);
  }

  private choose(tool: Tool, preset?: number): void {
    if (this.running || this.loading) return;
    this.tool = tool;
    if (preset !== undefined) this.preset = preset;
    this.pending = undefined;
    this.selection = undefined;
    this.group = undefined;
    const name = data.content.monsters.find(m => m.id === this.config.targets[this.target])?.name ?? 'Target';
    const hints: Record<Tool, string> = {
      piece: `${this.config.presets[this.preset].name}: click to place. R/right-click turns 45 degrees; Shift reverses.`,
      select: 'Select: drag pieces or an empty area for a group. R turns 45; Shift+R reverses; Delete removes.',
      target: `${name}: click to place. Target page ${this.targetPage + 1}/${Math.ceil(this.config.targets.length / 4)}.`,
      glue: 'Glue: click two blocks to bond their position and angle. Unlink removes the bond.',
      rope: 'Rope: click an edge or empty anchor, then a block or target edge. Esc cancels.',
    };
    this.refreshControls();
    this.renderOverlay(this.draft);
    this.say(hints[tool]);
  }

  private cancelLink(): void { this.pending = undefined; this.renderOverlay(this.draft); this.say('Connection cancelled.'); }

  private targetShape(monster: LevelMonster): LevelBlock {
    return { ...monster, ...this.monsterSize(monster.t), m: 'wood', shape: 'rectangle' };
  }

  private entityShape(doc: BuilderDocument, id: string): LevelBlock | undefined {
    return doc.blocks.find(b => b.id === id) ?? doc.monsters.filter(m => m.id === id).map(m => this.targetShape(m))[0];
  }

  private placement(point: Point): LevelBlock {
    const preset = this.config.presets[this.preset];
    const block: LevelBlock = { id: 'preview', m: this.material, x: point.x, y: point.y, w: preset.w, h: preset.h, shape: preset.shape, variant: preset.variant, angle: this.placementAngle, static: false };
    const at = snapBlock(block, point.x, point.y, this.config.grid);
    return { ...block, ...at };
  }

  private updateWarning(doc: BuilderDocument = this.draft): void {
    const count = findDraftOverlaps(doc, this.monsterSize).length;
    setText(this.warning, this, count ? `OVERLAP: ${count} ${count === 1 ? 'pair' : 'pairs'} - Test OK; saving blocked` : '', C('4'));
    this.warning.setVisible(count > 0);
  }

  private requireClear(doc: BuilderDocument): void {
    if (findDraftOverlaps(doc, this.monsterSize).length) throw new Error('Fix the red overlaps first. Test and Play can still try this design.');
  }

  private scaleValue(): number {
    const cell = this.config.grid;
    const fit = Math.min(VIEW.w / (this.config.worldW - this.config.minX), VIEW.h / (this.config.groundY - this.config.minY));
    return Math.max(1, Math.floor(fit * cell)) / cell;
  }
  private offset(): Point {
    const scale = this.scaleValue();
    const width = (this.config.worldW - this.config.minX) * scale;
    const height = (this.config.groundY - this.config.minY) * scale;
    return { x: VIEW.x + Math.round((VIEW.w - width) / 2) - this.config.minX * scale, y: VIEW.y + Math.round((VIEW.h - height) / 2) - this.config.minY * scale };
  }
  private worldPoint(pointer: Phaser.Input.Pointer): Point {
    const offset = this.offset();
    const scale = this.scaleValue();
    return { x: (pointer.x - offset.x) / scale, y: (pointer.y - offset.y) / scale };
  }
  private inside(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= VIEW.x && pointer.x <= VIEW.x + VIEW.w && pointer.y >= VIEW.y && pointer.y <= VIEW.y + VIEW.h;
  }


  private snap(value: number): number { return Math.round(value / this.config.grid) * this.config.grid; }
  private id(prefix: string): string { return `${prefix}_${Date.now().toString(36)}_${(++nextId).toString(36)}`; }
  private error(error: unknown): string { return error instanceof Error ? error.message : 'Could not use this design'; }
  private say(message: string): void {
    let display = message;
    while (textWidth(display) > W - 10 && display.length > 4) display = `${display.slice(0, -4)}...`;
    setText(this.status, this, display, C('c'));
  }

  private selectionAt(point: Point): Selection | undefined {
    for (let i = this.draft.monsters.length - 1; i >= 0; i--) if (pointInBlock(this.targetShape(this.draft.monsters[i]), point)) return { kind: 'monster', index: i };
    for (let i = this.draft.blocks.length - 1; i >= 0; i--) if (pointInBlock(this.draft.blocks[i], point)) return { kind: 'block', id: this.draft.blocks[i].id! };
    return undefined;
  }

  private pointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.running || this.loading || !this.inside(pointer)) return;
    const point = this.worldPoint(pointer);
    if (pointer.rightButtonDown()) { this.rotate(pointer.event.shiftKey ? -45 : 45); return; }
    this.hover = point;
    const hit = this.selectionAt(point);
    if (this.tool === 'select') {
      const inGroup = hit && this.group && (hit.kind === 'block' ? this.group.blocks.has(hit.id) : this.group.monsters.has(hit.index));
      if (inGroup) {
        this.groupDrag = { start: point, preview: cloneDraft(this.draft), valid: true, moved: false };
        this.say('Drag to move the whole group. One Undo restores it.');
        return;
      }
      this.group = undefined;
      this.selection = hit;
      if (!hit) {
        this.marquee = { a: point, b: point };
        this.say('Drag a box around pieces to select them.');
        this.refreshControls();
        this.renderOverlay(this.draft);
        return;
      }
      if (hit) {
        const entity = hit.kind === 'block' ? this.draft.blocks.find((b) => b.id === hit.id)! : this.draft.monsters[hit.index];
        this.drag = { selection: hit, offset: { x: entity.x - point.x, y: entity.y - point.y }, preview: cloneDraft(this.draft), valid: true, moved: false, start: point };
        this.say(hit.kind === 'block' ? 'Block selected. Drag to move; Anchor fixes it in place.' : 'Target selected. Drag to move or Delete.');
      }
      this.refreshControls();
      this.renderOverlay(this.draft);
      return;
    }
    if (this.tool === 'glue' || this.tool === 'rope') { this.connect(point, hit); return; }
    const next = cloneDraft(this.draft);
    if (this.tool === 'piece') {
      const preset = this.config.presets[this.preset];
      const block = { ...this.placement(point), id: this.id('b') };
      next.blocks.push(block);
      try {
        validateDraft(next, this.config, this.monsterSize);
        this.selection = { kind: 'block', id: block.id! };
        this.commit(next, `${preset.name} placed. Test checks balance; Anchor fixes supports.`);
      } catch (error) { this.say(this.error(error)); }
    } else {
      const type = this.config.targets[this.target];
      const size = this.monsterSize(type);
      const at = snapBlock({ m: 'wood', x: point.x, y: point.y, ...size }, point.x, point.y, this.config.grid);
      const monster: LevelMonster = { id: this.id('target'), t: type, ...at };
      next.monsters.push(monster);
      try {
        validateDraft(next, this.config, this.monsterSize);
        this.selection = { kind: 'monster', index: next.monsters.length - 1 };
        this.commit(next, 'Target placed. Select moves targets and blocks.');
      } catch (error) { this.say(this.error(error)); }
    }
  }

  private pointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown && !this.running && !this.loading) {
      const next = this.inside(pointer) ? this.worldPoint(pointer) : undefined;
      if (next?.x !== this.hover?.x || next?.y !== this.hover?.y) { this.hover = next; this.renderOverlay(this.draft); }
    }
    if (this.marquee && pointer.isDown && !this.running && !this.loading) {
      this.marquee.b = this.worldPoint(pointer);
      this.renderOverlay(this.draft);
      return;
    }
    if (this.groupDrag && this.group && pointer.isDown && !this.running && !this.loading) { this.moveGroup(this.worldPoint(pointer)); return; }
    const drag = this.drag;
    if (!drag || this.running || this.loading || !pointer.isDown) return;
    const point = this.worldPoint(pointer);
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 2 && !drag.moved) return;
    drag.moved = true;
    const next = cloneDraft(this.draft);
    const selection = drag.selection;
    const entity = selection.kind === 'block' ? next.blocks.find((b) => b.id === selection.id)! : next.monsters[selection.index];
    if (selection.kind === 'block') {
      const blk = entity as LevelBlock;
      const at = snapBlock(blk, point.x + drag.offset.x, point.y + drag.offset.y, this.config.grid);
      blk.x = at.x;
      blk.y = at.y;
      this.alignPins(next, new Set([selection.id]));
    } else {
      entity.x = this.snap(point.x + drag.offset.x);
      entity.y = this.snap(point.y + drag.offset.y);
    }
    try {
      validateDraft(next, this.config, this.monsterSize);
      drag.preview = next;
      drag.valid = true;
      this.renderWorld(next);
      this.say('Release to place. One Undo restores this move.');
    } catch (error) { drag.valid = false; this.say(`${this.error(error)}. Release restores the original position.`); }
  }

  private moveGroup(point: Point): void {
    const gd = this.groupDrag!;
    const group = this.group!;
    if (Math.hypot(point.x - gd.start.x, point.y - gd.start.y) < 2 && !gd.moved) return;
    gd.moved = true;
    const dx = this.snap(point.x - gd.start.x);
    const dy = this.snap(point.y - gd.start.y);
    const next = cloneDraft(this.draft);
    for (const b of next.blocks) if (group.blocks.has(b.id!)) { b.x += dx; b.y += dy; }
    next.monsters.forEach((m, i) => { if (group.monsters.has(i)) { m.x += dx; m.y += dy; } });
    this.alignPins(next, group.blocks);
    try {
      validateDraft(next, this.config, this.monsterSize);
      gd.preview = next;
      gd.valid = true;
      this.renderWorld(next);
      this.say('Release to place the group. One Undo restores this move.');
    } catch (error) { gd.valid = false; this.say(`${this.error(error)}. Release restores the original positions.`); }
  }



  private finishMarquee(): void {
    const m = this.marquee!;
    this.marquee = undefined;
    const x0 = Math.min(m.a.x, m.b.x), x1 = Math.max(m.a.x, m.b.x), y0 = Math.min(m.a.y, m.b.y), y1 = Math.max(m.a.y, m.b.y);
    const inBox = (p: Point): boolean => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    const blocks = this.draft.blocks.filter(inBox).map((b) => b.id!);
    const monsters = this.draft.monsters.map((mon, i) => (inBox(mon) ? i : -1)).filter((i) => i >= 0);
    const total = blocks.length + monsters.length;
    if (total === 1) this.selection = blocks.length ? { kind: 'block', id: blocks[0] } : { kind: 'monster', index: monsters[0] };
    else if (total > 1) { this.selection = undefined; this.group = { blocks: new Set(blocks), monsters: new Set(monsters) }; }
    this.say(total > 1 ? `${total} pieces selected. Drag one to move them all. Delete and Anchor apply to all.` : total === 1 ? 'One piece selected.' : 'Nothing in that box. Drag a bigger box around pieces.');
    this.refreshControls();
    this.renderOverlay(this.draft);
  }

  private pointerUp(): void {
    if (this.marquee) { this.finishMarquee(); return; }
    const gd = this.groupDrag;
    if (gd) {
      this.groupDrag = undefined;
      if (gd.moved && gd.valid) this.commit(gd.preview, 'Group moved');
      else if (gd.moved) this.renderWorld();
      return;
    }
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    if (drag.moved && drag.valid) this.commit(drag.preview, 'Piece moved');
    else if (drag.moved) this.renderWorld();
  }

  private overlaps(block: LevelBlock, skip?: string): boolean {
    return this.draft.blocks.some(b => b.id !== skip && blocksOverlap(block, b)) || this.draft.monsters.some(m => blocksOverlap(block, this.targetShape(m)));
  }

  private targetOverlaps(monster: LevelMonster, skip?: number): boolean {
    const block = this.targetShape(monster);
    return this.draft.blocks.some(b => blocksOverlap(block, b)) || this.draft.monsters.some((m, i) => i !== skip && blocksOverlap(block, this.targetShape(m)));
  }

  private connect(point: Point, hit?: Selection): void {
    const id = hit?.kind === 'block' ? hit.id : hit ? this.draft.monsters[hit.index].id! : null;
    const shape = id ? this.entityShape(this.draft, id)! : undefined;
    const local = shape ? closestBlockPoint(shape, point) : { x: this.snap(point.x), y: this.snap(point.y) };
    if (this.tool === 'glue' && hit?.kind !== 'block') { this.say('Glue joins blocks. Click a block edge first.'); return; }
    if (!this.pending) {
      this.pending = { id, point: local };
      this.say(this.tool === 'glue' ? 'First block picked. Click another block to glue them.' : 'Rope start picked. Click a block or target edge for the other end.');
      this.renderOverlay(this.draft);
      return;
    }
    if (!id) { this.say('Finish on a block or target edge. Esc cancels the rope.'); return; }
    const source = this.pending;
    if (source.id === id) { this.say('Choose a different piece for the other end.'); return; }
    const type = this.tool === 'glue' ? 'lock' : 'rope';
    const samePoint = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
    if (this.draft.connections.some(c => c.type === type && (
      c.a === source.id && c.b === id && samePoint(c.pointA, source.point) && samePoint(c.pointB, local) ||
      c.a === id && c.b === source.id && samePoint(c.pointB, source.point) && samePoint(c.pointA, local)))) {
      this.say('Those attachment points are already linked.'); return;
    }
    const next = cloneDraft(this.draft);
    next.connections.push({ id: this.id('c'), type, a: source.id, b: id, pointA: source.point, pointB: local });
    try {
      validateDraft(next, this.config, this.monsterSize);
      this.pending = undefined;
      this.commit(next, type === 'lock' ? 'Blocks glued. Unlink removes the bond.' : 'Rope attached edge to edge. Test lets it hang and swing.');
    } catch (error) { this.say(this.error(error)); }
  }

  private alignPins(doc: BuilderDocument, ids: Set<string>): void {
    for (const link of doc.connections) {
      if (link.type !== 'pin' || link.a !== null || !ids.has(link.b)) continue;
      link.pointA = localToWorld(doc.blocks.find(b => b.id === link.b)!, link.pointB);
    }
  }

  private pinWheel(): void {
    if (this.running || this.loading) return;
    const selected = this.selection;
    const block = selected?.kind === 'block' ? this.draft.blocks.find(b => b.id === selected.id) : undefined;
    if (!block?.variant?.startsWith('wheel')) { this.say('Select a wheel, then Pin fixes its hub while allowing rotation.'); return; }
    const next = cloneDraft(this.draft);
    const pinned = next.connections.some(c => c.type === 'pin' && c.b === block.id);
    if (pinned) next.connections = next.connections.filter(c => c.type !== 'pin' || c.b !== block.id);
    else {
      const hub = { x: block.variant === 'wheel' ? 0 : -block.w / 2 + block.h / 2, y: 0 };
      next.blocks.find(b => b.id === block.id)!.static = false;
      next.connections.push({ id: this.id('pin'), type: 'pin', a: null, b: block.id!, pointA: localToWorld(block, hub), pointB: hub });
    }
    this.commit(next, pinned ? 'Wheel unpinned.' : 'Hub pinned: the wheel and its arm can spin. Test to try it.');
  }

  private rotateKey(event: KeyboardEvent): void { this.rotate(event.shiftKey ? -45 : 45); }

  private rotate(delta: number): void {
    if (this.running || this.loading) return;
    const selected = this.selection;
    if (selected?.kind !== 'block') {
      if (this.tool === 'piece') {
        this.placementAngle = ((this.placementAngle + delta) % 360 + 360) % 360;
        this.renderOverlay(this.draft);
        this.say(`Placement rotated to ${this.placementAngle} degrees. Click to place.`);
      } else this.say('Select a block, or choose a piece to rotate its placement preview.');
      return;
    }
    const next = cloneDraft(this.draft);
    const block = next.blocks.find(b => b.id === selected.id)!;
    const before = blockBounds(block);
    block.angle = (((block.angle ?? 0) + delta) % 360 + 360) % 360;
    const after = blockBounds(block);
    block.x += before.l - after.l;
    block.y += before.t - after.t;
    this.alignPins(next, new Set([selected.id]));
    try { this.commit(next, `Rotated to ${block.angle} degrees`); }
    catch (error) { this.say(this.error(error)); }
  }

  private anchor(): void {
    if (this.running || this.loading) return;
    if (this.group) {
      const next = cloneDraft(this.draft);
      const members = next.blocks.filter((b) => this.group!.blocks.has(b.id!));
      const fix = members.some((b) => !b.static);
      for (const b of members) b.static = fix;
      this.commit(next, fix ? 'Group anchored.' : 'Group freed.');
      return;
    }
    const selected = this.selection;
    if (selected?.kind !== 'block') { this.say('Select a block to anchor or free it.'); return; }
    const next = cloneDraft(this.draft);
    const block = next.blocks.find((b) => b.id === selected.id)!;
    block.static = !block.static;
    this.commit(next, block.static ? 'Anchored: this support stays fixed during play.' : 'Free: this piece responds to gravity.');
  }

  private deleteSelection(): void {
    if (this.running || this.loading) return;
    if (!this.selection && !this.group) { this.say('Select a block or target to delete it.'); return; }
    const next = cloneDraft(this.draft);
    const ids = this.selectedIds();
    next.blocks = next.blocks.filter(b => !ids.has(b.id!));
    next.monsters = next.monsters.filter(m => !ids.has(m.id!));
    next.connections = next.connections.filter(c => !(c.a && ids.has(c.a)) && !ids.has(c.b));
    this.selection = undefined;
    this.group = undefined;
    this.pending = undefined;
    this.commit(next, 'Deleted. Undo restores pieces and their connections.');
  }

  private selectedIds(): Set<string> {
    if (this.group) return new Set([...this.group.blocks, ...[...this.group.monsters].map(i => this.draft.monsters[i].id!)]);
    const selected = this.selection;
    return new Set(selected ? [selected.kind === 'block' ? selected.id : this.draft.monsters[selected.index].id!] : []);
  }

  private unlink(): void {
    if (this.running || this.loading) return;
    const ids = this.selectedIds();
    if (!ids.size) { this.say('Select blocks or targets to remove their glue, pins and ropes.'); return; }
    const next = cloneDraft(this.draft);
    next.connections = next.connections.filter(c => !(c.a && ids.has(c.a)) && !ids.has(c.b));
    this.pending = undefined;
    this.commit(next, 'Connections removed from the selection.');
  }

  private clearAll(): void {
    if (this.running || this.loading) return;
    if (!this.draft.blocks.length && !this.draft.monsters.length) { this.say('The grid is already empty.'); return; }
    const next = cloneDraft(this.draft);
    next.blocks = [];
    next.monsters = [];
    next.connections = [];
    this.selection = undefined;
    this.group = undefined;
    this.pending = undefined;
    this.commit(next, 'Cleared. Undo brings everything back.');
  }

  private publish(): void {
    if (this.running || this.loading) return;
    try {
      const safe = validateDraft(this.draft, this.config, this.monsterSize);
      this.requireClear(safe);
      if (!safe.monsters.length) { this.say('Add at least one Target before sharing a challenge.'); return; }
      if (!safe.blocks.length) { this.say('Build a structure before sharing a challenge.'); return; }
      void this.save(false);
      goTo(this, 'challengeWeapons', { mode: 'publish', doc: safe });
    } catch (error) { this.say(this.error(error)); }
  }

  private commit(value: unknown, message: string): void {
    if (this.running || this.loading) return;
    const next = validateDraft(value, this.config, this.monsterSize);
    if (JSON.stringify(next) !== JSON.stringify(this.draft)) {
      this.past.push(cloneDraft(this.draft));
      if (this.past.length > 50) this.past.shift();
      this.future = [];
      this.draft = next;
    }
    currentDraft = cloneDraft(this.draft);
    this.renderWorld();
    this.refreshControls();
    this.say(message);
    void this.save(false);
  }

  private history(redo: boolean): void {
    if (this.running || this.loading) return;
    const source = redo ? this.future : this.past;
    const target = redo ? this.past : this.future;
    const next = source.pop();
    if (!next) return;
    target.push(cloneDraft(this.draft));
    this.draft = next;
    currentDraft = cloneDraft(next);
    this.selection = undefined;
    this.group = undefined;
    this.pending = undefined;
    this.renderWorld();
    this.refreshControls();
    this.say(redo ? 'Redone' : 'Undone');
    void this.save(false);
  }

  private async save(explicit: boolean): Promise<boolean> {
    if (this.running || this.loading) return false;
    const generation = this.restoreGeneration;
    try {
      const safe = validateDraft(this.draft, this.config, this.monsterSize);
      currentDraft = cloneDraft(safe);
      this.requireClear(safe);
      const captured = JSON.stringify(safe);
      const pending = saveQueue.then(() => platform.storage.set(STORAGE_KEY, captured));
      saveQueue = pending.catch(() => {});
      if (explicit) this.say('Saving draft...');
      await pending;
      if (explicit && generation === this.restoreGeneration && this.scene.isActive()) this.say('Draft saved. Export keeps a portable copy.');
      return true;
    } catch (error) {
      if (explicit && generation === this.restoreGeneration && this.scene.isActive()) this.say(`Not saved: ${this.error(error)}`);
      return false;
    }
  }

  private exportFile(): void {
    if (this.running || this.loading) return;
    try {
      const safe = validateDraft(this.draft, this.config, this.monsterSize);
      this.requireClear(safe);
      const url = URL.createObjectURL(new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' }));
      this.exportUrls.add(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safe.name.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'my_level'}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => { URL.revokeObjectURL(url); this.exportUrls.delete(url); }, 1000);
      this.say('Exported. Import the JSON file to continue building on another device.');
    } catch (error) { this.say(this.error(error)); }
  }

  private importFile(): void {
    if (this.running || this.loading) return;
    this.importInput?.remove();
    const input = document.createElement('input');
    this.importInput = input;
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      try {
        if (!file) return;
        if (file.size > FILE_LIMIT) throw new Error('File is too large; maximum 100 KB');
        const raw: unknown = JSON.parse(await file.text());
        const safe = validateDraft(raw, this.config, this.monsterSize);
        if (!this.scene.isActive() || this.running || this.loading) return;
        this.selection = undefined;
        this.group = undefined;
        this.pending = undefined;
        this.commit(safe, 'Imported. Undo returns to the previous design.');
      } catch (error) { if (this.scene.isActive()) this.say(`Import failed: ${this.error(error)}`); }
      finally { input.remove(); if (this.importInput === input) this.importInput = undefined; }
    }, { once: true });
    input.click();
  }

  private play(): void {
    if (this.running || this.loading) return;
    try {
      const level = toLevel(this.draft, this.config, this.monsterSize);
      if (!level.monsters.length) { this.say('Add at least one Target before Play. Test can check an empty structure.'); return; }
      void this.save(false);
      goTo(this, 'game', { level: 1000, loadout: this.config.loadout.slice(), customLevel: level });
    } catch (error) { this.say(this.error(error)); }
  }

  private refreshControls(): void {
    const editable = !this.running && !this.loading;
    for (const btn of this.editButtons) btn.setEnabled(editable);
    const overlaps = findDraftOverlaps(this.draft, this.monsterSize).length;
    for (const btn of this.releaseButtons) btn.setEnabled(editable && overlaps === 0);
    this.undoButton.setEnabled(editable && this.past.length > 0);
    this.redoButton.setEnabled(editable && this.future.length > 0);
    this.testButton.setEnabled(!this.loading);
    this.testButton.setLabel(this.running ? 'Stop' : 'Test');
    const block = this.selection?.kind === 'block' ? this.draft.blocks.find(b => b.id === (this.selection as { id: string }).id) : undefined;
    this.anchorButton.setLabel(block?.static ? 'Free' : 'Anchor');
    this.pinButton.setEnabled(editable && !!block?.variant?.startsWith('wheel'));
    this.pinButton.setLabel(block && this.draft.connections.some(c => c.type === 'pin' && c.b === block.id) ? 'Unpin' : 'Pin');
    const choices = this.choices();
    this.paletteRows.forEach((btn, row) => {
      const index = choices[row];
      const label = index === undefined ? '' : this.family === 'Targets' ? data.content.monsters.find(m => m.id === this.config.targets[index])?.name ?? this.config.targets[index] : this.config.presets[index].name;
      btn.setLabel(fitText(label, 96));
      btn.box.setVisible(index !== undefined);
      btn.setEnabled(editable && index !== undefined);
      this.paletteMarkers[row].setVisible(index !== undefined && (this.family === 'Targets' ? this.tool === 'target' && this.target === index : this.tool === 'piece' && this.preset === index));
    });
    this.targetPrev.setEnabled(editable && this.family === 'Targets' && this.targetPage > 0);
    this.targetNext.setEnabled(editable && this.family === 'Targets' && (this.targetPage + 1) * 4 < this.config.targets.length);
    for (const { marker, active } of this.activeMarkers) marker.setVisible(active()).setAlpha(editable ? 1 : 0.3);
    this.updateWarning();
  }

  private clearWorld(): void {
    this.links?.destroy();
    this.links = undefined;
    const world = this.matter.world;
    if (world) for (const body of this.bodies) world.remove(body);
    this.bodies = [];
    this.blockBodies = [];
    this.monsterBodies = [];
    this.sprites = [];
    this.worldRoot?.clearMask(true);
    this.worldRoot?.destroy();
    this.clip?.destroy();
    this.clip = undefined;
    this.worldRoot = undefined;
    this.overlay = undefined;
  }

  /** The crisscross grid, drawn once in screen pixels: even cells, a brighter line every 4 cells and an X through each cell. */
  private drawGrid(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(2);
    const scale = this.scaleValue();
    const cell = this.config.grid;
    const px = Math.round(cell * scale);
    const cols = Math.round((this.config.worldW - this.config.minX) / cell);
    const rows = Math.round((this.config.groundY - this.config.minY) / cell);
    const o = this.offset();
    const x0 = Math.round(o.x + this.config.minX * scale);
    const y0 = Math.round(o.y + this.config.minY * scale);
    const w = cols * px, h = rows * px;
    g.fillStyle(C('9'), 1).fillRect(x0, y0, w, h);
    g.fillStyle(C('a'), 0.2);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        for (let k = 1; k < px - 1; k++) {
          g.fillRect(x0 + c * px + k, y0 + r * px + k, 1, 1);
          g.fillRect(x0 + c * px + px - 1 - k, y0 + r * px + k, 1, 1);
        }
      }
    }
    for (let c = 0; c <= cols; c++) g.fillStyle(C(c % 4 === 0 ? 'b' : 'a'), c % 4 === 0 ? 0.6 : 0.4).fillRect(x0 + c * px, y0, 1, h + 1);
    for (let r = 0; r <= rows; r++) g.fillStyle(C((rows - r) % 4 === 0 ? 'b' : 'a'), (rows - r) % 4 === 0 ? 0.6 : 0.4).fillRect(x0, y0 + r * px, w + 1, 1);
    g.fillStyle(C('6'), 1).fillRect(x0, y0 + h - 1, w + 1, 2);
    return g;
  }

  private monsterSize = (type: string): { w: number; h: number } => ({ w: MONSTER_ART[type]?.w ?? 12, h: MONSTER_ART[type]?.h ?? 14 });

  private renderWorld(doc: BuilderDocument = this.running ? settle(this.draft, this.config, this.monsterSize) : this.draft): void {
    this.clearWorld();
    this.updateWarning(this.draft);
    const offset = this.offset();
    const scale = this.scaleValue();
    const root = this.add.container(offset.x, offset.y).setScale(scale).setDepth(3);
    this.worldRoot = root;
    const clip = this.make.graphics({ x: 0, y: 0 }, false);
    clip.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    root.setMask(clip.createGeometryMask());
    this.clip = clip;
    if (!this.gridGfx) this.gridGfx = this.drawGrid();
    ensureBlockTextures(this, doc.blocks);
    for (const block of doc.blocks) {
      const body = createBlockBody(this, block);
      this.blockBodies.push(body);
      this.bodies.push(body);
      const image = this.add.image(block.x, block.y, blockTextureKey(block)).setRotation(body.angle);
      root.add(image);
      this.sprites.push({ body, image });
    }
    for (const monster of doc.monsters) {
      const art = MONSTER_ART[monster.t];
      const def = data.content.monsters.find((m) => m.id === monster.t);
      const body = this.matter.add.rectangle(monster.x, monster.y, art?.w ?? 12, art?.h ?? 14, { density: def?.density ?? 0.001, friction: 0.6, frictionStatic: 1, restitution: 0.05 });
      this.monsterBodies.push(body);
      this.bodies.push(body);
      const image = this.add.image(monster.x, monster.y, monster.t);
      root.add(image);
      this.sprites.push({ body, image });
    }
    const overlay = this.add.graphics();
    root.add(overlay);
    this.overlay = overlay;
    if (this.running) {
      const c = this.config;
      this.bodies.push(this.matter.add.rectangle(c.worldW / 2, c.groundY + 40, c.worldW + 200, 80, { isStatic: true, friction: 1, label: 'ground' }));
      this.bodies.push(this.matter.add.rectangle(c.minX - 10, (c.minY + c.groundY) / 2, 20, c.groundY * 3, { isStatic: true }));
      this.bodies.push(this.matter.add.rectangle(c.worldW + 10, (c.minY + c.groundY) / 2, 20, c.groundY * 3, { isStatic: true }));
      const bodyById = new Map<string, any>([...doc.blocks.map((b, i): [string, any] => [b.id!, this.blockBodies[i]]), ...doc.monsters.map((m, i): [string, any] => [m.id!, this.monsterBodies[i]])]);
      this.links = installConnections(this, bodyById, doc.connections);
      this.links.draw(overlay);
    } else this.renderOverlay(doc);
  }

  private attachment(doc: BuilderDocument, id: string | null, point: Point): Point {
    const entity = id ? this.entityShape(doc, id) : undefined;
    return entity ? localToWorld(entity, point) : point;
  }


  private drawShape(g: Phaser.GameObjects.Graphics, block: LevelBlock, color: number, alpha = 0): void {
    g.save();
    g.translateCanvas(block.x, block.y);
    g.rotateCanvas((block.angle ?? 0) * Math.PI / 180);
    g.lineStyle(1.5 / this.scaleValue(), color, 1);
    g.fillStyle(color, alpha);
    for (const part of blockParts(block)) {
      if (part.kind === 'circle') {
        if (alpha) g.fillCircle(part.x, part.y, part.r);
        g.strokeCircle(part.x, part.y, part.r);
      } else {
        if (alpha) g.fillPoints(part.vertices, true);
        g.strokePoints(part.vertices, true);
      }
    }
    g.restore();
  }

  private renderOverlay(doc: BuilderDocument): void {
    const g = this.overlay;
    if (!g || this.running) return;
    g.clear();
    this.updateWarning(doc);
    const scale = this.scaleValue();
    for (const connection of doc.connections) this.drawConnection(g, doc, connection, scale);
    for (const block of doc.blocks) if (block.static) g.fillStyle(C('4'), 1).fillCircle(block.x, block.y, 2.5 / scale);
    const overlaps = new Set(findDraftOverlaps(doc, this.monsterSize).flatMap(pair => [pair.a, pair.b]));
    for (const block of doc.blocks) if (overlaps.has(block.id!)) this.drawShape(g, block, C('2'), 0.25);
    for (const monster of doc.monsters) if (overlaps.has(monster.id!)) this.drawShape(g, this.targetShape(monster), C('2'), 0.25);
    for (const id of this.selectedIds()) {
      const entity = this.entityShape(doc, id);
      if (entity) this.drawShape(g, entity, C('4'));
    }
    const hover = this.hover;
    if (hover && !this.drag && !this.marquee) {
      const grid = this.config.grid;
      g.lineStyle(1.5 / scale, C('4'), 1).strokeRect(Math.floor(hover.x / grid) * grid, Math.floor(hover.y / grid) * grid, grid, grid);
      if (this.tool === 'piece') {
        const ghost = this.placement(hover);
        let ok = doc.blocks.length < this.config.maxBlocks;
        try { validateDraft({ ...doc, blocks: [ghost], monsters: [], connections: [] }, this.config, this.monsterSize); }
        catch { ok = false; }
        if (this.overlaps(ghost)) ok = false;
        this.drawShape(g, ghost, ok ? C('b') : C('2'), 0.3);
      } else if (this.tool === 'target') {
        const type = this.config.targets[this.target];
        const monster: LevelMonster = { id: 'preview', t: type, x: hover.x, y: hover.y };
        Object.assign(monster, snapBlock(this.targetShape(monster), hover.x, hover.y, grid));
        let ok = doc.monsters.length < this.config.maxMonsters;
        try { validateDraft({ ...doc, blocks: [], monsters: [monster], connections: [] }, this.config, this.monsterSize); }
        catch { ok = false; }
        if (this.targetOverlaps(monster)) ok = false;
        this.drawShape(g, this.targetShape(monster), ok ? C('b') : C('2'), 0.3);
      } else if (this.tool === 'rope' || this.tool === 'glue') {
        const hit = this.selectionAt(hover);
        const id = hit?.kind === 'block' ? hit.id : hit ? doc.monsters[hit.index].id! : null;
        const shape = id ? this.entityShape(doc, id) : undefined;
        const point = shape ? localToWorld(shape, closestBlockPoint(shape, hover)) : { x: this.snap(hover.x), y: this.snap(hover.y) };
        g.fillStyle(C('4')).fillCircle(point.x, point.y, 3 / scale);
        if (this.pending) {
          const from = this.attachment(doc, this.pending.id, this.pending.point);
          g.lineStyle(1 / scale, C('4'), 0.8).lineBetween(from.x, from.y, point.x, point.y);
        }
      }
    }
    if (this.marquee) {
      const { a, b } = this.marquee;
      g.fillStyle(C('4'), 0.15).fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      g.lineStyle(1 / scale, C('4'), 1).strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    }
    if (this.pending) {
      const a = this.attachment(doc, this.pending.id, this.pending.point);
      g.lineStyle(2 / scale, C('4'), 1).strokeCircle(a.x, a.y, 5 / scale);
    }
  }

  private drawConnection(g: Phaser.GameObjects.Graphics, doc: BuilderDocument, connection: LevelConnection, scale: number): void {
    const a = this.attachment(doc, connection.a, connection.pointA);
    const b = this.attachment(doc, connection.b, connection.pointB);
    g.lineStyle(2 / scale, C(connection.type === 'lock' ? '4' : 'i'), 1).lineBetween(a.x, a.y, b.x, b.y);
    if (connection.type === 'lock') g.fillStyle(C('4'), 1).fillRect((a.x + b.x) / 2 - 2 / scale, (a.y + b.y) / 2 - 2 / scale, 4 / scale, 4 / scale);
    if (connection.a === null) g.fillStyle(C('c'), 1).fillCircle(a.x, a.y, 3 / scale);
  }

  update(_time: number, delta: number): void {
    if (!this.running) return;
    const settings = getSettings();
    const stepMs = 1000 / settings.physics.stepHz;
    this.acc += Math.min(delta, 50);
    let count = 0;
    while (this.acc >= stepMs && count < settings.physics.maxStepsPerFrame) {
      this.acc -= stepMs;
      count++;
      this.matter.world.step(stepMs);
    }
    for (const { body, image } of this.sprites) image.setPosition(body.position.x, body.position.y).setRotation(body.angle);
    this.overlay?.clear();
    if (this.overlay) this.links?.draw(this.overlay);
  }
}
