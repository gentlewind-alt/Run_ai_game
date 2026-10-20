import Phaser from 'phaser';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { C, css } from '../palette';
import { gridTexture, pixText, setPixText } from '../pix';
import { BLADE, GOBLIN_HURT, GOBLIN_IDLE, SPK_OFF, SPK_ON, STAR_OFF, STAR_ON } from '../sprites';
import { sfx } from '../audio';
import { WEAPONS, type Proj, type WeaponImpl } from '../weapons';

export const W = 216;
export const H = 384;
const GROUND = 320;
const STEP = 1000 / 60;
const GRAVITY_STEP = 0.001 * STEP * STEP; // matter gravity per step, px/step^2

// Feel/balance numbers live in content.json (tuning, damageRules.globalScale).
const SLING_X = 38;
const SLING_Y = 262;

const MatterLib: any = (Phaser.Physics.Matter as any).Matter;

type Kind = 'block' | 'monster';
interface Ent {
  kind: Kind;
  body: any;
  sprite: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  mat: string; // 'wood' | 'stone' | 'goblin_grunt'
  weak: string | null;
  resist: string | null;
  w: number;
  h: number;
  cool: number;
  hurt: number;
  dead: boolean;
  phase: number;
}
type State = 'intro' | 'ready' | 'aiming' | 'flying' | 'settling' | 'won' | 'lost';

export default class GameScene extends Phaser.Scene {
  private content!: any;
  private level!: any;
  private ents: Ent[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private state: State = 'ready';
  private shotsLeft = 0;
  private coins = 0;
  private acc = 0;
  private hitStop = 0;
  private proj: Proj | null = null;
  private wpn!: WeaponImpl;
  private worldW = W;
  private maxSpeed = 8;
  private lastStretch = 0;
  tune: any;
  private pouch = new Phaser.Math.Vector2(SLING_X, SLING_Y);
  private readySprite!: Phaser.GameObjects.Image;
  private settleSteps = 0;
  private endTimer = 0;
  private hudCoins!: Phaser.GameObjects.Image;
  private hudShots: Phaser.GameObjects.Image[] = [];
  private hudTop = 6;
  private muteBtn!: Phaser.GameObjects.Image;
  private parts: { s: Phaser.GameObjects.Image; vx: number; vy: number; life: number }[] = [];
  private overlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.json('content', 'data/content.json');
    this.load.json('level1', 'data/level_01.json');
  }

  create(): void {
    this.content = this.cache.json.get('content');
    this.level = this.cache.json.get('level1');
    this.tune = this.content.tuning;
    this.worldW = this.level.worldW ?? W;
    this.maxSpeed = this.tune.maxPull * this.tune.launchK;
    this.wpn = WEAPONS[this.level.weapon];
    this.ents = [];
    this.parts = [];
    this.overlay = [];
    this.hudShots = [];
    this.state = 'intro';
    this.coins = 0;
    this.acc = 0;
    this.hitStop = 0;
    this.proj = null;
    this.settleSteps = 0;
    this.endTimer = 0;
    this.shotsLeft = this.level.shots;

    this.makeTextures();
    this.add.image(0, 0, `bg_${this.worldW}`).setOrigin(0);
    this.matter.add.rectangle(this.worldW / 2, GROUND + 40, this.worldW + 400, 80, { isStatic: true, friction: 1, label: 'ground' });
    this.matter.add.rectangle(this.worldW + 10, 200, 20, 600, { isStatic: true, label: 'wall' });
    this.cameras.main.setBounds(0, 0, this.worldW, H);
    this.cameras.main.setScroll(0, 0);

    this.add.image(SLING_X, SLING_Y + 28, 'sling');
    for (const b of this.level.blocks) this.addBlock(b.m, b.x, b.y, b.w, b.h);
    for (const m of this.level.monsters) this.addMonster(m.t, m.x, m.y);

    this.gfx = this.add.graphics().setDepth(5);
    this.readySprite = this.add.image(SLING_X, SLING_Y, 'blade').setDepth(6);
    this.readySprite.setRotation(Math.PI / 4);

    this.buildHud();
    this.matter.world.on('collisionstart', this.onCollide, this);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    try {
      RundotGameAPI.appStorage.getItem('muted').then((v: string | null) => {
        sfx.setMuted(v === '1');
        this.muteBtn?.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      }).catch(() => {});
    } catch { /* storage optional */ }

    if (this.worldW > W) {
      this.tweens.add({
        targets: this.cameras.main, scrollX: this.worldW - W, duration: 900, ease: 'Sine.inOut', hold: 450, yoyo: true,
        onComplete: () => { this.state = 'ready'; },
      });
    } else {
      this.state = 'ready';
    }

    if ((import.meta as any).env?.DEV) (window as any).__scene = this;
  }

