// Skippable how-to cards. The words live in public/data/tutorials.json. A section opens by itself the first time a scene asks for it,
// the player can Skip it (or Skip all), and a "?" button reopens any section. Seen sections are remembered in profile.flags (tut_<id>).
import Phaser from 'phaser';
import { C } from '../art/palette';
import { text, textBlock } from '../art/font5x7';
import { sfx } from '../audio/sfx';
import { H, W } from '../config/constants';
import { feature } from '../config/settings';
import { changed, profile } from '../core/profile';
import { data } from '../data/load';
import { makeButton, panel } from './widgets';

export interface TutorialPage { title: string; body: string }
export interface TutorialSection { title: string; pages: TutorialPage[] }
const DEPTH = 200;
let open = 0;

const sections = (): Record<string, TutorialSection> => data.tutorials?.sections ?? {};
export const tutorialOpen = (): boolean => open > 0;
export const tutorialSeen = (id: string): boolean => !!profile.flags[`tut_${id}`];
const markSeen = (id: string): void => { profile.flags[`tut_${id}`] = true; changed('flags'); };

/** Opens a section. `auto` marks it seen as soon as it is shown or skipped, so it does not come back by itself. */
export function openTutorial(scene: Phaser.Scene, id: string, onClose?: () => void): void {
  const section = sections()[id];
  if (!section || !section.pages.length) { onClose?.(); return; }
  open++;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.78).setDepth(DEPTH).setInteractive();
  objs.push(dim);
  const pw = 360, ph = 156, px = (W - pw) / 2, py = (H - ph) / 2;
  objs.push(panel(scene, px, py, pw, ph, '8', '9', 'f', DEPTH + 1));
  let page = 0;
  let content: Phaser.GameObjects.GameObject[] = [];
  const buttons: ReturnType<typeof makeButton>[] = [];
  const close = (): void => {
    markSeen(id);
    content.forEach((o) => o.destroy());
    objs.forEach((o) => o.destroy());
    buttons.forEach((b) => b.box.destroy());
    open = Math.max(0, open - 1);
    onClose?.();
  };
  const draw = (): void => {
    content.forEach((o) => o.destroy());
    content = [];
    const p = section.pages[page];
    content.push(text(scene, W / 2, py + 14, section.title, C('4'), 1, C('0')).setDepth(DEPTH + 2));
    content.push(text(scene, W / 2, py + 32, p.title, C('c'), 1, C('0')).setDepth(DEPTH + 2));
    const lines = textBlock(scene, px + 16, py + 54, p.body, C('d'), pw - 32, C('0'));
    lines.forEach((l) => { l.setOrigin(0, 0.5).setDepth(DEPTH + 2); content.push(l); });
    content.push(text(scene, W / 2, py + ph - 38, `${page + 1} / ${section.pages.length}`, C('e'), 1, C('0')).setDepth(DEPTH + 2));
    nextBtn.setLabel(page === section.pages.length - 1 ? 'Done' : 'Next');
  };
  const nextBtn = makeButton(scene, px + pw - 52, py + ph - 18, 80, 22, 'Next', 'go', () => {
    sfx.click();
    if (page < section.pages.length - 1) { page++; draw(); } else close();
  }, DEPTH + 3);
  const skipBtn = makeButton(scene, px + 48, py + ph - 18, 80, 22, 'Skip', 'plain', () => { sfx.click(); close(); }, DEPTH + 3);
  const skipAll = makeButton(scene, W / 2 + 4, py + ph - 18, 90, 22, 'Skip all', 'plain', () => { sfx.click(); profile.flags.tut_off = true; changed('flags'); close(); }, DEPTH + 3);
  buttons.push(nextBtn, skipBtn, skipAll);
  draw();
}

/** Shows the section once, on the player's first visit, unless tutorials are off or they chose Skip all. */
export function maybeTutorial(scene: Phaser.Scene, ids: string | string[], delayMs = 450): void {
  const queue = (Array.isArray(ids) ? ids : [ids]).filter((id) => sections()[id] && !tutorialSeen(id));
  if (!feature('tutorial') || profile.flags.tut_off || !queue.length) return;
  const next = (): void => {
    const id = queue.shift();
    if (!id || profile.flags.tut_off || !scene.scene.isActive()) return;
    openTutorial(scene, id, () => scene.time.delayedCall(150, next));
  };
  scene.time.delayedCall(delayMs, () => { if (scene.scene.isActive() && !tutorialOpen()) next(); });
}

/** A list of sections to read again. `ids` limits it to the topics that fit the current screen. */
export function openGuides(scene: Phaser.Scene, ids?: string[]): void {
  const all = sections();
  const list = (ids ?? Object.keys(all)).filter((id) => all[id]);
  if (!list.length) return;
  open++;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const buttons: ReturnType<typeof makeButton>[] = [];
  objs.push(scene.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.78).setDepth(DEPTH).setInteractive());
  const cols = 2, rows = Math.ceil(list.length / cols);
  const pw = 360, ph = 52 + rows * 26 + 34, px = (W - pw) / 2, py = Math.max(6, (H - ph) / 2);
  objs.push(panel(scene, px, py, pw, ph, '8', '9', 'f', DEPTH + 1));
  objs.push(text(scene, W / 2, py + 14, 'How to play', C('4'), 1, C('0')).setDepth(DEPTH + 2));
  const close = (): void => { objs.forEach((o) => o.destroy()); buttons.forEach((b) => b.box.destroy()); open = Math.max(0, open - 1); };
  list.forEach((id, i) => {
    const x = px + 16 + 80 + (i % cols) * 168, y = py + 40 + Math.floor(i / cols) * 26;
    buttons.push(makeButton(scene, x, y, 160, 22, all[id].title.slice(0, 22), 'plain', () => { sfx.click(); close(); openTutorial(scene, id); }, DEPTH + 3));
  });
  buttons.push(makeButton(scene, W / 2, py + ph - 18, 90, 22, 'Close', 'go', () => { sfx.click(); close(); }, DEPTH + 3));
}

/** The small "?" button. */
export function helpButton(scene: Phaser.Scene, x: number, y: number, ids?: string[], depth = 60): ReturnType<typeof makeButton> {
  return makeButton(scene, x, y, 24, 22, '?', 'plain', () => { sfx.click(); openGuides(scene, ids); }, depth);
}
