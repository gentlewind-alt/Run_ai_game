// Local debug panel (a DOM overlay). Only loaded when DEBUG is on (?debug=1 on localhost or the dev server; see core/profile.ts).
// Toggle with the backtick key. Everything here also lives on window.__dbg for the console.
import type Phaser from 'phaser';
import { music } from '../audio/music';
import { data } from '../data/load';
import { damage } from '../battle/damage';
import { finish } from '../battle/rules';
import { profile } from '../core/profile';

export function installDebugPanel(game: Phaser.Game): void {
  const mm = (): any => (window as any).__mm;
  const battleScene = (): any => game.scene.getScene('game');
  const battle = (): any => {
    const s = battleScene();
    return s && game.scene.isActive('game') ? s.getBattle?.() : undefined;
  };
  const levelIds = (): number[] => Object.keys(data.levels).map(Number).filter((n) => n > 0 && n < 90).sort((a, b) => a - b);
  const currentLevel = (): number => battle()?.levelId ?? 0;

  const dbg = {
    killMonsters(): void {
      const b = battle();
      if (!b) return;
      for (const e of b.ents.filter((x: any) => x.kind === 'monster' && !x.dead)) damage(b, e, 1e6, e.body.position.x, e.body.position.y, { strong: false, tag: 'norm' });
    },
    win(): void { dbg.killMonsters(); },
    lose(): void { const b = battle(); if (b) finish(b, false, 'shots'); },
    restart(): void { dbg.goto(currentLevel() || 1); },
    goto(n: number): void { if (data.levels[n]) mm()?.load(n); },
    step(delta: number): void {
      const ids = levelIds();
      const i = ids.indexOf(currentLevel());
      dbg.goto(ids[Math.max(0, Math.min(ids.length - 1, (i < 0 ? 0 : i) + delta))]);
    },
    map(): void { for (const s of game.scene.getScenes(true)) if (s.scene.key !== 'boot') game.scene.stop(s.scene.key); game.scene.start('map'); },
    coins(n = 10000): void { mm()?.give({ coins: n }); },
    unlockAll(): void { mm()?.give({ unlockAll: true }); },
    moreShots(n = 3): void {
      const b = battle();
      if (!b) return;
      const ids = b.loadout.slice(-1);
      for (let i = 0; i < n; i++) b.loadout.push(ids[0] ?? 'w_militia_blade');
    },
    physicsDraw(): void {
      const s = battleScene();
      const w = s?.matter?.world;
      if (!w) return;
      if (!w.debugGraphic) w.createDebugGraphic();
      w.drawDebug = !w.drawDebug;
      w.debugGraphic.setVisible(w.drawDebug);
      if (!w.drawDebug) w.debugGraphic.clear();
    },
    track(theme: string, variant = currentLevel(), boss = false): void { music.play({ theme, variant, boss }); },
    state(): Record<string, unknown> {
      const b = battle();
      const mus = music.current();
      return {
        fps: Math.round(game.loop.actualFps),
        scenes: game.scene.getScenes(true).map((s) => s.scene.key).join(','),
        level: b?.levelId ?? '-',
        state: b?.state ?? '-',
        steps: b?.steps ?? '-',
        shotsLeft: b ? b.loadout.length - b.shotIdx : '-',
        monsters: b ? b.ents.filter((e: any) => e.kind === 'monster' && !e.dead).length : '-',
        blocks: b ? b.ents.filter((e: any) => e.kind === 'block' && !e.dead).length : '-',
        coins: profile.coins,
        music: mus ? `${mus.theme}${mus.boss ? ' boss' : ''} v${mus.variant ?? 0}` : 'off',
      };
    },
  };
  (window as any).__dbg = dbg;

  const root = document.createElement('div');
  root.id = 'dbg-panel';
  root.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;font:11px/1.35 monospace;color:#e8e8e8;background:rgba(10,12,24,.88);border:1px solid #41a6f6;padding:6px 8px;border-radius:4px;max-width:260px;display:none;user-select:none';
  const info = document.createElement('div');
  info.style.cssText = 'white-space:pre;margin-bottom:6px';
  root.appendChild(info);
  const btn = (label: string, fn: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font:11px monospace;margin:1px;padding:2px 5px;background:#29366f;color:#fff;border:1px solid #566c86;border-radius:3px;cursor:pointer';
    b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
    return b;
  };
  const row = (...bs: Node[]): void => { const d = document.createElement('div'); bs.forEach((x) => d.appendChild(x)); root.appendChild(d); };
  row(btn('Win', dbg.win), btn('Lose', dbg.lose), btn('Restart', dbg.restart), btn('Map', dbg.map));
  row(btn('Prev lvl', () => dbg.step(-1)), btn('Next lvl', () => dbg.step(1)), btn('+3 shots', () => dbg.moreShots(3)));
  row(btn('+10k coins', () => dbg.coins(10000)), btn('Unlock all', dbg.unlockAll), btn('Physics', dbg.physicsDraw));
  const themeSel = document.createElement('select');
  themeSel.style.cssText = 'font:11px monospace;margin:2px 2px 0 1px';
  for (const t of Object.keys(data.music?.themes ?? {})) themeSel.add(new Option(t, t));
  const boss = document.createElement('input');
  boss.type = 'checkbox';
  row(themeSel, btn('Play', () => dbg.track(themeSel.value, currentLevel() || 1, boss.checked)), boss, document.createTextNode(' boss'));
  document.body.appendChild(root);

  const tick = (): void => {
    if (root.style.display !== 'none') info.textContent = Object.entries(dbg.state()).map(([k, v]) => `${k.padEnd(9)} ${v}`).join('\n');
  };
  setInterval(tick, 250);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      root.style.display = root.style.display === 'none' ? 'block' : 'none';
      tick();
    }
  });
  // a small hint so the panel can be found
  const hint = document.createElement('div');
  hint.textContent = 'debug: ` for panel';
  hint.style.cssText = 'position:fixed;bottom:4px;left:6px;z-index:99998;font:10px monospace;color:#94b0c2;opacity:.7;pointer-events:none';
  document.body.appendChild(hint);
  console.info('[debug] panel on (backtick). window.__dbg has win(), lose(), goto(n), coins(), unlockAll(), moreShots(), physicsDraw(), track(theme, variant, boss), state(); window.__mm is the test hook.');
}
