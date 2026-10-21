// window.__mm: a scripted-test API (dev and ?debug=1 only). It advances the fixed step synchronously, without rendering,
// so a whole level plays in milliseconds. Tweens run on wall-clock time, so the hook skips the intro and the weapon hops.
import type Phaser from 'phaser';
import { activateAbility, launchFrom, skipToReady } from '../battle/sling';
import { homeCx, homeZoom, toggleView } from '../battle/camera';
import { pressConsumable, targetTap } from '../battle/consumables';
import type { BattleState } from '../battle/state';
import { addCoins, applyDebug, profile, recordDailyResult, setLoadout, buyWeapon, recordResult, equipSlingSkin } from '../core/profile';
import { sanitize, loadSave } from '../core/save';
import { generateDailyLevel, getDailySeed } from '../content/levelKinds/daily';
import { platform } from '../platform';
import { setMockTimeOffset } from '../platform/mock';
import { data } from '../data/load';
import { events } from '../core/events';

import { snapshot, type BattleView } from '../battle/snapshot';

const DT = 1000 / 60;

export interface Shot { angleDeg: number; power: number; abilityAfterSteps?: number }
export { snapshot, type BattleView };

export function installTestHook(game: Phaser.Game): void {
  let T = 5e6;
  const tick = (n: number): void => {
    for (let i = 0; i < n; i++) {
      T += DT;
      game.scene.update(T, DT);
    }
  };
  const battleScene = (): any => game.scene.getScene('game');
  const battle = (): BattleState => battleScene().getBattle();

  /** Starts a level with a fixed loadout and skips straight to the first shot. Equipped artifacts come from the profile. */
  const load = (levelId: number, loadout?: string[]): BattleView => {
    for (const s of game.scene.getScenes(true)) if (s.scene.key !== 'boot') game.scene.stop(s.scene.key);
    game.scene.resume('game');
    game.scene.start('game', { level: levelId, loadout: loadout ?? Array.from({ length: 4 }, () => 'w_militia_blade') });
    tick(4);
    battleScene().skipToReady();
    tick(20);
    return snapshot(battle());
  };

  const fire = (o: Shot): BattleView => {
    const b = battle();
    if (b.state !== 'ready') return snapshot(b);
    launchFrom(b, o.angleDeg, o.power);
    if (o.abilityAfterSteps !== undefined) {
      tick(o.abilityAfterSteps);
      activateAbility(b);
    }
    return snapshot(b);
  };

  /** Runs until the shot is over (ready for the next, won or lost). */
  const settle = (maxSteps = 1500): BattleView => {
    const b = battle();
    for (let i = 0; i < maxSteps; i++) {
      tick(1);
      if (b.state === 'won' || b.state === 'lost') break;
      if (b.state === 'loading') {
        skipToReady(b);
        break;
      }
      if (b.state === 'ready') break;
    }
    return snapshot(b);
  };

  const set = (path: string, value: unknown): void => {
    const b = battle();
    const parts = path.split('.');
    let o: any = parts[0] === 'tune' ? b.tune : parts[0] === 'rules' ? b.rules : b;
    for (const p of parts.slice(1, -1)) o = o[p];
    o[parts[parts.length - 1]] = value;
  };

  const give = (o: { coins?: number; unlockAll?: boolean }): void => {
    if (o.coins) addCoins(o.coins);
    if (o.unlockAll) {
      profile.owned.weapons = data.content.weapons.map((w) => w.id);
      profile.owned.artifacts = data.content.artifacts.map((a) => a.id);
      for (const c of data.content.consumables) profile.owned.consumables[c.id] = 3;
      applyDebug();
    }
  };

  // ------------------------------------------------------------------ sweeps and a deterministic solver

  const ANGLES = [15, 25, 35, 45, 55, 65, 75];
  const POWERS = [0.55, 0.7, 0.85, 1];
  const ABILITY = [undefined, 18, 32, 48];

  /** Plays a list of shots from scratch and returns the final view. Deterministic: same input, same result. */
  const play = (levelId: number, loadout: string[], shots: Shot[]): BattleView => {
    load(levelId, loadout);
    let v = snapshot(battle());
    for (const s of shots) {
      fire(s);
      v = settle();
      if (v.won || v.lost) break;
    }
    return v;
  };

  /** Every aim on a grid, one shot, from a fresh level. Returns the best by monsters killed. */
  const sweep = (levelId: number, loadout: string[]): { best: Shot & { kills: number; score: number }; oneShotWins: number; tried: number; unreachable: string[] } => {
    let best: Shot & { kills: number; score: number } = { angleDeg: 0, power: 0, kills: -1, score: 0 };
    let oneShotWins = 0;
    let tried = 0;
    load(levelId, loadout);
    const names = battle().ents.filter((e) => e.kind === 'monster').map((e, i) => `${e.type}#${i}@${Math.round(e.body.position.x)}`);
    const total = names.length;
    const everDead = new Set<number>();
    for (const a of ANGLES) for (const p of POWERS) for (const ab of ABILITY) {
      const v = play(levelId, loadout, [{ angleDeg: a, power: p, abilityAfterSteps: ab }]);
      battle().ents.filter((e) => e.kind === 'monster').forEach((e, i) => { if (e.dead) everDead.add(i); });
      const kills = total - v.monsters;
      tried++;
      if (v.won) oneShotWins++;
      if (kills > best.kills || (kills === best.kills && v.score > best.score)) best = { angleDeg: a, power: p, abilityAfterSteps: ab, kills, score: v.score };
    }
    return { best, oneShotWins, tried, unreachable: names.filter((_, i) => !everDead.has(i)) };
  };

  /** Greedy solver: for each shot, replay the prefix plus every candidate aim and keep the one that leaves the fewest monsters. */
  let solverState: { levelId: number; loadout: string[]; shots: Shot[]; result?: BattleView } | null = null;
  const solveStep = (levelId: number, loadout: string[], budgetMs = 30000): { done: boolean; shots: Shot[]; view?: BattleView } => {
    if (!solverState || solverState.levelId !== levelId) solverState = { levelId, loadout, shots: [] };
    const st = solverState;
    const t0 = performance.now();
    while (st.shots.length < loadout.length && performance.now() - t0 < budgetMs) {
      let best: { shot: Shot; monsters: number; score: number; won: boolean } | null = null;
      for (const a of ANGLES) for (const p of POWERS) for (const ab of ABILITY) {
        const shot: Shot = { angleDeg: a, power: p, abilityAfterSteps: ab };
        const v = play(levelId, loadout, [...st.shots, shot]);
        // an escaped runner is not a kill: count it against the shot so the solver does not trade the limit for monsters
        // runners that are still alive are urgent: they are on a clock, everything else waits
        const runnersAlive = (v.ents ?? []).filter((e) => !e.dead && e.type === 'skeleton_runner').length;
        const totalHp = (v.ents ?? []).filter((e) => !e.dead && e.kind === 'monster').reduce((s, e) => s + Math.max(0, e.hp), 0);
        const left = v.monsters * 100 + v.escaped * 500 + runnersAlive * 200 + totalHp * 0.1;
        const lostByEscape = v.lost && v.escaped > (battle().level.escapeLimit ?? 99);
        const better = !best || (v.won && !best.won) || (v.won === best.won && (left < best.monsters || (left === best.monsters && v.score > best.score)));
        if (better && !lostByEscape) best = { shot, monsters: left, score: v.score, won: v.won };
      }
      if (!best) break;
      st.shots.push(best.shot);
      st.result = play(levelId, loadout, st.shots);
      if (st.result.won || st.result.lost) break;
    }
    const done = !!st.result && (st.result.won || st.result.lost || st.shots.length >= loadout.length);
    if (done) solverState = null;
    return { done, shots: st.shots.slice(), view: st.result };
  };

  (window as any).__mm = {
    load, fire, run: tick, settle, set, give, play, sweep, solveStep,
    activateAbility: () => activateAbility(battle()),
    equipSlingSkin: (id?: string) => equipSlingSkin(id),
    state: () => snapshot(battle()),
    profile: () => profile,
    battle: () => battle(),
    homeCx: () => homeCx(battle()),
    homeZoom: () => homeZoom(battle()),
    toggleView: () => toggleView(battle()),
    pressConsumable: (i: number) => pressConsumable(battle(), i),
    targetTap: (wx: number, wy: number) => targetTap(battle(), wx, wy),
    platform: () => platform,
    setMockTimeOffset: (ms: number) => setMockTimeOffset(ms),
    recordDaily: (score: number, dateStr: string) => recordDailyResult(score, dateStr),
    setLoadout: (ids: string[]) => setLoadout(ids),
    buyWeapon: (id: string) => buyWeapon(id),
    recordResult: (r: any) => recordResult(r),
    dailySeed: (ms?: number) => getDailySeed(ms ?? Date.now()),
    dailyLevel: (ms?: number) => generateDailyLevel(ms ?? Date.now()),
    sanitizeSave: (raw: Record<string, unknown>) => sanitize(raw),
    loadSave: () => loadSave(),
    eventListenerCount: (name?: string) => events.listenerCount(name),
  };
}
