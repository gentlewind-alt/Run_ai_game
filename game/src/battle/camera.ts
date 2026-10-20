// The view: intro pan, shot follow, pinch/pan/zoom, view-all, and the UI camera that keeps the HUD fixed.
import Phaser from 'phaser';
import { H, W } from '../config/constants';
import type { BattleState } from './state';

/** Adds the fixed UI camera. Objects created while `b.uiMode` is true are drawn by it only; everything else by the world camera. */
export function setupCameras(b: BattleState): void {
  b.uiMode = false;
  b.uiCam = b.scene.cameras.add(0, 0, W, H);
  const route = (go: Phaser.GameObjects.GameObject): void => {
    if (b.uiMode) b.scene.cameras.main.ignore(go);
    else b.uiCam.ignore(go);
  };
  b.scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, route);
  b.scene.events.once('shutdown', () => b.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, route));
}

export function minZoom(b: BattleState): number {
  return Math.min(1, W / b.worldW);
}

export function clampCx(b: BattleState, cx: number, z: number): number {
  const half = W / z / 2;
  return W / z >= b.worldW ? b.worldW / 2 : Phaser.Math.Clamp(cx, half, b.worldW - half);
}

/** Zoom is about the screen centre. Zoomed in the view is bottom-aligned so the ground stays on screen. */
export function setView(b: BattleState, z: number, cx: number): void {
  const C = b.settings.camera;
  b.view.z = Phaser.Math.Clamp(z, minZoom(b), C.maxZoom);
  b.view.cx = clampCx(b, cx, b.view.z);
  const cam = b.scene.cameras.main;
  cam.setZoom(b.view.z);
  cam.scrollX = b.view.cx - W / 2;
  // zoomed in the ground stays at the bottom; zoomed out it rises so the battlefield sits in the middle of the screen
  const groundScreen = H * (C.groundFrac - Math.max(0, 1 - b.view.z) * C.zoomOutRise);
  const cy = b.view.z >= 1 ? H - H / b.view.z / 2 : b.groundY - (groundScreen - H / 2) / b.view.z;
  cam.scrollY = cy - H / 2;
}

export function zoomBy(b: BattleState, f: number, focusScreenX: number): void {
  if (!b.settings.features.zoom) return;
  const v = b.view;
  const z0 = v.z;
  const z1 = Phaser.Math.Clamp(z0 * f, minZoom(b), b.settings.camera.maxZoom);
  const wx = v.cx + (focusScreenX - W / 2) / z0;
  v.z = z1;
  v.cx = clampCx(b, wx - (focusScreenX - W / 2) / z1, z1);
  v.free = true;
}

/** The view-all button: toggles between the default framing and the whole battlefield. */
export function toggleView(b: BattleState): void {
  if (!b.settings.features.zoom) return;
  if (b.state === 'intro' || b.state === 'won' || b.state === 'lost') return;
  const fit = b.view.z > minZoom(b) + 0.01 && b.worldW > W;
  b.view.free = fit;
  b.scene.tweens.add({
    targets: b.view, z: fit ? minZoom(b) : homeZoom(b), cx: fit ? b.worldW / 2 : homeCx(b), duration: b.settings.camera.toggleMs, ease: 'Sine.inOut',
  });
}

function followPos(b: BattleState): { x: number; y: number } | null {
  if (b.proj) return b.proj.body.position;
  for (const a of b.actors) {
    const p = a.pos?.();
    if (p) return p;
  }
  return null;
}

/** Once per frame: follow the shot, return home after it settles, and apply the view to the camera. */
export function updateCamera(b: BattleState): void {
  const v = b.view;
  const C = b.settings.camera;
  if (!v.free) {
    let target: number | null = null;
    const fp = followPos(b);
    if (b.state === 'flying' && fp && C.followShot) target = fp.x + W * C.followLead;
    else if (b.state === 'settling' && b.settleSteps > b.tune.flow.homeSettleSteps) target = homeCx(b);
    if (target !== null) {
      const t = clampCx(b, target, v.z);
      v.cx += (t - v.cx) * C.followEase;
      if (Math.abs(v.cx - t) < 0.5) v.cx = t;
    }
  }
  setView(b, v.z, v.cx);
}

/** Default framing: the sling near the left edge and every monster in view, down to a minimum zoom. */
export function homeZoom(b: BattleState): number {
  if (b.worldW <= W) return 1;
  const maxX = Math.max(...b.level.monsters.map((m) => m.x));
  return Phaser.Math.Clamp(W / (maxX + 28 - b.tune.homeLeft), b.tune.homeZoomMin, 1);
}

export function homeCx(b: BattleState): number {
  return b.tune.homeLeft + W / homeZoom(b) / 2;
}

export function atHome(b: BattleState): boolean {
  const v = b.view;
  return v.free || (Math.abs(v.cx - clampCx(b, homeCx(b), v.z)) < 3 && Math.abs(v.z - homeZoom(b)) < 0.02);
}

/** Screen to world, computed from the view state so it never depends on render timing. */
export function pointerWorld(b: BattleState, p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
  const cam = b.scene.cameras.main;
  return new Phaser.Math.Vector2(cam.scrollX + W / 2 + (p.x - W / 2) / b.view.z, cam.scrollY + H / 2 + (p.y - H / 2) / b.view.z);
}

export function screenDist(b: BattleState, p: Phaser.Input.Pointer, wx: number, wy: number): number {
  const w = pointerWorld(b, p);
  return Phaser.Math.Distance.Between(w.x, w.y, wx, wy) * b.view.z;
}

/** On a wide level the camera pans out to the fort and back, then `done` runs. */
export function introPan(b: BattleState, done: () => void): void {
  const C = b.settings.camera;
  if (b.worldW > W && C.introPan) {
    b.scene.tweens.add({
      targets: b.view, cx: b.worldW - W / homeZoom(b) / 2, duration: C.introMs, ease: 'Sine.inOut', hold: C.introHoldMs, yoyo: true,
      onComplete: done,
    });
  } else {
    done();
  }
}