  // ------------------------------------------------------------------ setup

  private makeTextures(): void {
    gridTexture(this, 'goblin_grunt', GOBLIN_IDLE);
    gridTexture(this, 'goblin_grunt_hurt', GOBLIN_HURT);
    gridTexture(this, 'blade', BLADE);
    gridTexture(this, 'spk_on', SPK_ON);
    gridTexture(this, 'spk_off', SPK_OFF);
    gridTexture(this, 'star_on', STAR_ON);
    gridTexture(this, 'star_off', STAR_OFF);

    if (!this.textures.exists('px')) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      cv.getContext('2d')!.fillStyle = '#fff';
      cv.getContext('2d')!.fillRect(0, 0, 1, 1);
      this.textures.addCanvas('px', cv);
    }

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
        const key = this.blockKey(b.m, b.w, b.h, cracked);
        make(key, b.w, b.h, (g) => {
          const stone = b.m === 'stone';
          rect(g, 'v', 0, 0, b.w, b.h);
          rect(g, stone ? 'k' : 'g', 1, 1, b.w - 2, b.h - 2);
          rect(g, stone ? 'l' : 'i', 1, 1, b.w - 2, 1);
          rect(g, stone ? 'm' : 'h', 1, b.h - 2, b.w - 2, 1);
          if (!stone) {
            const long = Math.max(b.w, b.h);
            for (let i = 6; i < long - 2; i += 7) {
              if (b.w >= b.h) rect(g, 'h', i, 2, 1, b.h - 4);
              else rect(g, 'h', 2, i, b.w - 4, 1);
            }
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
      rect(g, 'h', 7, 16, 3, 32);
      rect(g, 'g', 8, 16, 1, 32);
      rect(g, 'h', 3, 4, 3, 14);
      rect(g, 'h', 11, 4, 3, 14);
      rect(g, 'g', 4, 4, 1, 14);
      rect(g, 'g', 12, 4, 1, 14);
      rect(g, 'h', 5, 16, 7, 3);
    });

    const WW = this.worldW;
    make(`bg_${WW}`, WW, H, (g) => {
      const bands = ['a', 'a', 'a', 'b', 'b', 'b'];
      bands.forEach((c, i) => rect(g, c, 0, i * 50, WW, 51));
      for (let cx = 0; cx < WW; cx += 216) {
        rect(g, 'c', cx + 30, 40, 26, 6); rect(g, 'c', cx + 38, 34, 14, 6);
        rect(g, 'c', cx + 130, 70, 30, 6); rect(g, 'c', cx + 140, 64, 14, 6);
        rect(g, 'c', cx + 80, 110, 22, 5); rect(g, 'c', cx + 86, 105, 10, 5);
      }
      g.fillStyle = css(C('e'));
      for (let x = 0; x < WW; x++) g.fillRect(x, 230 - Math.round(24 * Math.abs(Math.sin(x / 38 + 0.6))), 1, 100);
      g.fillStyle = css(C('7'));
      for (let x = 0; x < WW; x++) g.fillRect(x, 262 - Math.round(20 * Math.abs(Math.sin(x / 27 + 2))), 1, 100);
      g.fillStyle = css(C('n'));
      for (let x = 0; x < WW; x++) g.fillRect(x, 290 - Math.round(14 * Math.abs(Math.sin(x / 19 + 4))), 1, 100);
      rect(g, '6', 0, GROUND - 3, WW, 3);
      rect(g, '5', 0, GROUND - 3, WW, 1);
      rect(g, 'g', 0, GROUND, WW, H - GROUND);
      rect(g, 'h', 0, GROUND + 6, WW, 2);
      g.fillStyle = css(C('h'));
      for (let i = 0; i < 70 * (WW / W); i++) g.fillRect((i * 37) % WW, GROUND + 10 + ((i * 53) % (H - GROUND - 12)), 2, 1);
    });
  }

