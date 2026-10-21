// Implements BattleCtx over a BattleState: the only door content code uses to touch the battle.
import Phaser from 'phaser';
import { blast, damage, damageAround, directHit, explode, push } from './damage';
import {
  bolt, popWord, ring, shake, burst, electricField, quakeRings,
  pingStar, flameBlast, webStrand, webSplat, muzzleFlash,
} from './fx';
import { MatterLib } from './matter';
import { endProj, setGravity, spawnPellet } from './projectiles';
import { escape } from './rules';
import { addCoins } from './score';
import { inflict } from './status';
import { groundAt } from './terrain';
import type { BattleCtx, Ent } from './BattleCtx';
import type { BattleState } from './state';

export function makeCtx(b: BattleState): BattleCtx {
  const living = (kind: Ent['kind']): Ent[] => b.ents.filter((e) => !e.dead && e.kind === kind);
  const dist = (x: number, y: number, e: Ent): number => Phaser.Math.Distance.Between(x, y, e.body.position.x, e.body.position.y);
  return {
    get step() { return b.steps; },
    stepHz: b.settings.physics.stepHz,
    rng: b.rng,
    tune: b.tune,
    rules: b.rules,
    events: b.events,
    sling: { x: b.slingX, y: b.slingY },
    groundY: b.groundY,
    groundAt: (x) => groundAt(b, x),
    worldW: b.worldW,
    level: b.level,
    get phase() { return b.state; },
    mods: b.mods,
    M: MatterLib,

    monsters: () => living('monster'),
    blocks: () => living('block'),
    within: (x, y, r) => living('monster').filter((e) => dist(x, y, e) <= r),
    nearestMonsters: (x, y, n) => living('monster').sort((a, c) => dist(x, y, a) - dist(x, y, c)).slice(0, n),
    shotPos: () => (b.proj ? { x: b.proj.body.position.x, y: b.proj.body.position.y } : null),

    damage: (t, amount, x, y, o) => damage(b, t, amount, x, y, o),
    directHit: (t, wid, mult, x, y, strong) => directHit(b, t, wid, mult, x, y, strong),
    damageAround: (x, y, r, mult, wid) => damageAround(b, x, y, r, mult, wid),
    blast: (x, y, r, mult, wid) => blast(b, x, y, r, mult, wid),
    explode: (x, y, r, base, exclude, wid) => explode(b, x, y, r, base, exclude, wid),
    addStatus: (t, status, steps) => inflict(b, t, status, steps),
    push: (x, y, r, strength) => push(b, x, y, r, strength),
    setGravity,
    addActor: (a) => { b.actors.push(a); },
    spawnPellet: (o) => spawnPellet(b, o),
    endProj: (p) => endProj(b, p),
    escape: (e) => escape(b, e),
    addCoins: (n) => addCoins(b, n),
    reveal: (e) => {
      e.revealed = true;
      if (e.weak && !e.icon) e.icon = b.scene.add.image(e.body.position.x, e.body.position.y, `el_${e.weak}`).setDepth(8);
    },
    hitStop: (frames) => { b.hitStop = frames; },
    flash: (color = 0xffffff, durMs = 80) => {
      b.scene.cameras.main.flash(durMs, (color >> 16) & 255, (color >> 8) & 255, color & 255);
    },

    fx: {
      ring: (x, y, r, color) => ring(b, x, y, r, color),
      sparks: (x, y, colors, n) => burst(b, x, y, colors, n),
      shake: (i) => shake(b, i),
      dot: (x, y, r, fill, stroke) => b.scene.add.circle(x, y, r, fill).setStrokeStyle(1, stroke).setDepth(6),
      image: (x, y, key) => b.scene.add.image(x, y, key),
      word: (x, y, word) => popWord(b, x, y, word),
      bolt: (x, y) => bolt(b, x, y),
      electricField: (x, y, r, steps) => electricField(b, x, y, r, steps),
      quakeRings: (x, y, rangeX) => quakeRings(b, x, y, rangeX),
      pingStar: (x, y) => pingStar(b, x, y),
      flameBlast: (x, y, r, steps) => flameBlast(b, x, y, r, steps),
      webStrand: (x0, y0, x1, y1, steps) => webStrand(b, x0, y0, x1, y1, steps),
      webSplat: (x, y, steps) => webSplat(b, x, y, steps),
      muzzleFlash: (x, y) => muzzleFlash(b, x, y),
    },
  };
}
