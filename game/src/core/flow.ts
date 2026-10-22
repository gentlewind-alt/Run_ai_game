// Scene transitions with a star-shaped iris. goTo() closes the iris on the current scene, stops every other scene
// (so a battle behind a results panel goes away), then starts the target, which calls irisOpen() in its create().
import Phaser from 'phaser';
import { W, H } from '../config/constants';

type Wrap = <T>(fn: () => T) => T;
const R_MAX = Math.hypot(W, H) * 0.62;
const IRIS_MS = 300;

function starPoints(cx: number, cy: number, r: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  return pts;
}

/** A black cover with a star-shaped hole of radius `from`, animated to `to`. */
function iris(scene: Phaser.Scene, from: number, to: number, done?: () => void, wrap: Wrap = (fn) => fn()): void {
  const cover = wrap(() => scene.add.rectangle(W / 2, H / 2, W + 4, H + 4, 0x111322).setDepth(100000).setScrollFactor(0));
  const hole = scene.make.graphics({ x: 0, y: 0 }, false);
  const mask = hole.createGeometryMask();
  mask.setInvertAlpha(true);
  cover.setMask(mask);
  const draw = (r: number): void => {
    hole.clear();
    hole.fillStyle(0xffffff, 1);
    if (r > 0.5) hole.fillPoints(starPoints(W / 2, H / 2, r), true);
  };
  draw(from);
  // An opening iris must never leave its black cover up if the scene's clock stalls (the host throttles, the scene restarts).
  if (to >= R_MAX - 1) {
    setTimeout(() => {
      if (cover.active) cover.destroy();
      if (hole.active) hole.destroy();
    }, IRIS_MS + 500);
  }
  scene.tweens.addCounter({
    from: 0, to: 1, duration: IRIS_MS, ease: 'Cubic.inOut',
    onUpdate: (tw) => draw(from + (to - from) * (tw.getValue() ?? 0)),
    onComplete: () => {
      if (to >= R_MAX - 1) {
        if (cover.active) cover.destroy();
        if (hole.active) hole.destroy();
      }
      done?.();
    },
  });
}

/** Opens the iris at the start of a scene. Battle scenes pass `wrap` so the cover lands on the fixed UI camera. */
export function irisOpen(scene: Phaser.Scene, wrap?: Wrap): void {
  iris(scene, 0, R_MAX, undefined, wrap);
}

/** Transition to another scene with the iris. Stops all other running scenes first. */
export function goTo(from: Phaser.Scene, key: string, data?: object): void {
  let went = false;
  const go = (): void => {
    if (went) return;
    went = true;
    const mgr = from.scene.manager;
    for (const s of mgr.scenes) {
      if (s !== from && s.scene.key !== 'boot') {
        mgr.stop(s.scene.key);
      }
    }
    from.scene.start(key, data);
  };
  iris(from, R_MAX, 0, go);
  // The iris is a tween: if the host throttles or stalls the scene's clock the transition must still happen.
  setTimeout(go, IRIS_MS + 400);
}