  private blockKey(m: string, w: number, h: number, cracked: boolean): string {
    return `blk_${m}_${w}x${h}${cracked ? '_c' : ''}`;
  }

  private addBlock(mat: string, x: number, y: number, w: number, h: number): void {
    const def = this.content.materials.find((m: any) => m.id === mat);
    const body: any = this.matter.add.rectangle(x, y, w, h, {
      density: mat === 'stone' ? 0.0022 : 0.001,
      friction: 0.7, frictionStatic: 1, restitution: 0.05, label: 'block',
    });
    const sprite = this.add.image(x, y, this.blockKey(mat, w, h, false)).setDepth(2);
    const e: Ent = {
      kind: 'block', body, sprite, hp: def.hp, maxHp: def.hp, mat, weak: def.weak ?? null, resist: null,
      w, h, cool: 0, hurt: 0, dead: false, phase: 0,
    };
    body.ent = e;
    this.ents.push(e);
  }

  private addMonster(type: string, x: number, y: number): void {
    const def = this.content.monsters.find((m: any) => m.id === type);
    const body: any = this.matter.add.rectangle(x, y, 12, 14, {
      density: 0.001, friction: 0.6, frictionStatic: 1, restitution: 0.05, label: 'monster',
    });
    const sprite = this.add.image(x, y, type).setDepth(3);
    const e: Ent = {
      kind: 'monster', body, sprite, hp: def.hp, maxHp: def.hp, mat: type, weak: def.weak, resist: def.resist,
      w: 12, h: 14, cool: 0, hurt: 0, dead: false, phase: Math.random() * 6,
    };
    body.ent = e;
    this.ents.push(e);
  }

  private buildHud(): void {
    let top = 6;
    try {
      const sa = RundotGameAPI.system.getSafeArea();
      top = Math.max(6, sa.top * this.scale.displayScale.y);
    } catch { /* not ready: use default */ }
    this.hudTop = top;
    this.hudCoins = pixText(this, 4, top + 3, 'COINS 0', C('4')).setOrigin(0, 0.5).setDepth(10).setScrollFactor(0);
    this.muteBtn = this.add.image(W - 10, top + 4, sfx.muted ? 'spk_off' : 'spk_on').setDepth(10).setScrollFactor(0);
    this.muteBtn.setInteractive(new Phaser.Geom.Rectangle(-10, -10, 29, 27), Phaser.Geom.Rectangle.Contains);
    this.muteBtn.on('pointerdown', () => {
      sfx.unlock();
      sfx.setMuted(!sfx.muted);
      this.muteBtn.setTexture(sfx.muted ? 'spk_off' : 'spk_on');
      sfx.click();
      try { RundotGameAPI.appStorage.setItem('muted', sfx.muted ? '1' : '0').catch(() => {}); } catch { /* optional */ }
    });
    this.refreshShots();
  }

  private refreshShots(): void {
    this.hudShots.forEach((s) => s.destroy());
    this.hudShots = [];
    for (let i = 0; i < this.shotsLeft; i++) {
      this.hudShots.push(this.add.image(8 + i * 11, this.hudTop + 17, 'blade').setScale(0.6).setRotation(Math.PI / 4).setDepth(10).setScrollFactor(0));
    }
  }

  // ------------------------------------------------------------------ input

