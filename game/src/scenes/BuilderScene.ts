import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, setText, textWidth } from '../art/font5x7';
import { MONSTER_ART } from '../art/textures';
import { MatterLib } from '../battle/matter';
import { cloneDraft, newDraft, toLevel, validateDraft, type BuilderDocument } from '../builder/document';
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
type Tool = 'piece' | 'select' | 'target' | 'lock' | 'rope';
type Selection = { kind: 'block'; id: string } | { kind: 'monster'; index: number };
type Point = { x: number; y: number };
interface Drag { selection: Selection; offset: Point; preview: BuilderDocument; valid: boolean; moved: boolean; start: Point }

/** A paused authoring view; only Test advances its isolated Matter world. */
export default class BuilderScene extends Phaser.Scene {
  private config!: BuilderConfig;
  private draft = newDraft();
  private past: BuilderDocument[] = [];
  private future: BuilderDocument[] = [];
  private tool: Tool = 'piece';
  private preset = 0;
  private material = 'wood';
  private selection?: Selection;
  private pending?: { block: string | null; point: Point };
  private drag?: Drag;
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
  private testButton!: Btn;
  private editButtons: Btn[] = [];
  private undoButton!: Btn;
  private redoButton!: Btn;
  private anchorButton!: Btn;
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
    this.tool = 'piece';
    this.preset = 0;
    this.material = this.config.materials[0];
    this.editButtons = [];
    this.activeMarkers = [];
    this.draft = newDraft();
    let message = this.loading ? 'Loading your saved design...' : 'Draft restored. Select to move; Lock joins blocks; Rope hangs them.';
    try {
      if (currentDraft) this.draft = validateDraft(currentDraft, this.config);
    } catch { message = 'Saved draft could not be read. A new empty design is ready.'; }
    this.cameras.main.setBackgroundColor(C('f'));
    this.add.rectangle(W / 2, H / 2, W, H, C('f'));
    this.add.rectangle(56, 130, 112, 200, C('8'));
    this.add.rectangle(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2, VIEW.w, VIEW.h, C('9'));
    this.status = text(this, 5, 261, '', C('c')).setOrigin(0, 0.5).setDepth(20);
    this.buildControls();
    this.renderWorld();
    this.say(message);
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', this.pointerUp, this);
    this.events.once('shutdown', () => {
      this.restoreGeneration++;
      this.input.off('pointerdown', this.pointerDown, this);
      this.input.off('pointermove', this.pointerMove, this);
      this.input.off('pointerup', this.pointerUp, this);
      this.input.off('pointerupoutside', this.pointerUp, this);
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
        restored = validateDraft(JSON.parse(json), this.config);
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
    const safe = validateDraft(value, this.config);
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
    this.say(on ? 'Physics test - Stop restores your design' : 'Design restored. Keep building or Play with a slingshot.');
  }

  private buildControls(): void {
    const button = (x: number, y: number, w: number, label: string, action: () => void, kind: 'plain' | 'go' = 'plain'): Btn => {
      const btn = makeButton(this, x, y, w, 24, label, kind, action, 12);
      return btn;
    };
    button(25, 15, 42, 'Home', () => goTo(this, 'title'));
    this.undoButton = button(77, 15, 48, 'Undo', () => this.history(false));
    this.redoButton = button(131, 15, 48, 'Redo', () => this.history(true));
    this.testButton = button(202, 15, 76, 'Test', () => this.simulate(!this.running), 'go');
    const play = button(286, 15, 72, 'Play', () => this.play(), 'go');
    const save = button(366, 15, 64, 'Save', () => { void this.save(true); });
    const exportBtn = button(437, 15, 66, 'Export', () => this.exportFile());
    this.editButtons.push(play, save, exportBtn);
    text(this, 56, 38, 'BLOCKS', C('4')).setDepth(12);
    const names = ['Short', 'Plank', 'Beam', 'Post', 'Square', 'Brick', 'Ball', 'Wedge'];
    this.config.presets.forEach((preset, i) => {
      const x = i % 2 ? 84 : 28;
      const y = 60 + Math.floor(i / 2) * 27;
      const btn = button(x, y, 48, names[i] ?? preset.name, () => this.choose('piece', i));
      this.editButtons.push(btn);
      const marker = this.add.rectangle(x, y, 50, 26).setStrokeStyle(1, C('4')).setFillStyle(C('4'), 0).setDepth(14);
      this.activeMarkers.push({ marker, active: () => this.tool === 'piece' && this.preset === i });
      const swatch = this.add.graphics().setDepth(15);
      const col = C('i');
      swatch.fillStyle(col, 1);
      if (preset.shape === 'circle') swatch.fillCircle(x - 18, y - 8, 2);
      else if (preset.shape === 'triangle') swatch.fillTriangle(x - 21, y - 6, x - 15, y - 6, x - 18, y - 11);
      else swatch.fillRect(x - 22, y - 10, 8, 3);
    });
    text(this, 56, 158, 'MATERIAL', C('4')).setDepth(12);
    this.config.materials.forEach((material, i) => {
      const x = i % 2 ? 84 : 28;
      const y = 177 + Math.floor(i / 2) * 27;
      const btn = button(x, y, 48, material.charAt(0).toUpperCase() + material.slice(1), () => {
        if (this.running || this.loading) return;
        this.material = material;
        this.refreshControls();
        this.say(`${material} selected. New pieces use this material.`);
      });
      this.editButtons.push(btn);
      const marker = this.add.rectangle(x, y, 50, 26).setStrokeStyle(1, C('b')).setFillStyle(C('b'), 0).setDepth(14);
      this.activeMarkers.push({ marker, active: () => this.material === material });
    });
    const tools: [Tool, string, number][] = [['select', 'Select', 25], ['target', 'Target', 77], ['lock', 'Lock', 129], ['rope', 'Rope', 181]];
    for (const [tool, label, x] of tools) {
      this.editButtons.push(button(x, 243, 48, label, () => this.choose(tool)));
      const marker = this.add.rectangle(x, 243, 50, 26).setStrokeStyle(1, C('4')).setFillStyle(C('4'), 0).setDepth(14);
      this.activeMarkers.push({ marker, active: () => this.tool === tool });
    }
    this.editButtons.push(button(233, 243, 48, 'Rotate', () => this.rotate()));
    this.anchorButton = button(285, 243, 48, 'Anchor', () => this.anchor());
    this.editButtons.push(this.anchorButton);
    this.editButtons.push(button(337, 243, 48, 'Delete', () => this.deleteSelection()));
    this.editButtons.push(button(389, 243, 48, 'Unlink', () => this.unlink()));
    this.editButtons.push(button(445, 243, 54, 'Import', () => this.importFile()));
    this.refreshControls();
  }

  private choose(tool: Tool, preset?: number): void {
    if (this.running || this.loading) return;
    this.tool = tool;
    if (preset !== undefined) this.preset = preset;
    this.pending = undefined;
    const hints: Record<Tool, string> = {
      piece: `${this.config.presets[this.preset].name}: tap the grid to place. Select moves pieces.`,
      select: 'Select a block or target; drag to move. Rotate, Anchor, Delete or Unlink below.',
      target: 'Tap the grid to place a target. A playable level needs at least one.',
      lock: 'Lock: tap one block, then another. The pair keeps its shape.',
      rope: 'Rope: tap a block or an empty anchor point, then tap the block to hang.',
    };
    this.refreshControls();
    this.renderOverlay(this.draft);
    this.say(hints[tool]);
  }

  private scaleValue(): number { return Math.min(VIEW.w / (this.config.worldW - this.config.minX), VIEW.h / (this.config.groundY - this.config.minY)); }
  private offset(): Point {
    const scale = this.scaleValue();
    return { x: VIEW.x - this.config.minX * scale, y: VIEW.y + (VIEW.h - (this.config.groundY - this.config.minY) * scale) / 2 - this.config.minY * scale };
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
    for (let i = this.monsterBodies.length - 1; i >= 0; i--) if (MatterLib.Query.point([this.monsterBodies[i]], point).length) return { kind: 'monster', index: i };
    for (let i = this.blockBodies.length - 1; i >= 0; i--) if (MatterLib.Query.point([this.blockBodies[i]], point).length) return { kind: 'block', id: this.draft.blocks[i].id! };
    return undefined;
  }

  private pointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.running || this.loading || !this.inside(pointer)) return;
    const point = this.worldPoint(pointer);
    const hit = this.selectionAt(point);
    if (this.tool === 'select') {
      this.selection = hit;
      if (hit) {
        const entity = hit.kind === 'block' ? this.draft.blocks.find((b) => b.id === hit.id)! : this.draft.monsters[hit.index];
        this.drag = { selection: hit, offset: { x: entity.x - point.x, y: entity.y - point.y }, preview: cloneDraft(this.draft), valid: true, moved: false, start: point };
        this.say(hit.kind === 'block' ? 'Block selected. Drag to move; Anchor fixes it in place.' : 'Target selected. Drag to move or Delete.');
      } else this.say('Tap a block or target to select it.');
      this.refreshControls();
      this.renderOverlay(this.draft);
      return;
    }
    if (this.tool === 'lock' || this.tool === 'rope') { this.connect(point, hit); return; }
    if (hit) { this.say('Choose Select to move this piece. Place new pieces in open space.'); return; }
    const next = cloneDraft(this.draft);
    if (this.tool === 'piece') {
      const preset = this.config.presets[this.preset];
      const block: LevelBlock = { id: this.id('b'), m: this.material, x: this.snap(point.x), y: this.snap(point.y), w: preset.w, h: preset.h, shape: preset.shape, angle: 0, static: false };
      next.blocks.push(block);
      try {
        validateDraft(next, this.config);
        if (this.overlaps(block)) throw new Error('Pieces overlap');
        this.selection = { kind: 'block', id: block.id! };
        this.commit(next, `${preset.name} placed. Test checks balance; Anchor fixes supports.`);
      } catch (error) { this.say(this.error(error)); }
    } else {
      const monster: LevelMonster = { t: 'goblin_grunt', x: this.snap(point.x), y: Math.min(this.config.groundY - 7, this.snap(point.y)) };
      next.monsters.push(monster);
      try {
        validateDraft(next, this.config);
        if (this.targetOverlaps(monster)) throw new Error('Pieces overlap');
        this.selection = { kind: 'monster', index: next.monsters.length - 1 };
        this.commit(next, 'Target placed. Select moves targets and blocks.');
      } catch (error) { this.say(this.error(error)); }
    }
  }

  private pointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag || this.running || this.loading || !pointer.isDown) return;
    const point = this.worldPoint(pointer);
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 2 && !drag.moved) return;
    drag.moved = true;
    const next = cloneDraft(this.draft);
    const selection = drag.selection;
    const entity = selection.kind === 'block' ? next.blocks.find((b) => b.id === selection.id)! : next.monsters[selection.index];
    entity.x = this.snap(point.x + drag.offset.x);
    entity.y = this.snap(point.y + drag.offset.y);
    try {
      validateDraft(next, this.config);
      const overlaps = selection.kind === 'block' ? this.overlaps(entity as LevelBlock, selection.id) : this.targetOverlaps(entity as LevelMonster, selection.index);
      if (overlaps) throw new Error('Pieces overlap');
      drag.preview = next;
      drag.valid = true;
      this.renderWorld(next);
      this.say('Release to place. One Undo restores this move.');
    } catch (error) { drag.valid = false; this.say(`${this.error(error)}. Release restores the original position.`); }
  }

  private pointerUp(): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    if (drag.moved && drag.valid) this.commit(drag.preview, 'Piece moved');
    else if (drag.moved) this.renderWorld();
  }

  private overlaps(block: LevelBlock, skip?: string): boolean {
    const candidate = createBlockBody(this, block);
    try {
      const others = [...this.blockBodies.filter((_body, i) => this.draft.blocks[i].id !== skip), ...this.monsterBodies];
      return MatterLib.Query.collides(candidate, others).some((collision: any) => collision.depth > 0.25);
    } finally { this.matter.world.remove(candidate); }
  }

  private targetOverlaps(monster: LevelMonster, skip?: number): boolean {
    const art = MONSTER_ART[monster.t];
    const candidate = this.matter.add.rectangle(monster.x, monster.y, art?.w ?? 12, art?.h ?? 14, { isStatic: true });
    try {
      return MatterLib.Query.collides(candidate, [...this.blockBodies, ...this.monsterBodies.filter((_body, i) => i !== skip)]).some((collision: any) => collision.depth > 0.25);
    } finally { this.matter.world.remove(candidate); }
  }

  private connect(point: Point, hit?: Selection): void {
    const blockId = hit?.kind === 'block' ? hit.id : null;
    if (!this.pending) {
      if (this.tool === 'lock' && blockId === null) { this.say('Lock starts on a block. Tap the first plank.'); return; }
      if (hit?.kind === 'monster') { this.say('Connections attach to blocks. Choose a block or empty anchor point.'); return; }
      this.pending = { block: blockId, point: blockId ? { x: 0, y: 0 } : { x: this.snap(point.x), y: this.snap(point.y) } };
      this.say(this.tool === 'lock' ? 'First block selected. Tap the second block to lock them.' : 'Rope start selected. Tap the block you want to hang.');
      this.renderOverlay(this.draft);
      return;
    }
    if (!blockId) { this.say('The second connection point must be on a block.'); return; }
    const source = this.pending;
    if (source.block === blockId) { this.say('Choose a different block for the other end.'); return; }
    const duplicate = this.draft.connections.some((c) => c.type === this.tool && ((c.a === source.block && c.b === blockId) || (c.a === blockId && c.b === source.block)) && (source.block !== null || (c.pointA.x === source.point.x && c.pointA.y === source.point.y)));
    if (duplicate) { this.say('Those pieces already have this connection.'); return; }
    const next = cloneDraft(this.draft);
    next.connections.push({ id: this.id('c'), type: this.tool as 'lock' | 'rope', a: source.block, b: blockId, pointA: source.point, pointB: { x: 0, y: 0 } });
    try {
      validateDraft(next, this.config);
      this.pending = undefined;
      this.commit(next, this.tool === 'lock' ? 'Blocks locked. Test checks the frame.' : 'Rope attached. Test lets it hang and swing.');
    } catch (error) { this.say(this.error(error)); }
  }

  private rotate(): void {
    if (this.running || this.loading) return;
    const selected = this.selection;
    if (selected?.kind !== 'block') { this.say('Select a block to rotate it.'); return; }
    const next = cloneDraft(this.draft);
    const block = next.blocks.find((b) => b.id === selected.id)!;
    block.angle = ((block.angle ?? 0) + 15 + 360) % 360;
    try {
      validateDraft(next, this.config);
      if (this.overlaps(block, block.id)) throw new Error('Pieces overlap');
      this.commit(next, `Rotated to ${block.angle} degrees`);
    } catch (error) { this.say(this.error(error)); }
  }

  private anchor(): void {
    if (this.running || this.loading) return;
    const selected = this.selection;
    if (selected?.kind !== 'block') { this.say('Select a block to anchor or free it.'); return; }
    const next = cloneDraft(this.draft);
    const block = next.blocks.find((b) => b.id === selected.id)!;
    block.static = !block.static;
    this.commit(next, block.static ? 'Anchored: this support stays fixed during play.' : 'Free: this piece responds to gravity.');
  }

  private deleteSelection(): void {
    if (this.loading) return;
    if (this.running || !this.selection) { this.say('Select a block or target to delete it.'); return; }
    const selected = this.selection;
    const next = cloneDraft(this.draft);
    if (selected.kind === 'block') {
      next.blocks = next.blocks.filter((b) => b.id !== selected.id);
      next.connections = next.connections.filter((c) => c.a !== selected.id && c.b !== selected.id);
    } else next.monsters.splice(selected.index, 1);
    this.selection = undefined;
    this.pending = undefined;
    this.commit(next, 'Deleted. Undo restores the piece and its connections.');
  }

  private unlink(): void {
    if (this.running || this.loading) return;
    const selected = this.selection;
    if (selected?.kind !== 'block') { this.say('Select a block to remove its locks and ropes.'); return; }
    const next = cloneDraft(this.draft);
    next.connections = next.connections.filter((c) => c.a !== selected.id && c.b !== selected.id);
    this.commit(next, 'Connections removed from the selected block');
  }

  private commit(value: unknown, message: string): void {
    if (this.running || this.loading) return;
    const next = validateDraft(value, this.config);
    if (JSON.stringify(next) !== JSON.stringify(this.draft)) {
      this.past.push(cloneDraft(this.draft));
      if (this.past.length > 50) this.past.shift();
      this.future = [];
      this.draft = next;
    }
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
    this.selection = undefined;
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
      const safe = validateDraft(this.draft, this.config);
      currentDraft = cloneDraft(safe);
      const captured = JSON.stringify(safe);
      const pending = saveQueue.then(() => platform.storage.set(STORAGE_KEY, captured));
      saveQueue = pending.catch(() => {});
      if (explicit) this.say('Saving draft...');
      await pending;
      if (explicit && generation === this.restoreGeneration && this.scene.isActive()) this.say('Draft saved. Export keeps a portable copy.');
      return true;
    } catch (error) {
      if (generation === this.restoreGeneration && this.scene.isActive()) this.say(`Save unavailable: ${this.error(error)}. Draft kept for this session; Export to keep a copy.`);
      return false;
    }
  }

  private exportFile(): void {
    if (this.running || this.loading) return;
    try {
      const safe = validateDraft(this.draft, this.config);
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
        const safe = validateDraft(raw, this.config);
        if (!this.scene.isActive() || this.running || this.loading) return;
        this.selection = undefined;
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
      const level = toLevel(this.draft, this.config);
      if (!level.monsters.length) { this.say('Add at least one Target before Play. Test can check an empty structure.'); return; }
      void this.save(false);
      goTo(this, 'game', { level: 1000, loadout: this.config.loadout.slice(), customLevel: level });
    } catch (error) { this.say(this.error(error)); }
  }

  private refreshControls(): void {
    for (const btn of this.editButtons) btn.setEnabled(!this.running && !this.loading);
    this.undoButton.setEnabled(!this.running && !this.loading && this.past.length > 0);
    this.redoButton.setEnabled(!this.running && !this.loading && this.future.length > 0);
    this.testButton.setEnabled(!this.loading);
    this.testButton.setLabel(this.running ? 'Stop' : 'Test');
    const selected = this.selection;
    const anchored = selected?.kind === 'block' && this.draft.blocks.find((b) => b.id === selected.id)?.static;
    this.anchorButton.setLabel(anchored ? 'Free' : 'Anchor');
    for (const { marker, active } of this.activeMarkers) marker.setVisible(active()).setAlpha(this.running || this.loading ? 0.3 : 1);
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

  private renderWorld(doc: BuilderDocument = this.draft): void {
    this.clearWorld();
    const offset = this.offset();
    const scale = this.scaleValue();
    const root = this.add.container(offset.x, offset.y).setScale(scale).setDepth(3);
    this.worldRoot = root;
    const clip = this.make.graphics({ x: 0, y: 0 }, false);
    clip.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    root.setMask(clip.createGeometryMask());
    this.clip = clip;
    const grid = this.add.graphics();
    root.add(grid);
    grid.fillStyle(C('9'), 1).fillRect(this.config.minX, this.config.minY, this.config.worldW - this.config.minX, this.config.groundY - this.config.minY);
    grid.lineStyle(0.5 / scale, C('a'), 0.25);
    for (let x = this.config.minX; x <= this.config.worldW; x += this.config.grid) grid.lineBetween(x, this.config.minY, x, this.config.groundY);
    for (let y = this.config.minY; y <= this.config.groundY; y += this.config.grid) grid.lineBetween(this.config.minX, y, this.config.worldW, y);
    grid.lineStyle(1 / scale, C('b'), 1).strokeRect(this.config.minX, this.config.minY, this.config.worldW - this.config.minX, this.config.groundY - this.config.minY);
    grid.lineStyle(3 / scale, C('6'), 1).lineBetween(this.config.minX, this.config.groundY, this.config.worldW, this.config.groundY);
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
      this.links = installConnections(this, doc.blocks, this.blockBodies, doc.connections);
      this.links.draw(overlay);
    } else this.renderOverlay(doc);
  }

  private attachment(doc: BuilderDocument, id: string | null, point: Point): Point {
    if (id === null) return point;
    const block = doc.blocks.find((b) => b.id === id)!;
    const angle = (block.angle ?? 0) * Math.PI / 180;
    return { x: block.x + Math.cos(angle) * point.x - Math.sin(angle) * point.y, y: block.y + Math.sin(angle) * point.x + Math.cos(angle) * point.y };
  }

  private renderOverlay(doc: BuilderDocument): void {
    const g = this.overlay;
    if (!g || this.running) return;
    g.clear();
    const scale = this.scaleValue();
    for (const connection of doc.connections) this.drawConnection(g, doc, connection, scale);
    for (const block of doc.blocks) if (block.static) g.fillStyle(C('4'), 1).fillCircle(block.x, block.y, 2.5 / scale);
    const selected = this.selection;
    if (selected) {
      const block = selected.kind === 'block' ? doc.blocks.find((b) => b.id === selected.id) : undefined;
      const monster = selected.kind === 'monster' ? doc.monsters[selected.index] : undefined;
      const entity = block ?? monster;
      if (entity) {
        const w = block?.w ?? MONSTER_ART[monster!.t]?.w ?? 12;
        const h = block?.h ?? MONSTER_ART[monster!.t]?.h ?? 14;
        const angle = (block?.angle ?? 0) * Math.PI / 180;
        g.save();
        g.translateCanvas(entity.x, entity.y);
        g.rotateCanvas(angle);
        g.lineStyle(1.5 / scale, C('4'), 1).strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
        g.restore();
      }
    }
    if (this.pending) {
      const point = this.attachment(doc, this.pending.block, this.pending.point);
      g.lineStyle(2 / scale, C('4'), 1).strokeCircle(point.x, point.y, 6 / scale);
      g.lineBetween(point.x - 9 / scale, point.y, point.x + 9 / scale, point.y);
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
