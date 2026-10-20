import Phaser from 'phaser';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { C, css } from '../palette';
import { pixText } from '../pix';
import { text, setText, textBlock } from '../font5x7';
import { makeButton, type Btn } from '../ui';
import { sfx } from '../audio';
import { WEAPONS, type Actor, type Proj, type WeaponImpl } from '../weapons';
import { MONSTER_ART } from '../art';
import { beatBob, beatPulse, msToNextBeat } from '../beat';
import { MAX_LEVEL, progress } from '../progress';

export const W = 216;
export const H = 384;
const GROUND = 320;
const STEP = 1000 / 60;
const GRAVITY_STEP = 0.001 * STEP * STEP; // matter gravity per step, px/step^2
const SLING_X = 56;
const SLING_Y = 262;
// Feel/balance numbers live in content.json (tuning, damageRules).

const MatterLib: any = (Phaser.Physics.Matter as any).Matter;

type Kind = 'block' | 'monster';
interface Ent {
  kind: Kind;
  type: string; // monster id, or 'wood' | 'stone'
  body: any;
  sprite: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  weak: string | null;
  resist: string | null;
  w: number;
  h: number;
  size: number; // sprite size (16 or 32) for monsters
  cool: number;
  hurt: number;
  flash: number;
  dead: boolean;
  phase: number;
  shield: number;
  shieldSprite?: Phaser.GameObjects.Image;
  shieldedBy?: Ent;
  icon?: Phaser.GameObjects.Image;
  status: { burn: number; slow: number; curse: number };
  ox: number;
  oy: number;
  dir: number;
  speed: number;
  fireT: number;
}
type State = 'intro' | 'loading' | 'ready' | 'aiming' | 'flying' | 'settling' | 'won' | 'lost';
interface ExtraOpts {
  x: number; y: number; vx: number; vy: number; radius: number; density: number; mul: number; wid: string;
  color: string; status?: string;
}
interface Act extends Actor {
  pos?: () => { x: number; y: number };
}