  private onDown(p: Phaser.Input.Pointer, over: unknown[]): void {
    sfx.unlock();
    if (over.length) return;
    if (this.state === 'ready' && Phaser.Math.Distance.Between(p.worldX, p.worldY, SLING_X, SLING_Y) < 44) {
      this.state = 'aiming';
      this.onMove(p);
    } else if (this.state === 'flying' && this.proj && !this.proj.tapped) {
      this.proj.tapped = true;
      this.wpn.onTap(this, this.proj);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.state !== 'aiming') return;
    const v = new Phaser.Math.Vector2(p.worldX - SLING_X, p.worldY - SLING_Y);
    if (v.length() > this.tune.maxPull) v.setLength(this.tune.maxPull);
    this.pouch.set(SLING_X + v.x, Math.min(SLING_Y + v.y, GROUND - 6));
    const now = this.time.now;
    if (now - this.lastStretch > this.tune.stretchSoundMs) {
      this.lastStretch = now;
      sfx.stretch();
    }
  }

  private onUp(): void {
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
    const body = this.matter.add.circle(this.pouch.x, this.pouch.y, this.wpn.radius, {
      density: this.wpn.density, friction: 0.3, frictionAir: 0, restitution: 0.2, label: 'proj',
    });
    MatterLib.Body.setVelocity(body, { x: v.x, y: v.y });
    MatterLib.Body.setAngularVelocity(body, this.wpn.spin);
    const sprite = this.add.image(this.pouch.x, this.pouch.y, this.wpn.texture).setDepth(4);
    this.proj = { body, sprite, steps: 0, slow: 0, tapped: false, t: 0 };
    this.readySprite.setVisible(false);
    this.pouch.set(SLING_X, SLING_Y);
    this.shotsLeft--;
    this.refreshShots();
    this.state = 'flying';
    this.cameras.main.shake(70, 0.004);
    sfx.launch();
  }

  // ------------------------------------------------------------------ physics events

  private onCollide(ev: any): void {
    for (const pr of ev.pairs) {
      const a: Ent | undefined = pr.bodyA.ent;
      const b: Ent | undefined = pr.bodyB.ent;
      const aProj = pr.bodyA.label === 'proj';
      const bProj = pr.bodyB.label === 'proj';
      const rel = Math.hypot(pr.bodyA.velocity.x - pr.bodyB.velocity.x, pr.bodyA.velocity.y - pr.bodyB.velocity.y);
      if (rel < 1.5) continue;
      const sup = pr.collision?.supports?.[0];
      const cx = sup ? sup.x : (pr.bodyA.position.x + pr.bodyB.position.x) / 2;
      const cy = sup ? sup.y : (pr.bodyA.position.y + pr.bodyB.position.y) / 2;
      this.impact(a, b, bProj ? 'proj' : aProj ? 'proj' : 'other', pr.bodyA, pr.bodyB, rel, cx, cy);
      this.impact(b, a, aProj ? 'proj' : bProj ? 'proj' : 'other', pr.bodyB, pr.bodyA, rel, cx, cy);
    }
  }

  private impact(target: Ent | undefined, other: Ent | undefined, otherKind: 'proj' | 'other', _tb: any, ob: any, rel: number, x: number, y: number): void {
    if (!target || target.dead) return;
    let dmg: number;
    const fromProj = otherKind === 'proj' && ob.label === 'proj';
    if (fromProj) {
      dmg = this.bladeDamage(target, 0.5 + Math.min(rel / this.maxSpeed, 1));
    } else if (other) {
      if (target.cool > 0) return;
      dmg = (rel - 1.5) * Math.sqrt(other.body.mass) * this.tune.debrisK * (target.kind === 'monster' ? 1 : 0.5);
    } else if (ob.label === 'ground' && target.kind === 'monster') {
      dmg = (rel - 3) * 3;
    } else {
      return;
    }
    if (dmg >= 2) this.damage(target, dmg, x, y, fromProj);
  }

  private bladeDamage(t: Ent, impactFactor: number): number {
    const w = this.content.weapons.find((x: any) => x.id === this.level.weapon);
    const el = t.weak === w.element ? this.content.damageRules.elementWeak : t.resist === w.element ? this.content.damageRules.elementResist : 1;
    return w.baseDamage * impactFactor * el * this.content.damageRules.globalScale;
  }