const SKY_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export default class GameScene extends Phaser.Scene {
  tune: any;
  readonly slingX = SLING_X;
  readonly slingY = SLING_Y;
  private content!: any;
  private level!: any;
  private levelId = 1;
  private loadout: string[] = [];
  private shotIdx = 0;
  private worldW = W;
  private maxSpeed = 8;
  private lastStretch = 0;
  private ents: Ent[] = [];
  private actors: Act[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private state: State = 'ready';
  private wpn!: WeaponImpl;
  private coins = 0;
  private score = 0;
  private chain = 0;
  private chainT = 999;
  private escaped = 0;
  private steps = 0;
  private acc = 0;
  private hitStop = 0;
  private proj: Proj | null = null;
  private pouch = new Phaser.Math.Vector2(SLING_X, SLING_Y);
  private readySprite!: Phaser.GameObjects.Image;
  private settleSteps = 0;
  private endTimer = 0;
  private lastPop = 0;
  private queue: Phaser.GameObjects.Image[] = [];
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private uiMode = false;
  private vz = 1;
  private vcx = W / 2;
  private free = false;
  private pinchPrev = 0;
  private panLast: number | null = null;
  private ability!: Btn;
  private coinsTxt!: Phaser.GameObjects.Image;
  private scoreTxt!: Phaser.GameObjects.Image;
  private escTxt?: Phaser.GameObjects.Image;
  private muteBtn!: Phaser.GameObjects.Image;
  private parts: { s: Phaser.GameObjects.Image; vx: number; vy: number; life: number }[] = [];

  constructor() {
    super('game');
  }

  init(data: { level: number; loadout: string[] }): void {
    this.levelId = data.level ?? 1;
    this.loadout = (data.loadout ?? ['w_militia_blade', 'w_militia_blade', 'w_militia_blade', 'w_militia_blade']).slice();
  }

  // ------------------------------------------------------------------ setup

  create(): void {
    this.content = this.cache.json.get('content');
    this.level = this.cache.json.get(`level${this.levelId}`) ?? this.cache.json.get('level1');
    this.tune = this.content.tuning;
    this.worldW = this.level.worldW ?? W;
    this.maxSpeed = this.tune.maxPull * this.tune.launchK;
    this.ents = [];
    this.actors = [];
    this.parts = [];
    this.queue = [];
    this.coins = 0;
    this.score = 0;
    this.chain = 0;
    this.chainT = 999;
    this.escaped = 0;
    this.steps = 0;
    this.acc = 0;
    this.hitStop = 0;
    this.proj = null;
    this.settleSteps = 0;
    this.endTimer = 0;
    this.shotIdx = 0;
    this.vz = this.homeZoom();
    this.vcx = this.homeCx();
    this.free = false;
    this.pinchPrev = 0;
    this.panLast = null;
    this.state = 'intro';
    this.wpn = WEAPONS[this.loadout[0]];

    this.uiMode = false;
    this.uiCam = this.cameras.add(0, 0, W, H);
    const route = (go: Phaser.GameObjects.GameObject): void => {
      if (this.uiMode) this.cameras.main.ignore(go);
      else this.uiCam.ignore(go);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, route);
    this.events.once('shutdown', () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, route));

    this.makeTextures();
    this.buildBackground();
    this.matter.add.rectangle(this.worldW / 2, GROUND + 40, this.worldW + 400, 80, { isStatic: true, friction: 1, label: 'ground' });
    this.matter.add.rectangle(this.worldW + 10, 200, 20, 600, { isStatic: true, label: 'wall' });
    this.setView(this.vz, this.vcx);

    this.add.image(SLING_X, SLING_Y + 28, 'sling').setDepth(2);
    for (const b of this.level.blocks) this.addBlock(b.m, b.x, b.y, b.w, b.h);
    for (const m of this.level.monsters) this.addMonster(m.t, m.x, m.y, m);
    this.setupShields();
    if (this.level.exit) this.add.image(this.level.exit.x, GROUND - 13, 'door').setDepth(1);

    this.gfx = this.add.graphics().setDepth(5);
    this.readySprite = this.add.image(SLING_X, SLING_Y, this.wpn.texture).setDepth(6).setVisible(false);
    this.readySprite.setRotation(Math.PI / 4);
    this.loadout.forEach((id, i) => {
      const q = this.add.image(this.slotX(i), GROUND - 7, WEAPONS[id].texture).setDepth(3).setScale(0.85);
      q.setData('phase', i * 1.3);
      this.queue.push(q);
    });

    this.buildHud();
    this.matter.world.on('collisionstart', this.onCollide, this);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1, W / 2));
    this.input.addPointer(1);
    this.input.keyboard?.on('keydown-SPACE', () => this.activateAbility());

    try {
      RundotGameAPI.appStorage.getItem('muted').then((v: string | null) => {
        sfx.setMuted(v === '1');
        this.muteBtn?.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      }).catch(() => {});
    } catch { /* storage optional */ }

    if (this.worldW > W) {
      this.tweens.add({
        targets: this, vcx: this.worldW - W / this.homeZoom() / 2, duration: 900, ease: 'Sine.inOut', hold: 450, yoyo: true,
        onComplete: () => this.loadNext(),
      });
    } else {
      this.loadNext();
    }

    if ((import.meta as any).env?.DEV) (window as any).__scene = this;
  }

  private makeTextures(): void {
    const make = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      draw(cv.getContext('2d')!);
      this.textures.addCanvas(key, cv);
    };
    const rect = (g: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number): void => {
      g.fillStyle = css(C(ch));
      g.fillRect(x, y, w, h);
    };

    for (const b of this.level.blocks) {
      for (const cracked of [false, true]) {
        make(this.blockKey(b.m, b.w, b.h, cracked), b.w, b.h, (g) => {
          const stone = b.m === 'stone';
          rect(g, 'v', 0, 0, b.w, b.h);
          rect(g, stone ? 'k' : 'g', 1, 1, b.w - 2, b.h - 2);
          rect(g, stone ? 'l' : 'i', 1, 1, b.w - 2, 1);
          rect(g, stone ? 'l' : 'i', 1, 1, 1, b.h - 2);
          rect(g, stone ? 'm' : 'h', 1, b.h - 2, b.w - 2, 1);
          rect(g, stone ? 'm' : 'h', b.w - 2, 1, 1, b.h - 2);
          if (!stone) {
            const long = Math.max(b.w, b.h);
            for (let i = 6; i < long - 2; i += 7) {
              if (b.w >= b.h) rect(g, 'h', i, 2, 1, b.h - 4);
              else rect(g, 'h', 2, i, b.w - 4, 1);
            }
          } else if (b.w >= 10 && b.h >= 10) {
            rect(g, 'm', 3, 3, 2, 1);
            rect(g, 'l', b.w - 5, b.h - 4, 2, 1);
          }
          if (cracked) {
            rect(g, 'v', Math.floor(b.w * 0.3), 1, 1, Math.floor(b.h * 0.5));
            rect(g, 'v', Math.floor(b.w * 0.3) + 1, Math.floor(b.h * 0.5), 1, Math.floor(b.h * 0.4));
            rect(g, 'v', Math.floor(b.w * 0.7), Math.floor(b.h * 0.3), 1, Math.floor(b.h * 0.6));
          }
        });
      }
    }

    make('sling', 16, 48, (g) => {
      rect(g, 'v', 6, 15, 5, 33);
      rect(g, 'h', 7, 16, 3, 32);
      rect(g, 'g', 8, 16, 1, 32);
      rect(g, 'v', 2, 3, 5, 16);
      rect(g, 'v', 10, 3, 5, 16);
      rect(g, 'h', 3, 4, 3, 14);
      rect(g, 'h', 11, 4, 3, 14);
      rect(g, 'i', 3, 4, 1, 14);
      rect(g, 'i', 11, 4, 1, 14);
      rect(g, 'h', 5, 16, 7, 3);
    });

    make('door', 16, 26, (g) => {
      rect(g, 'v', 0, 2, 16, 24);
      rect(g, 'v', 2, 0, 12, 2);
      rect(g, 'h', 1, 3, 14, 23);
      rect(g, 'g', 2, 3, 12, 23);
      rect(g, 'i', 2, 3, 12, 1);
      rect(g, 'h', 8, 4, 1, 22);
      rect(g, '4', 6, 14, 2, 2);
      rect(g, '2', 3, 8, 2, 3);
      rect(g, '2', 11, 8, 2, 3);
    });
  }

  private blockKey(m: string, w: number, h: number, cracked: boolean): string {
    return `blk_${m}_${w}x${h}${cracked ? '_c' : ''}`;
  }

  /** Sky, three parallax layers, and the ground. Layers scroll slower than the camera. */
  private buildBackground(): void {
    const WW = this.worldW;
    const LW = WW + 700;
    const pixels = (key: string, w: number, h: number, f: (x: number, y: number) => string | null): void => {
      if (this.textures.exists(key)) return;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      const cache: Record<string, number> = {};
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ch = f(x, y);
          if (!ch) continue;
          const col = (cache[ch] ??= C(ch));
          const i = (y * w + x) * 4;
          img.data[i] = (col >> 16) & 255;
          img.data[i + 1] = (col >> 8) & 255;
          img.data[i + 2] = col & 255;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      this.textures.addCanvas(key, cv);
    };
    const hash = (n: number): number => {
      const s = Math.sin(n * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };

    // flat sky bands (deep blue, blue, cyan) with a thin ordered dither where they meet
    const band = (y: number, x: number, edge: number, a: string, b: string): string => {
      const d = (y - edge) / 7 + 0.5; // 0..1 across a 7px seam
      return d <= 0 ? a : d >= 1 ? b : d > SKY_BAYER[(y % 4) * 4 + (x % 4)] / 16 ? b : a;
    };
    pixels(`par_sky_${WW}`, LW, H, (x, y) => (y < 140 ? band(y, x, 95, '9', 'a') : band(y, x, 205, 'a', 'b')));
    {
      const tex = this.textures.get(`par_sky_${WW}`);
      const ctx = (tex.getSourceImage() as HTMLCanvasElement).getContext('2d')!;
      ctx.fillStyle = css(C('c'));
      for (let cx = 10; cx < LW; cx += 118) {
        const cy = 30 + hash(cx) * 90;
        ctx.fillRect(cx, cy, 28, 6);
        ctx.fillRect(cx + 8, cy - 6, 14, 6);
        ctx.fillRect(cx + 4, cy + 6, 18, 2);
      }
      (tex as Phaser.Textures.CanvasTexture).refresh();
    }

    const ridge = (base: number, amp: number, f1: number, ph: number, f2: number) => (x: number): number =>
      Math.round(GROUND - base - amp * Math.abs(Math.sin(x / f1 + ph)) - 6 * Math.sin(x / f2));
    const far = ridge(110, 34, 70, 1, 23);
    const mid = ridge(70, 24, 52, 2, 17);
    const near = ridge(38, 15, 33, 4, 11);
    pixels(`par_far_${WW}`, LW, H, (x, y) => {
      const r = far(x);
      return y < r ? null : y < r + 2 ? 'd' : 'e';
    });
    pixels(`par_mid_${WW}`, LW, H, (x, y) => {
      const r = mid(x);
      return y < r ? null : y < r + 2 ? 'n' : '7';
    });
    pixels(`par_near_${WW}`, LW, H, (x, y) => {
      const r = near(x);
      if (y >= r) return y < r + 2 ? '6' : 'n';
      const cell = Math.floor(x / 29);
      if (hash(cell) < 0.55) {
        const cx = cell * 29 + 8 + Math.floor(hash(cell + 7) * 12);
        const th = 12 + Math.floor(hash(cell + 3) * 9);
        const top = near(cx) - th;
        const dy = y - top;
        if (dy >= 0 && dy < th) {
          const half = Math.floor(dy / 3) + 1;
          if (Math.abs(x - cx) < half && dy < th - 1) return Math.abs(x - cx) === half - 1 && x < cx ? 'n' : 'o';
          if (dy >= th - 3 && x === cx) return 'h';
        }
      }
      return null;
    });
    pixels(`ground_${WW}`, LW, H - GROUND + 3, (x, y) => {
      if (y === 0) return x % 7 === 0 ? '6' : '5';
      if (y === 1) return '6';
      if (y === 2) return 'o';
      if (y < 7) return (x * 3 + y * 5) % 11 === 0 ? 'i' : 'g';
      if (y === 8) return 'h';
      return (x * 7 + y * 13) % 29 === 0 ? 'i' : (x * 5 + y * 3) % 31 === 0 ? 'h' : 'g';
    });

    const layer = (name: string, f: number, depth: number, y = 0): void => {
      this.add.image(-350, y, `${name}_${WW}`).setOrigin(0).setScrollFactor(f, 1).setDepth(depth);
    };
    this.add.rectangle(WW / 2, -300, WW + 1400, 700, C('9')).setDepth(-5).setScrollFactor(0.05, 1);
    this.add.rectangle(WW / 2, H + 300, WW + 1400, 600, C('g')).setDepth(-5);
    layer('par_sky', 0.05, -4);
    layer('par_far', 0.25, -3);
    layer('par_mid', 0.5, -2);
    layer('par_near', 0.75, -1);
    layer('ground', 1, 0, GROUND - 3);
  }

  private addBlock(mat: string, x: number, y: number, w: number, h: number): void {
    const def = this.content.materials.find((m: any) => m.id === mat);
    const body: any = this.matter.add.rectangle(x, y, w, h, {
      density: mat === 'stone' ? 0.0022 : 0.001,
      friction: 0.7, frictionStatic: 1, restitution: 0.05, label: 'block',
    });
    const sprite = this.add.image(x, y, this.blockKey(mat, w, h, false)).setDepth(2);
    this.ents.push(this.makeEnt('block', mat, body, sprite, def.hp, def.weak ?? null, null, w, h, 16));
  }

  private addMonster(type: string, x: number, y: number, params: any = {}): void {
    const def = this.content.monsters.find((m: any) => m.id === type);
    const art = MONSTER_ART[type];
    if (!def || !art) return;
    const density = art.size === 32 ? 0.003 : type === 'imp' ? 0.0008 : 0.001;
    const body: any = this.matter.add.rectangle(x, y, art.w, art.h, {
      density, friction: 0.6, frictionStatic: 1, restitution: 0.05, label: 'monster',
    });
    const sprite = this.add.image(x, y, type).setDepth(3);
    const e = this.makeEnt('monster', type, body, sprite, def.hp, def.weak, def.resist, art.w, art.h, art.size);
    e.dir = params.dir ?? 1;
    e.speed = params.speed ?? 0.8;
    e.fireT = 120 + Math.floor(Math.random() * 120);
    if (type === 'imp') {
      body.ignoreGravity = true;
      MatterLib.Body.setInertia(body, Infinity);
    }
    this.ents.push(e);
  }

  private makeEnt(kind: Kind, type: string, body: any, sprite: Phaser.GameObjects.Image, hp: number, weak: string | null, resist: string | null, w: number, h: number, size: number): Ent {
    const e: Ent = {
      kind, type, body, sprite, hp, maxHp: hp, weak, resist, w, h, size, cool: 0, hurt: 0, flash: 0, dead: false,
      phase: Math.random() * 6, shield: 0, status: { burn: 0, slow: 0, curse: 0 }, ox: body.position.x, oy: body.position.y,
      dir: 1, speed: 0, fireT: 0,
    };
    body.ent = e;
    return e;
  }

  /** Hexers shield their neighbours: 50 damage absorbed. */
  private setupShields(): void {
    for (const hx of this.ents.filter((e) => e.type === 'dark_elf_hexer')) {
      for (const n of this.ents) {
        if (n === hx || n.kind !== 'monster') continue;
        if (Phaser.Math.Distance.Between(n.body.position.x, n.body.position.y, hx.body.position.x, hx.body.position.y) > 48) continue;
        n.shield = 50;
        n.shieldedBy = hx;
        n.shieldSprite = this.add.image(n.body.position.x, n.body.position.y, 'ring').setTint(C('b')).setAlpha(0.7).setDepth(4).setScale((n.size / 64) * 1.5);
      }
    }
  }

  private buildHud(): void {
    let top = 6;
    try {
      const sa = RundotGameAPI.system.getSafeArea();
      top = Math.max(6, sa.top * this.scale.displayScale.y);
    } catch { /* not ready: use default */ }
    this.uiMode = true;
    this.coinsTxt = text(this, 4, top + 5, 'Coins 0', C('4')).setOrigin(0, 0.5).setDepth(10);
    this.scoreTxt = text(this, 4, top + 17, 'Score 0', C('c')).setOrigin(0, 0.5).setDepth(10);
    if (this.level.maxEscapes !== undefined) this.escTxt = text(this, 4, top + 29, `Escaped 0 of ${this.level.maxEscapes}`, C('d')).setOrigin(0, 0.5).setDepth(10);

    this.muteBtn = this.add.image(W - 10, top + 4, sfx.muted ? 'spk_off' : 'spk_on').setDepth(10);
    this.muteBtn.setInteractive(new Phaser.Geom.Rectangle(-6, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    this.muteBtn.on('pointerdown', () => {
      sfx.unlock();
      sfx.setMuted(!sfx.muted);
      this.muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      sfx.click();
      try { RundotGameAPI.appStorage.setItem('muted', sfx.muted ? '1' : '0').catch(() => {}); } catch { /* optional */ }
    });
    const zoomBtn = this.add.image(W - 30, top + 4, 'zoom_icon').setDepth(10);
    zoomBtn.setInteractive(new Phaser.Geom.Rectangle(-8, -10, 25, 27), Phaser.Geom.Rectangle.Contains);
    zoomBtn.on('pointerdown', () => { sfx.unlock(); sfx.click(); this.toggleView(); });

    this.ability = makeButton(this, W - 30, H - 28, 52, 32, this.wpn.abilityLabel, 'ability', () => this.activateAbility());
    this.ability.box.setVisible(false);

    if (this.level.hint) {
      const hint = textBlock(this, W / 2, top + 44, this.level.hint, C('c'), 190, C('0'));
      hint.forEach((h) => h.setDepth(10));
      this.tweens.add({ targets: hint, alpha: 0, delay: 5200, duration: 700, onComplete: () => hint.forEach((h) => h.destroy()) });
    }
    this.uiMode = false;
  }

  // ------------------------------------------------------------------ view (zoom / pan)

  private minZoom(): number {
    return Math.min(1, W / this.worldW);
  }

  private clampCx(cx: number, z: number): number {
    const half = W / z / 2;
    return W / z >= this.worldW ? this.worldW / 2 : Phaser.Math.Clamp(cx, half, this.worldW - half);
  }

  /** Zoom is about the screen centre. Zoomed in the view is bottom-aligned so the ground stays on screen. */
  private setView(z: number, cx: number): void {
    this.vz = Phaser.Math.Clamp(z, this.minZoom(), 1.8);
    this.vcx = this.clampCx(cx, this.vz);
    const cam = this.cameras.main;
    cam.setZoom(this.vz);
    cam.scrollX = this.vcx - W / 2;
    // zoomed in the ground stays at the bottom; zoomed out it rises so the battlefield sits in the middle of the screen
    const groundScreen = H * (0.83 - Math.max(0, 1 - this.vz) * 0.4);
    const cy = this.vz >= 1 ? H - H / this.vz / 2 : GROUND - (groundScreen - H / 2) / this.vz;
    cam.scrollY = cy - H / 2;
  }

  private zoomBy(f: number, focusScreenX: number): void {
    const z0 = this.vz;
    const z1 = Phaser.Math.Clamp(z0 * f, this.minZoom(), 1.8);
    const wx = this.vcx + (focusScreenX - W / 2) / z0;
    this.vz = z1;
    this.vcx = this.clampCx(wx - (focusScreenX - W / 2) / z1, z1);
    this.free = true;
  }

  private toggleView(): void {
    if (this.state === 'intro' || this.state === 'won' || this.state === 'lost') return;
    const fit = this.vz > this.minZoom() + 0.01 && this.worldW > W;
    this.free = fit;
    this.tweens.add({
      targets: this, vz: fit ? this.minZoom() : this.homeZoom(), vcx: fit ? this.worldW / 2 : this.homeCx(), duration: 260, ease: 'Sine.inOut',
    });
  }

  private followPos(): { x: number; y: number } | null {
    if (this.proj) return this.proj.body.position;
    for (const a of this.actors) {
      const p = a.pos?.();
      if (p) return p;
    }
    return null;
  }

  private updateCamera(): void {
    if (!this.free) {
      let target: number | null = null;
      const fp = this.followPos();
      if (this.state === 'flying' && fp) target = fp.x + W * 0.15;
      else if (this.state === 'settling' && this.settleSteps > 45) target = this.homeCx();
      if (target !== null) {
        const t = this.clampCx(target, this.vz);
        this.vcx += (t - this.vcx) * 0.1;
        if (Math.abs(this.vcx - t) < 0.5) this.vcx = t;
      }
    }
    this.setView(this.vz, this.vcx);
  }

  /** Default framing: the sling near the left edge and every monster in view, down to a minimum zoom. */
  private homeZoom(): number {
    if (this.worldW <= W) return 1;
    const maxX = Math.max(...this.level.monsters.map((m: any) => m.x as number));
    const left = this.content.tuning.homeLeft;
    return Phaser.Math.Clamp(W / (maxX + 28 - left), this.content.tuning.homeZoomMin, 1);
  }

  private homeCx(): number {
    return this.content.tuning.homeLeft + W / this.homeZoom() / 2;
  }

  private atHome(): boolean {
    return this.free || (Math.abs(this.vcx - this.clampCx(this.homeCx(), this.vz)) < 3 && Math.abs(this.vz - this.homeZoom()) < 0.02);
  }

  // ------------------------------------------------------------------ queue (weapons waiting to be fired)

  private slotX(i: number): number {
    return Math.max(4, SLING_X - 22 - i * 12);
  }

  private hop(img: Phaser.GameObjects.Image, tx: number, ty: number, dur: number, arc: number, done?: () => void): void {
    const sx = img.x;
    const sy = img.y;
    this.tweens.addCounter({
      from: 0, to: 1, duration: dur, ease: 'Sine.inOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        img.setPosition(sx + (tx - sx) * t, sy + (ty - sy) * t - Math.sin(Math.PI * t) * arc);
      },
      onComplete: () => {
        img.setPosition(tx, ty);
        done?.();
      },
    });
  }

  /** The next weapon in line hops onto the sling; the rest shuffle up. */
  private loadNext(): void {
    if (this.shotIdx >= this.loadout.length || this.queue.length === 0) {
      this.state = 'ready';
      return;
    }
    this.state = 'loading';
    this.wpn = WEAPONS[this.loadout[this.shotIdx]];
    this.ability.setLabel(this.wpn.abilityLabel);
    const first = this.queue.shift()!;
    first.setDepth(7).setScale(0.85);
    this.queue.forEach((q, i) => this.hop(q, this.slotX(i), GROUND - 7, 260, 5));
    sfx.click();
    this.hop(first, SLING_X, SLING_Y, 420, 26, () => {
      first.destroy();
      this.readySprite.setTexture(this.wpn.texture).setVisible(true).setRotation(Math.PI / 4).setScale(1);
      this.pouch.set(SLING_X, SLING_Y);
      this.tweens.add({ targets: this.readySprite, scaleY: 0.8, scaleX: 1.15, duration: 70, yoyo: true });
      this.state = 'ready';
    });
    this.tweens.add({ targets: first, rotation: Math.PI * 2 + Math.PI / 4, scale: 1, duration: 420, ease: 'Sine.inOut' });
  }

  /** Test hook: finish the intro/hop instantly (tweens run on wall-clock time, scripted tests don't). */
  skipToReady(): void {
    this.tweens.killAll();
    this.setView(this.homeZoom(), this.homeCx());
    this.queue.forEach((q) => q.destroy());
    this.queue = [];
    if (this.shotIdx >= this.loadout.length) return;
    this.wpn = WEAPONS[this.loadout[this.shotIdx]];
    this.ability.setLabel(this.wpn.abilityLabel);
    this.readySprite.setTexture(this.wpn.texture).setVisible(true).setRotation(Math.PI / 4).setScale(1);
    this.pouch.set(SLING_X, SLING_Y);
    this.state = 'ready';
  }

  private updateQueue(time: number): void {
    this.queue.forEach((q) => {
      if (this.tweens.isTweening(q)) return;
      const ph = q.getData('phase') as number;
      const b = beatBob(time, ph);
      q.setScale(0.85 + 0.03 * b, 0.85 - 0.04 * b);
      q.setRotation(0.12 * Math.sin(time / 320 + ph));
    });
  }

  // ------------------------------------------------------------------ ability

  activateAbility(): void {
    if (this.state !== 'flying' || !this.proj || this.proj.tapped || this.wpn.ability === 'impact') return;
    this.proj.tapped = true;
    this.wpn.onAbility(this, this.proj);
  }

  private updateAbilityBtn(time: number): void {
    const inAir = this.state === 'flying' && !!this.proj && this.wpn.ability !== 'impact';
    const ready = inAir && !this.proj!.tapped;
    this.ability.box.setVisible(inAir);
    this.ability.setEnabled(ready);
    this.ability.box.setScale(ready ? 1 + 0.07 * beatPulse(time) : 1);
  }

  // ------------------------------------------------------------------ input

  /** Screen to world, computed from the view state so it never depends on render timing. */
  private pointerWorld(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const cam = this.cameras.main;
    return new Phaser.Math.Vector2(cam.scrollX + W / 2 + (p.x - W / 2) / this.vz, cam.scrollY + H / 2 + (p.y - H / 2) / this.vz);
  }

  private screenDist(p: Phaser.Input.Pointer, wx: number, wy: number): number {
    const w = this.pointerWorld(p);
    return Phaser.Math.Distance.Between(w.x, w.y, wx, wy) * this.vz;
  }

  private onDown(p: Phaser.Input.Pointer, over: unknown[]): void {
    sfx.unlock();
    if (over.length) return;
    const two = this.input.pointer1.isDown && this.input.pointer2.isDown;
    if (two && this.state !== 'aiming') {
      this.pinchPrev = Phaser.Math.Distance.Between(this.input.pointer1.x, this.input.pointer1.y, this.input.pointer2.x, this.input.pointer2.y);
      this.panLast = null;
      return;
    }
    if (this.state === 'ready' && this.screenDist(p, SLING_X, SLING_Y) < 44) {
      this.state = 'aiming';
      this.free = false;
      this.onMove(p);
    } else if (this.state !== 'aiming' && this.state !== 'won' && this.state !== 'lost') {
      this.panLast = p.x;
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.state === 'aiming') {
      const w = this.pointerWorld(p);
      const v = new Phaser.Math.Vector2(w.x - SLING_X, w.y - SLING_Y);
      if (v.length() > this.tune.maxPull) v.setLength(this.tune.maxPull);
      this.pouch.set(SLING_X + v.x, Math.min(SLING_Y + v.y, GROUND - 6));
      const now = this.time.now;
      if (now - this.lastStretch > this.tune.stretchSoundMs) {
        this.lastStretch = now;
        sfx.stretch();
      }
      return;
    }
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown && this.pinchPrev > 0) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      this.zoomBy(d / this.pinchPrev, (p1.x + p2.x) / 2);
      this.pinchPrev = d;
    } else if (this.panLast !== null && p.isDown) {
      this.vcx = this.clampCx(this.vcx - (p.x - this.panLast) / this.vz, this.vz);
      this.panLast = p.x;
      this.free = true;
    }
  }

  private onUp(): void {
    this.pinchPrev = 0;
    this.panLast = null;
    if (this.state !== 'aiming') return;
    const pull = new Phaser.Math.Vector2(SLING_X - this.pouch.x, SLING_Y - this.pouch.y);
    if (pull.length() < 8) {
      this.pouch.set(SLING_X, SLING_Y);
      this.state = 'ready';
      return;
    }
    this.launch(pull.scale(this.tune.launchK));
  }

  private launch(v: Phaser.Math.Vector2): void {
    const id = this.loadout[this.shotIdx];
    this.wpn = WEAPONS[id];
    const body: any = this.matter.add.circle(this.pouch.x, this.pouch.y, this.wpn.radius, {
      density: this.wpn.density, friction: 0.3, frictionAir: 0, restitution: 0.2, label: 'proj',
    });
    body.proj = { wid: id, mul: 1, owner: 'main' };
    this.setGravity(body, this.wpn.gravity);
    MatterLib.Body.setVelocity(body, { x: v.x, y: v.y });
    MatterLib.Body.setAngularVelocity(body, this.wpn.spin);
    const sprite = this.add.image(this.pouch.x, this.pouch.y, this.wpn.texture).setDepth(4);
    this.proj = { body, sprite, wid: id, steps: 0, slow: 0, tapped: false, t: 0, data: {} };
    this.readySprite.setVisible(false);
    this.pouch.set(SLING_X, SLING_Y);
    this.shotIdx++;
    this.free = false;
    this.state = 'flying';
    this.cameras.main.shake(70, 0.004);
    sfx.launch();
  }

  // ------------------------------------------------------------------ API used by weapons

  setGravity(body: any, f: number): void {
    body.gScale = f;
    body.ignoreGravity = f === 0;
  }

  addActor(a: Act): void {
    this.actors.push(a);
  }

  shake(i: number): void {
    this.cameras.main.shake(100, i);
  }

  ring(x: number, y: number, r: number, color: number): void {
    const c = this.add.circle(x, y, r, 0xffffff, 0).setStrokeStyle(1, color).setDepth(9).setScale(0.2);
    this.tweens.add({ targets: c, scale: 1, alpha: 0, duration: 240, onComplete: () => c.destroy() });
  }

  sparks(x: number, y: number, colors: string[], n: number): void {
    this.burst(x, y, colors, n);
  }

  monstersNear(x: number, y: number, r: number): Ent[] {
    return this.ents.filter((e) => !e.dead && e.kind === 'monster' && Phaser.Math.Distance.Between(x, y, e.body.position.x, e.body.position.y) <= r);
  }

  nearestMonsters(x: number, y: number, n: number): Ent[] {
    return this.ents
      .filter((e) => !e.dead && e.kind === 'monster')
      .sort((a, b) => Phaser.Math.Distance.Between(x, y, a.body.position.x, a.body.position.y) - Phaser.Math.Distance.Between(x, y, b.body.position.x, b.body.position.y))
      .slice(0, n);
  }

  inflictStatus(e: Ent, kind: string, steps: number): void {
    if (e.dead) return;
    if (kind === 'burn') e.status.burn = steps;
    else if (kind === 'slow') e.status.slow = steps;
    else if (kind === 'curse') e.status.curse = steps;
  }

  /** Push everything near (x, y) away: strength is the velocity change in px/step. */
  push(x: number, y: number, r: number, strength: number): void {
    for (const e of this.ents) {
      if (e.dead) continue;
      const bp = e.body.position;
      const d = Phaser.Math.Distance.Between(x, y, bp.x, bp.y);
      if (d > r || d < 0.01) continue;
      MatterLib.Sleeping.set(e.body, false);
      const k = (strength * (1 - d / r) * e.body.mass) / (STEP * STEP);
      MatterLib.Body.applyForce(e.body, bp, { x: ((bp.x - x) / d) * k, y: ((bp.y - y) / d) * k - 0.4 * k });
    }
  }

  damageAround(x: number, y: number, r: number, factor: number, wid: string): void {
    const hits = MatterLib.Query.region(MatterLib.Composite.allBodies(this.matter.world.engine.world), {
      min: { x: x - r, y: y - r }, max: { x: x + r, y: y + r },
    });
    for (const o of hits) {
      const t: Ent | undefined = o.ent;
      if (!t || t.dead) continue;
      this.directHit(t, wid, factor, x, y, false);
    }
  }

  /** Damage from a weapon that is not a physical collision (bolts, saw ticks, blasts). */
  directHit(t: Ent, wid: string, mul: number, x: number, y: number, strong = true): void {
    const { dmg, tag } = this.weaponDamage(t, wid, 1, mul);
    if (dmg >= 1) this.damage(t, dmg, x, y, { strong, tag });
  }

  /** Radial damage that falls off with distance, with a push. wid null = non-weapon (bomber). */
  explode(x: number, y: number, r: number, base: number, exclude: Ent | null, wid: string | null): void {
    this.ring(x, y, r, C('4'));
    this.ring(x, y, r * 0.6, C('3'));
    this.burst(x, y, ['4', '3', '2', 'c'], 18);
    this.cameras.main.shake(180, 0.014);
    this.hitStop = Math.max(this.hitStop, 4);
    sfx.crunch();
    this.popWord(x, y - 10, 'boom!');
    for (const e of this.ents) {
      if (e.dead || e === exclude) continue;
      const bp = e.body.position;
      const d = Phaser.Math.Distance.Between(x, y, bp.x, bp.y) - Math.max(e.w, e.h) / 2;
      if (d > r) continue;
      const fall = 1 - (0.65 * Math.max(0, d)) / r;
      let dmg = base * fall;
      let tag: 'weak' | 'resist' | 'norm' = 'norm';
      if (wid) {
        const w = this.content.weapons.find((q: any) => q.id === wid);
        const el = this.elementMult(e, w.element);
        dmg *= el * this.comboMult() * this.content.damageRules.globalScale;
        tag = el > 1 ? 'weak' : el < 1 ? 'resist' : 'norm';
      }
      this.damage(e, dmg, bp.x, bp.y, { strong: false, tag });
    }
    this.push(x, y, r, 3.2);
  }

  blast(x: number, y: number, r: number, mul: number, wid: string): void {
    const w = this.content.weapons.find((q: any) => q.id === wid);
    this.explode(x, y, r, w.baseDamage * mul, null, wid);
  }

  endProj(p: Proj, _silent?: boolean): void {
    if (this.proj !== p) return;
    this.matter.world.remove(p.body);
    p.sprite.destroy();
    this.proj = null;
  }

  /** Lightweight physics projectile (pellets). Lives until it stops, leaves the world, or times out. */
  launchExtra(o: ExtraOpts): void {
    const body: any = this.matter.add.circle(o.x, o.y, o.radius, {
      density: o.density, friction: 0.2, frictionAir: 0, restitution: 0.3, label: 'proj',
    });
    body.proj = { wid: o.wid, mul: o.mul, owner: 'extra', status: o.status };
    MatterLib.Body.setVelocity(body, { x: o.vx, y: o.vy });
    const sprite = this.add.image(o.x, o.y, 'px').setTint(C(o.color)).setScale(o.radius * 1.5).setDepth(5);
    let steps = 0;
    let slow = 0;
    const a: Act = {
      pos: () => body.position,
      update: () => {
        steps++;
        sprite.setPosition(body.position.x, body.position.y);
        slow = Math.hypot(body.velocity.x, body.velocity.y) < 0.3 ? slow + 1 : 0;
        return slow > 30 || steps > 240 || body.position.x > this.worldW + 40 || body.position.x < -40 || body.position.y > H + 40 || body.position.y < -400;
      },
      destroy: () => {
        this.matter.world.remove(body);
        sprite.destroy();
      },
    };
    (a as any).body = body;
    this.actors.push(a);
  }

  // ------------------------------------------------------------------ damage

  private comboMult(): number {
    const list: number[] = this.content.damageRules.comboMultipliers;
    return list[Math.min(this.chain, list.length - 1)] ?? 1;
  }

  private elementMult(t: Ent, element: string): number {
    const d = this.content.damageRules;
    return t.weak === element ? d.elementWeak : t.resist === element ? d.elementResist : 1;
  }

  /** damage = baseDamage x (1 + 0.08 x upgrade) x element x impact x combo x global scale x the shot's own multiplier. */
  private weaponDamage(t: Ent, wid: string, impactFactor: number, mul: number): { dmg: number; tag: 'weak' | 'resist' | 'norm' } {
    const w = this.content.weapons.find((q: any) => q.id === wid);
    const el = this.elementMult(t, w.element);
    const dmg = w.baseDamage * impactFactor * el * this.comboMult() * this.content.damageRules.globalScale * mul;
    return { dmg, tag: el > 1 ? 'weak' : el < 1 ? 'resist' : 'norm' };
  }

  private onCollide(ev: any): void {
    for (const pr of ev.pairs) {
      const A = pr.bodyA;
      const B = pr.bodyB;
      const aProj = A.label === 'proj';
      const bProj = B.label === 'proj';
      if (aProj && bProj) continue;
      const rel = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
      const sup = pr.collision?.supports?.[0];
      const cx = sup ? sup.x : (A.position.x + B.position.x) / 2;
      const cy = sup ? sup.y : (A.position.y + B.position.y) / 2;
      if (aProj || bProj) {
        this.projContact(aProj ? A : B, aProj ? B : A, rel, cx, cy);
        continue;
      }
      if (rel < 1.5) continue;
      this.impact(A.ent, B.ent, B, rel, cx, cy);
      this.impact(B.ent, A.ent, A, rel, cx, cy);
    }
  }

  private projContact(pb: any, ob: any, rel: number, x: number, y: number): void {
    const info = pb.proj;
    const t: Ent | undefined = ob.ent;
    const p = this.proj && this.proj.body === pb ? this.proj : null;
    if (p) {
      if (!p.tapped && this.wpn.ability !== 'button' && this.wpn.onImpact) {
        p.tapped = true;
        this.wpn.onImpact(this, p);
        return;
      }
      if (p.tapped && this.wpn.onPostImpact && !p.data.postDone) {
        p.data.postDone = true;
        this.wpn.onPostImpact(this, p);
      }
    }
    // piercing: solid things stop it
    if (info.pierce > 0) {
      const soft = t && (t.kind === 'monster' || t.type === 'wood');
      if (!soft) {
        pb.isSensor = false;
        info.pierce = 0;
      } else if (!info.hit.has(ob.id)) {
        info.hit.add(ob.id);
        info.pierce--;
        if (info.pierce <= 0) pb.isSensor = false;
      } else {
        return;
      }
    }
    if (!t || t.dead) return;
    if (rel < 1.2 && !info.status) return;
    const { dmg, tag } = this.weaponDamage(t, info.wid, Phaser.Math.Clamp(0.5 + rel / this.maxSpeed, 0.5, 1.5), info.mul);
    if (info.status && t.kind === 'monster') {
      if (info.status === 'knock') MatterLib.Body.setVelocity(t.body, { x: pb.velocity.x * 0.8, y: pb.velocity.y * 0.8 - 1 });
      else this.inflictStatus(t, info.status, 180);
    }
    if (dmg >= 1) this.damage(t, dmg, x, y, { strong: info.owner === 'main', tag });
  }

  /** Impacts between non-projectile bodies: falling bodies and debris hurt, and monsters feel every landing. */
  private impact(target: Ent | undefined, other: Ent | undefined, ob: any, rel: number, x: number, y: number): void {
    if (!target || target.dead || target.cool > 0) return;
    const T = this.tune;
    let dmg = 0;
    if (other) {
      dmg = (rel - 1.5) * Math.sqrt(other.body.mass) * T.debrisK * (target.kind === 'monster' ? 1 : T.blockDebrisFactor);
      if (target.kind === 'monster' && other.kind === 'block') dmg = Math.max(dmg, (rel - T.fallThreshold) * T.fallK);
    } else if (ob.label === 'ground' && target.kind === 'monster') {
      dmg = (rel - T.fallThreshold) * T.fallK;
    } else {
      return;
    }
    if (dmg >= 2) this.damage(target, dmg, x, y, { strong: false, tag: 'norm', fall: !other || other.kind === 'block' });
  }

  private damage(t: Ent, dmgIn: number, x: number, y: number, o: { strong: boolean; tag: 'weak' | 'resist' | 'norm'; fall?: boolean; quiet?: boolean }): void {
    if (t.dead) return;
    let dmg = dmgIn * (t.status.curse > 0 ? 1.15 : 1);
    if (t.shield > 0) {
      const ab = Math.min(t.shield, dmg);
      t.shield -= ab;
      dmg -= ab;
      this.burst(x, y, ['b', 'c'], 3);
      if (t.shield <= 0) {
        t.shieldSprite?.destroy();
        t.shieldSprite = undefined;
      }
      if (dmg <= 0) return;
    }
    // hurting a hexer drops the shields it raised
    if (t.type === 'dark_elf_hexer') {
      for (const e of this.ents) {
        if (e.shieldedBy === t) {
          e.shield = 0;
          e.shieldSprite?.destroy();
          e.shieldSprite = undefined;
        }
      }
    }
    t.hp -= dmg;
    t.cool = 5;
    t.hurt = 14;
    t.flash = 3;
    if (t.kind === 'monster' && !t.icon && t.weak) t.icon = this.add.image(x, y, `el_${t.weak}`).setDepth(8);
    if (!o.quiet) {
      const shown = Math.max(1, Math.round(dmg));
      const color = o.tag === 'weak' ? C('4') : o.tag === 'resist' ? C('e') : C('c');
      const scale = o.tag === 'weak' ? 2 : 1;
      const ft = pixText(this, x, y - 6, String(shown), color, scale).setDepth(12);
      this.tweens.add({ targets: ft, y: y - 22, alpha: 0, duration: 650, onComplete: () => ft.destroy() });
      if (dmg >= 22 || o.fall) this.popWord(x, y - 14, t.kind === 'monster' ? (o.fall ? 'thud!' : 'bonk!') : t.type === 'wood' ? 'crack!' : 'clonk!');
      if (dmg >= 12) this.ring(x, y, 6 + Math.min(14, dmg / 3), C('c'));
    }
    const wood = t.type === 'wood';
    const colors = t.kind === 'monster' ? ['5', '6', '2'] : wood ? ['g', 'i', 'h'] : ['k', 'l', 'm'];
    this.burst(x, y, colors, Math.min(10, 3 + Math.round(dmg / 6)));
    sfx.hit(Math.min(1, dmg / 40));
    this.cameras.main.shake(90, Phaser.Math.Clamp((dmg / 40) * 0.012, 0.002, 0.014));
    if (o.strong) this.hitStop = Math.max(this.hitStop, this.tune.hitStopFrames);

    if (t.hp <= 0) this.kill(t);
    else if (t.kind === 'block' && t.hp < t.maxHp * 0.5) t.sprite.setTexture(this.blockKey(t.type, t.w, t.h, true));
  }

  private popWord(x: number, y: number, word: string): void {
    const now = this.time.now;
    if (now - this.lastPop < 260) return;
    this.lastPop = now;
    const t = text(this, x, y, word, C('4'), 1, C('q')).setDepth(13).setAngle(Phaser.Math.Between(-8, 8));
    this.tweens.add({ targets: t, y: y - 14, scale: 1.4, alpha: 0, duration: 520, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  private kill(t: Ent): void {
    t.dead = true;
    const px = t.body.position.x;
    const py = t.body.position.y;
    this.matter.world.remove(t.body);
    t.sprite.destroy();
    t.shieldSprite?.destroy();
    t.icon?.destroy();
    const wood = t.type === 'wood';
    this.burst(px, py, t.kind === 'monster' ? ['5', '6', '4', '2'] : wood ? ['g', 'i', 'h'] : ['k', 'l', 'm'], 14);
    sfx.crunch();
    this.hitStop = Math.max(this.hitStop, this.tune.hitStopFrames);
    this.coins += t.kind === 'monster' ? this.tune.coins.monster : wood ? this.tune.coins.wood : this.tune.coins.stone;
    sfx.coin();
    setText(this.coinsTxt, this, `Coins ${this.coins}`, C('4'));

    if (t.kind === 'monster') {
      this.popWord(px, py - 12, 'splat!');
      if (this.chainT < this.content.damageRules.comboWindowSeconds * 60) this.chain++;
      else this.chain = 1;
      this.chainT = 0;
      const pts = Math.round((this.tune.points[t.type] ?? 100) * this.comboMult());
      this.addScore(pts, px, py);
      if (this.chain >= 3) this.mashBanner();
      if (t.type === 'goblin_bomber') this.explode(px, py, 32, 45, t, null);
    } else {
      this.addScore(this.tune.points[t.type] ?? 10, px, py - 6, true);
    }
    // Sleeping bodies don't wake when a support is removed.
    for (const e of this.ents) if (!e.dead) MatterLib.Sleeping.set(e.body, false);
  }

  private addScore(pts: number, x: number, y: number, quiet = false): void {
    this.score += pts;
    setText(this.scoreTxt, this, `Score ${this.score}`, C('c'));
    if (!quiet) {
      const ft = pixText(this, x, y - 20, `+${pts}`, C('4')).setDepth(12);
      this.tweens.add({ targets: ft, y: y - 36, alpha: 0, duration: 800, onComplete: () => ft.destroy() });
    }
  }

  /** MASH! lands on the next beat: a beat of freeze, a white flash, then the banner drops. */
  private mashBanner(): void {
    const mult = this.comboMult();
    this.hitStop = Math.max(this.hitStop, 6);
    const delay = msToNextBeat(this.game.getTime());
    this.time.delayedCall(Math.min(delay, 500), () => {
      this.cameras.main.flash(120, 255, 255, 255);
      this.cameras.main.shake(220, 0.012);
      sfx.win();
      this.uiMode = true;
      const t = text(this, W / 2, -20, 'MASH!', C('4'), 5, C('q')).setDepth(30);
      const m = text(this, W / 2, 124, `x${mult} combo`, C('c'), 1, C('0')).setDepth(30).setAlpha(0);
      this.uiMode = false;
      this.tweens.add({
        targets: t, y: 96, duration: 220, ease: 'Back.out',
        onComplete: () => {
          this.tweens.add({ targets: m, alpha: 1, duration: 120 });
          this.tweens.add({ targets: [t, m], alpha: 0, delay: 800, duration: 300, onComplete: () => { t.destroy(); m.destroy(); } });
        },
      });
    });
  }

  // ------------------------------------------------------------------ fx

  private burst(x: number, y: number, colors: string[], n: number): void {
    for (let i = 0; i < n && this.parts.length < 90; i++) {
      const s = this.add.image(x, y, 'px').setTint(C(colors[i % colors.length])).setScale(Phaser.Math.Between(1, 2)).setDepth(11);
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.8;
      this.parts.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 22 + Math.random() * 14 });
    }
  }

  private updateParts(): void {
    for (const p of this.parts) {
      p.life--;
      p.vy += 0.12;
      p.s.x += p.vx;
      p.s.y += p.vy;
      p.s.setAlpha(Math.min(1, p.life / 10));
      if (p.life <= 0) p.s.destroy();
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  // ------------------------------------------------------------------ loop

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 50);
    let n = 0;
    while (this.acc >= STEP && n < 3) {
      this.acc -= STEP;
      n++;
      this.updateParts();
      if (this.hitStop > 0) {
        this.hitStop--;
        continue;
      }
      this.applyCustomGravity();
      this.matter.world.step(STEP);
      this.stepLogic();
    }
    const now = this.game.getTime();
    this.updateCamera();
    this.updateQueue(now);
    this.updateAbilityBtn(now);
    this.syncSprites(now);
    this.drawOverlayGfx();
  }

  /** Matter ignores per-body gravity scale here, so add the difference as a force before each step. */
  private applyCustomGravity(): void {
    const bodies: any[] = [];
    if (this.proj) bodies.push(this.proj.body);
    for (const a of this.actors) if ((a as any).body) bodies.push((a as any).body);
    for (const b of bodies) {
      if (b.ignoreGravity || b.gScale === undefined || b.gScale === 1) continue;
      MatterLib.Body.applyForce(b, b.position, { x: 0, y: b.mass * (b.gScale - 1) * 0.001 });
    }
  }

  private monsterStep(e: Ent): void {
    const b = e.body;
    if (e.status.burn > 0) {
      e.status.burn--;
      if (e.status.burn % 12 === 0) this.damage(e, 2, b.position.x, b.position.y, { strong: false, tag: 'norm', quiet: true });
      if (e.status.burn % 6 === 0) this.burst(b.position.x, b.position.y - e.h / 2, ['3', '4'], 1);
    }
    if (e.status.slow > 0) e.status.slow--;
    if (e.status.curse > 0) e.status.curse--;
    if (e.dead) return;
    switch (e.type) {
      case 'troll':
        if (e.hp < e.maxHp && e.status.burn <= 0) e.hp = Math.min(e.maxHp, e.hp + 5 / 60);
        break;
      case 'imp': {
        const t = this.steps / 60;
        const tx = e.ox + 22 * Math.sin(t * 1.5 + e.phase);
        const ty = e.oy + 10 * Math.sin(t * 3 + e.phase * 2);
        MatterLib.Body.setVelocity(b, { x: tx - b.position.x, y: ty - b.position.y });
        MatterLib.Body.setAngularVelocity(b, 0);
        break;
      }
      case 'skeleton_runner': {
        const grounded = Math.abs(b.velocity.y) < 1.2 && b.position.y > GROUND - 12;
        if (grounded) {
          const sp = e.speed * (e.status.slow > 0 ? 0.5 : 1);
          MatterLib.Body.setVelocity(b, { x: e.dir * sp, y: b.velocity.y });
          MatterLib.Body.setAngularVelocity(b, 0);
          MatterLib.Body.setAngle(b, b.angle * 0.6);
        }
        const exitX = this.level.exit?.x ?? 99999;
        if ((e.dir > 0 && b.position.x >= exitX) || (e.dir < 0 && b.position.x <= exitX)) this.runnerEscapes(e);
        break;
      }
      case 'dark_elf_archer':
        e.fireT--;
        if (e.fireT <= 0 && (this.state === 'ready' || this.state === 'aiming' || this.state === 'loading')) {
          e.fireT = 220;
          this.fireArrow(b.position.x, b.position.y - 2);
        }
        break;
      default:
        break;
    }
  }

  private runnerEscapes(e: Ent): void {
    e.dead = true;
    this.matter.world.remove(e.body);
    e.sprite.destroy();
    e.shieldSprite?.destroy();
    e.icon?.destroy();
    this.escaped++;
    sfx.lose();
    this.popWord(this.level.exit.x - 10, GROUND - 30, 'it got away!');
    if (this.escTxt) setText(this.escTxt, this, `Escaped ${this.escaped} of ${this.level.maxEscapes}`, this.escaped > this.level.maxEscapes ? C('2') : C('d'));
  }

  /** Visual only: an arrow flies at the launcher pad and fizzles. */
  private fireArrow(x: number, y: number): void {
    const sprite = this.add.image(x, y, 'px').setTint(C('g')).setScale(5, 1).setDepth(6);
    const sx = x;
    const sy = y;
    let t = 0;
    this.actors.push({
      update: () => {
        t++;
        const k = t / 55;
        const px = sx + (SLING_X - sx) * k;
        const py = sy + (SLING_Y + 6 - sy) * k - Math.sin(Math.PI * k) * 22;
        sprite.setRotation(Math.atan2(py - sprite.y, px - sprite.x));
        sprite.setPosition(px, py);
        if (t >= 55) {
          this.burst(px, py, ['g', 'c'], 4);
          return true;
        }
        return false;
      },
      destroy: () => sprite.destroy(),
    });
  }

  private stepLogic(): void {
    this.steps++;
    this.chainT++;
    if (this.chainT > this.content.damageRules.comboWindowSeconds * 60) this.chain = 0;
    for (const e of this.ents) {
      if (e.cool > 0) e.cool--;
      if (e.hurt > 0) e.hurt--;
      if (e.flash > 0) e.flash--;
    }
    for (const e of this.ents) if (!e.dead && e.kind === 'monster') this.monsterStep(e);

    if (this.proj) {
      const p = this.proj;
      p.steps++;
      const b = p.body;
      if (this.wpn.align) {
        const v = b.velocity;
        if (Math.hypot(v.x, v.y) > 0.2) MatterLib.Body.setAngle(b, Math.atan2(v.y, v.x) + Math.PI / 2);
        MatterLib.Body.setAngularVelocity(b, 0);
      }
      this.wpn.onUpdate?.(this, p);
      if (this.proj === p) {
        const speed = Math.hypot(b.velocity.x, b.velocity.y);
        p.slow = speed < 0.3 ? p.slow + 1 : 0;
        const out = b.position.x > this.worldW + 40 || b.position.x < -40 || b.position.y > H + 40;
        if (out || p.slow > 40 || p.steps > 60 * 6) this.endProj(p);
      }
    }
    this.actors = this.actors.filter((a) => {
      const done = a.update();
      if (done) a.destroy();
      return !done;
    });
    const busy = !!this.proj || this.actors.some((a) => !!a.pos);
    if (this.state === 'flying' && !busy) {
      this.state = 'settling';
      this.settleSteps = 0;
    }

    const alive = this.ents.filter((e) => !e.dead);
    const monsters = alive.filter((e) => e.kind === 'monster').length;
    if (this.state !== 'won' && this.state !== 'lost' && this.escaped > (this.level.maxEscapes ?? 99)) {
      this.finish(false, 'escaped');
      return;
    }
    if (this.state === 'flying' || this.state === 'settling') {
      if (monsters === 0) {
        this.endTimer++;
        if (this.endTimer > 45) this.finish(true);
        return;
      }
    }

    if (this.state === 'settling') {
      this.settleSteps++;
      const calm = alive.every((e) => e.body.speed < 0.35 || e.type === 'imp' || e.type === 'skeleton_runner');
      if (((calm && this.settleSteps > 25) || this.settleSteps > 180) && this.atHome()) {
        if (this.shotIdx < this.loadout.length) this.loadNext();
        else this.finish(false, 'shots');
      }
    }
  }

  private syncSprites(time: number): void {
    for (const e of this.ents) {
      if (e.dead) continue;
      const bp = e.body.position;
      if (e.kind === 'block') {
        e.sprite.setPosition(bp.x, bp.y).setRotation(e.body.angle);
        continue;
      }
      const beat = beatBob(time, e.phase);
      const running = e.type === 'skeleton_runner';
      e.sprite.setTexture(e.hurt > 0 ? `${e.type}_hurt` : e.type);
      e.sprite.setPosition(bp.x, bp.y + e.h / 2 - e.size / 2 + 1 + (running ? -Math.abs(Math.sin(this.steps / 4)) * 2 : 0));
      e.sprite.setRotation(e.body.angle);
      const amp = e.size === 32 ? 0.03 : 0.05;
      e.sprite.setScale(running ? 1 : 1 + amp * beat, running ? 1 : 1 - amp * 1.4 * beat);
      if (e.flash > 0) e.sprite.setTintFill(0xffffff);
      else if (e.status.curse > 0) e.sprite.setTint(0xd7a0ff);
      else e.sprite.clearTint();
      e.sprite.setFlipX(running && e.dir < 0);
      e.shieldSprite?.setPosition(bp.x, bp.y).setAlpha(0.55 + 0.2 * beat);
      e.icon?.setPosition(bp.x, bp.y - e.h / 2 - 9);
    }
    if (this.proj) {
      this.proj.sprite.setPosition(this.proj.body.position.x, this.proj.body.position.y);
      this.proj.sprite.setRotation(this.proj.body.angle);
    }
  }

  private drawOverlayGfx(): void {
    const g = this.gfx;
    g.clear();
    const aiming = this.state === 'aiming';
    const pos = aiming ? this.pouch : new Phaser.Math.Vector2(SLING_X, SLING_Y);

    if (this.readySprite.visible || aiming) {
      g.lineStyle(3, C('0'), 1);
      g.lineBetween(SLING_X - 7, SLING_Y + 6, pos.x, pos.y);
      g.lineBetween(SLING_X + 6, SLING_Y + 6, pos.x, pos.y);
      g.lineStyle(1, C('2'), 1);
      g.lineBetween(SLING_X - 7, SLING_Y + 6, pos.x, pos.y);
      g.lineBetween(SLING_X + 6, SLING_Y + 6, pos.x, pos.y);
    }
    if (this.state === 'ready' || aiming) {
      this.readySprite.setPosition(pos.x, pos.y);
      if (aiming) {
        const v = new Phaser.Math.Vector2(SLING_X - pos.x, SLING_Y - pos.y).scale(this.tune.launchK);
        this.readySprite.setRotation(Math.atan2(v.y, v.x) + Math.PI / 2);
        let x = pos.x;
        let y = pos.y;
        let vy = v.y;
        g.fillStyle(C('c'), 1);
        const gr = GRAVITY_STEP * this.wpn.gravity;
        for (let i = 1; i <= 30; i++) {
          x += v.x;
          vy += gr;
          y += vy;
          if (y > GROUND - 2) break;
          if (i % 3 === 0 && i <= 24) g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        }
      }
    }
    if (this.proj) this.wpn.drawFx?.(this, this.proj, g);
  }

  // ------------------------------------------------------------------ end screens

  private finish(won: boolean, why: 'shots' | 'escaped' = 'shots'): void {
    if (this.state === 'won' || this.state === 'lost') return;
    this.state = won ? 'won' : 'lost';
    won ? sfx.win() : sfx.lose();
    const shotsLeft = this.loadout.length - this.shotIdx;
    if (won && shotsLeft > 0) {
      this.score += shotsLeft * this.tune.shotBonusPoints;
      this.coins += shotsLeft * this.tune.shotBonusCoins;
    }
    const target = this.level.scoreTarget ?? 0;
    const stars = won ? 1 + (shotsLeft > 0 ? 1 : 0) + (target > 0 && this.score >= target ? 1 : 0) : 0;
    if (won) {
      progress.reached = Math.max(progress.reached, this.levelId + 1);
      progress.bestStars[this.levelId] = Math.max(progress.bestStars[this.levelId] ?? 0, stars);
    }
    this.uiMode = true;
    this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.68).setDepth(20);
    text(this, W / 2, 96, won ? 'Level cleared!' : why === 'escaped' ? 'Too many got away' : 'Out of shots', won ? C('4') : C('3'), 2, C('0')).setDepth(21);
    if (won) {
      for (let i = 0; i < 3; i++) this.add.image(W / 2 - 22 + i * 22, 140, i < stars ? 'star_on' : 'star_off').setScale(2).setDepth(21);
      text(this, W / 2, 168, `Score ${this.score}`, C('c')).setDepth(21);
      if (target > 0) text(this, W / 2, 182, stars === 3 ? 'Score target beaten' : `Beat ${target} for the third star`, C('d')).setDepth(21);
      text(this, W / 2, 198, `Coins ${this.coins}`, C('4')).setDepth(21);
    } else {
      text(this, W / 2, 138, why === 'escaped' ? 'Stop the runners early.' : 'Try a different order.', C('c')).setDepth(21);
    }
    const next = won && this.levelId < MAX_LEVEL;
    makeButton(this, W / 2, 238, 120, 30, won ? (next ? 'Next level' : 'Play again') : 'Try again', 'go', () => {
      sfx.click();
      if (won) this.scene.start('loadout', { level: next ? this.levelId + 1 : 1 });
      else this.scene.restart({ level: this.levelId, loadout: this.loadout });
    }, 22);
    makeButton(this, W / 2, 276, 120, 26, won ? 'Replay' : 'Change loadout', 'plain', () => {
      sfx.click();
      if (won) this.scene.restart({ level: this.levelId, loadout: this.loadout });
      else this.scene.start('loadout', { level: this.levelId });
    }, 22);
    this.uiMode = false;
  }
}