  private damage(t: Ent, dmg: number, x: number, y: number, strong: boolean): void {
    t.hp -= dmg;
    t.cool = 5;
    t.hurt = 14;
    const shown = Math.max(1, Math.round(dmg));
    const ft = pixText(this, x, y - 4, String(shown), strong ? C('4') : C('c')).setDepth(12);
    this.tweens.add({ targets: ft, y: y - 20, alpha: 0, duration: 650, onComplete: () => ft.destroy() });

    const wood = t.mat === 'wood';
    const colors = t.kind === 'monster' ? ['5', '6', '2'] : wood ? ['g', 'i', 'h'] : ['k', 'l', 'm'];
    this.burst(x, y, colors, Math.min(10, 3 + Math.round(dmg / 6)));
    sfx.hit(Math.min(1, dmg / 40));
    this.cameras.main.shake(90, Phaser.Math.Clamp((dmg / 40) * 0.012, 0.002, 0.014));
    if (strong) this.hitStop = this.tune.hitStopFrames;

    if (t.hp <= 0) this.kill(t);
    else if (t.kind === 'block' && t.hp < t.maxHp * 0.5) t.sprite.setTexture(this.blockKey(t.mat, t.w, t.h, true));
  }

  private kill(t: Ent): void {
    t.dead = true;
    this.matter.world.remove(t.body);
    t.sprite.destroy();
    const px = t.body.position.x;
    const py = t.body.position.y;
    const wood = t.mat === 'wood';
    this.burst(px, py, t.kind === 'monster' ? ['5', '6', '4', '2'] : wood ? ['g', 'i', 'h'] : ['k', 'l', 'm'], 14);
    sfx.crunch();
    const gain = t.kind === 'monster' ? this.tune.coins.monster : wood ? this.tune.coins.wood : this.tune.coins.stone;
    this.coins += gain;
    sfx.coin();
    const ft = pixText(this, px, py - 8, `+${gain}`, C('4')).setDepth(12);
    this.tweens.add({ targets: ft, y: py - 26, alpha: 0, duration: 800, onComplete: () => ft.destroy() });
    setPixText(this.hudCoins, this, `COINS ${this.coins}`, C('4'));
    // Sleeping bodies don't wake when a support is removed.
    for (const e of this.ents) if (!e.dead) MatterLib.Sleeping.set(e.body, false);
    this.hitStop = Math.max(this.hitStop, this.tune.hitStopFrames);
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
      this.matter.world.step(STEP);
      this.stepLogic();
    }
    this.updateCamera();
    this.syncSprites(_t);
    this.drawOverlayGfx();
  }

  private updateCamera(): void {
    const cam = this.cameras.main;
    const maxScroll = this.worldW - W;
    let target: number | null = null;
    if (this.state === 'flying' && this.proj) target = Phaser.Math.Clamp(this.proj.body.position.x - W * 0.35, 0, maxScroll);
    else if (this.state === 'settling' && this.settleSteps > 45) target = 0;
    if (target !== null) {
      cam.scrollX += (target - cam.scrollX) * 0.1;
      if (Math.abs(cam.scrollX - target) < 0.5) cam.scrollX = target;
    }
  }

  private stepLogic(): void {
    for (const e of this.ents) {
      if (e.cool > 0) e.cool--;
      if (e.hurt > 0) e.hurt--;
    }
    const alive = this.ents.filter((e) => !e.dead);
    const monsters = alive.filter((e) => e.kind === 'monster').length;

    if (this.state === 'flying' && this.proj) {
      const p = this.proj;
      p.steps++;
      const b = p.body;
      this.wpn.onUpdate(this, p);
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      p.slow = speed < 0.3 ? p.slow + 1 : 0;
      const out = b.position.x > this.worldW + 40 || b.position.x < -40 || b.position.y > H + 40;
      if (out || p.slow > 40 || p.steps > 60 * 5) {
        this.matter.world.remove(b);
        p.sprite.destroy();
        this.proj = null;
        this.state = 'settling';
        this.settleSteps = 0;
      }
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
      const calm = alive.every((e) => e.body.speed < 0.35);
      if (((calm && this.settleSteps > 25) || this.settleSteps > 180) && this.cameras.main.scrollX < 3) {
        if (this.shotsLeft > 0) {
          this.state = 'ready';
          this.cameras.main.scrollX = 0;
          this.readySprite.setVisible(true);
        } else {
          this.finish(false);
        }
      }
    }
  }

  /** Hit everything within a box of half-size r around (x, y). Used by area/contact tap moves. */
  damageAround(x: number, y: number, r: number, factor: number): void {
    const hits = MatterLib.Query.region(MatterLib.Composite.allBodies(this.matter.world.engine.world), {
      min: { x: x - r, y: y - r },
      max: { x: x + r, y: y + r },
    });
    for (const o of hits) {
      const t: Ent | undefined = o.ent;
      if (!t || t.dead) continue;
      this.damage(t, this.bladeDamage(t, 1) * factor, x, y, false);
    }
  }

  private syncSprites(time: number): void {
    for (const e of this.ents) {
      if (e.dead) continue;
      e.sprite.setPosition(e.body.position.x, e.body.position.y);
      e.sprite.setRotation(e.body.angle);
      if (e.kind === 'monster') {
        const beat = Math.sin(time / 1000 * Math.PI * 4 + e.phase);
        e.sprite.setTexture(e.hurt > 0 ? `${e.mat}_hurt` : e.mat);
        e.sprite.setScale(1 + 0.05 * beat, 1 - 0.07 * beat);
        e.sprite.y += 1;
      }
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

    // bands
    g.lineStyle(2, C('2'), 1);
    g.lineBetween(SLING_X - 6, SLING_Y + 6, pos.x, pos.y);
    g.lineBetween(SLING_X + 5, SLING_Y + 6, pos.x, pos.y);

    if (this.state === 'ready' || aiming) {
      this.readySprite.setPosition(pos.x, pos.y);
      if (aiming) {
        const v = new Phaser.Math.Vector2(SLING_X - pos.x, SLING_Y - pos.y).scale(this.tune.launchK);
        this.readySprite.setRotation(Math.atan2(v.y, v.x) + Math.PI / 2);
        let x = pos.x;
        let y = pos.y;
        let vy = v.y;
        g.fillStyle(C('c'), 1);
        for (let i = 1; i <= 30; i++) {
          x += v.x;
          vy += GRAVITY_STEP;
          y += vy;
          if (y > GROUND - 2) break;
          if (i % 3 === 0 && i <= 24) g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        }
      }
    }

    if (this.proj) this.wpn.drawFx(this, this.proj, g);
  }

  // ------------------------------------------------------------------ end screens

  private finish(won: boolean): void {
    if (this.state === 'won' || this.state === 'lost') return;
    this.state = won ? 'won' : 'lost';
    won ? sfx.win() : sfx.lose();
    const shade = this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.65).setDepth(20).setScrollFactor(0);
    this.overlay.push(shade);
    const title = pixText(this, W / 2, 130, won ? 'MASHED!' : 'OUT OF SHOTS', won ? C('4') : C('3'), won ? 4 : 2).setDepth(21).setScrollFactor(0);
    this.overlay.push(title);
    if (won) {
      const stars = 1 + (this.shotsLeft > 0 ? 1 : 0);
      for (let i = 0; i < 3; i++) {
        this.overlay.push(this.add.image(W / 2 - 22 + i * 22, 172, i < stars ? 'star_on' : 'star_off').setScale(2).setDepth(21).setScrollFactor(0));
      }
    }
    this.overlay.push(pixText(this, W / 2, 205, `COINS ${this.coins}`, C('4'), 2).setDepth(21).setScrollFactor(0));

    const btn = this.add.rectangle(W / 2, 255, 80, 26, C('6')).setStrokeStyle(1, C('0')).setDepth(21).setScrollFactor(0);
    btn.setInteractive({ useHandCursor: true });
    this.overlay.push(btn, pixText(this, W / 2, 255, won ? 'AGAIN' : 'RETRY', C('c'), 2).setDepth(22).setScrollFactor(0));
    btn.on('pointerdown', () => {
      sfx.click();
      this.scene.restart();
    });
  }
}
