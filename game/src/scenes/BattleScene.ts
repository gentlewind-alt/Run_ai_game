import { isForgeWeapon } from '../core/forge';
import Phaser from 'phaser';
import { homeCx, homeZoom, setView, toggleView } from '../battle/camera';
import { createBattle, buildBattle, startBattle } from '../battle/setup';
import { update } from '../battle/loop';
import { activateAbility, launchFrom, skipToReady, updateCursor } from '../battle/sling';
import { practiceConfig, type PracticeTurn } from '../core/practice';
import type { BattleState } from '../battle/state';
import type { Level } from '../data/types';
import { C } from '../art/palette';
import { setText, text } from '../art/font5x7';
import { challengeBoard, submitScore, type Challenge } from '../core/challenges';
import { H, W } from '../config/constants';
import { TARGET } from '../config/target';
import { events } from '../core/events';
import { irisOpen } from '../core/flow';
import { snapshot } from '../battle/snapshot';
import { iconKey } from '../art/icons';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { pressConsumable } from '../battle/consumables';
import { hasSeenHint, markHintSeen, profile, setMuted } from '../core/profile';
import { adRules, extraShotsReady } from '../core/ads';
import { grantShots } from '../battle/rules';
import type { ExtraShotsData } from './ExtraShotsScene';
import { goTo } from '../core/flow';
import { createHud, type Hud } from '../ui/hud';
import { makeButton } from '../ui/widgets';
import type { ArenaSetup } from '../arena/types';
import { arena } from '../core/arena';

const DEFAULT_LOADOUT = Array.from({ length: 6 }, () => 'w_militia_blade');

/** Thin orchestrator: builds the battle, hooks the HUD to its events and runs the fixed-step loop. Rules live in battle/. */
export default class BattleScene extends Phaser.Scene {
  private b!: BattleState;
  private hud!: Hud;
  private levelId = 1;
  private loadout: string[] = [];
  private customLevel?: Level;
  private beat?: number; // a friend's score to beat (challenge code), shown on the results
  private challenge?: Challenge;
  private arenaSetup?: ArenaSetup;
  private arenaSent = 0;
  private arenaSubmitted = false;
  private arenaInterrupted = false;
  private arenaLeaving = false;
  private practice?: PracticeTurn;
  private botWait = 0;
  private botShots = 0;
  private botLastX = 0;
  private botAngle = 38;
  private botPower = 0.75;
  private botTapped = false;

  constructor() {
    super('game');
  }

  init(data: { level: number; loadout: string[]; beat?: number; customLevel?: Level; challenge?: Challenge; arena?: ArenaSetup; practice?: PracticeTurn }): void {
    this.levelId = data.level ?? 1;
    this.beat = data.beat;
    this.loadout = (data.loadout ?? DEFAULT_LOADOUT).slice();
    this.practice = data.practice;
    this.customLevel = data.customLevel ?? data.practice?.level;
    this.challenge = data.challenge;
    this.botWait = 0; this.botShots = 0; this.botLastX = 0; this.botAngle = 38; this.botPower = 0.75; this.botTapped = false;
    this.arenaSetup = data.arena;
    this.arenaSent = 0; this.arenaSubmitted = false; this.arenaInterrupted = false; this.arenaLeaving = false;
  }

  create(): void {
    this.scene.resume();
    events.beginBattle();
    const b = (this.b = createBattle(this, this.levelId, this.loadout, this.customLevel, !!this.arenaSetup || !!this.practice, this.arenaSetup?.mods, this.arenaSetup?.skin));
    sfx.preload(this.loadout.map((id) => b.forgeWeapons[id]?.forge?.abilityId).filter((a): a is string => !!a).map((a) => `forge_${a}`));
    buildBattle(b);

    const shouldShowHint = !b.custom && b.settings.features.tutorial !== false && !hasSeenHint(this.levelId, 0);
    const hintText = shouldShowHint ? b.level.hints?.[0] : undefined;
    if (hintText) {
      markHintSeen(this.levelId, 0);
    }

    this.hud = createHud(b, {
      escapeLimit: b.level.escapeLimit,
      hint: hintText,
      abilityLabel: b.wdef.ability.label,
      onAbility: () => activateAbility(b),
      onToggleView: () => toggleView(b),
      showZoom: b.settings.features.zoom,
      consumables: b.consumables.map((c) => ({ icon: iconKey(c.id), label: c.name })),
      onUse: (i) => pressConsumable(b, i),
      onPause: () => this.setPaused(true),
    });
    b.ui = this.hud.ui;
    if (this.practice) {
      const p = this.practice;
      b.inUi(() => text(this, W / 2, 12, this.practiceLabel(p), C('4'), 1, C('0')).setDepth(12));
      if (p.bot) this.input.enabled = false;
    }
    if (b.custom && !this.challenge && !this.arenaSetup && !this.practice) b.inUi(() => {
      makeButton(this, W - (TARGET === 'android' ? 112 : 98), TARGET === 'android' ? 21 : 14, 42, 24, 'Edit', 'plain', () => goTo(this, 'builder'), 12);
    });
    this.wireHud(b);
    startBattle(b);
    music.playForLevel(this.levelId, b.level.realm ?? '', b.level.kind === 'boss');
    irisOpen(this, (fn) => b.inUi(fn));
    this.input.keyboard?.on('keydown-ESC', () => this.setPaused(!b.paused));
    this.input.keyboard?.on('keydown-R', () => {
      if (b.paused && !this.arenaSetup) {
        b.paused = false;
        this.hud.hidePause();
        this.scene.restart({ level: this.levelId, loadout: b.loadout, beat: this.beat, customLevel: this.customLevel, challenge: this.challenge });
      }
    });
    this.input.keyboard?.on('keydown-M', () => {
      sfx.unlock();
      const next = !sfx.muted;
      setMuted(next);
      sfx.setMuted(next);
      this.hud.setMuted(next);
    });
    const onResize = (): void => {
      if (!b.view.free && b.state !== 'won' && b.state !== 'lost') {
        b.view.cx = homeCx(b);
        b.view.z = homeZoom(b);
        setView(b, b.view.z, b.view.cx);
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    const offArena = this.arenaSetup ? arena.subscribe(() => {
      if (!this.scene.isActive() || this.arenaSubmitted || this.arenaLeaving) return;
      const match = arena.snapshot?.match;
      if (match && (match.id !== this.arenaSetup!.matchId || match.state === 'finished' || match.revision !== this.arenaSetup!.revision)) {
        this.arenaLeaving = true; b.paused = true; goTo(this, 'arena', { tab: 'match' }); return;
      }
      if (arena.status !== 'online' || arena.turnError?.matchId === this.arenaSetup!.matchId && arena.turnError.revision === this.arenaSetup!.revision) {
        this.arenaInterrupted = true;
        this.hud.hidePause(); b.paused = false; this.setPaused(true);
      }
    }) : undefined;

    this.events.once('shutdown', () => {
      b.closing = true;
      for (const actor of b.actors) actor.destroy();
      b.actors = [];
      this.hud?.hidePause();
      this.input.keyboard?.removeAllListeners();
      this.input.removeAllListeners();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      events.clearBattle();
      offArena?.();
    });

    if ((import.meta as any).env?.DEV) (window as any).__scene = this;
  }

  private wireHud(b: BattleState): void {
    events.on('coins:gained', (e) => this.hud.setCoins(e.total));
    events.on('score:changed', (e) => this.hud.setScore(e.score));
    events.on('combo', (e) => this.hud.mash(e.mult));
    if (b.custom) return;
    const results = (won: boolean, why: 'shots' | 'escaped', stars: number): void => {
      this.scene.pause();
      this.scene.launch('results', {
        levelId: this.levelId, won, why, stars, score: b.score, target: b.level.scoreTarget ?? 0, loadout: b.loadout, relicUnlocked: b.relicUnlocked,
        seconds: Math.round(b.steps / 60), beat: this.beat,
      });
    };
    events.on('level:won', (e) => results(true, 'shots', e.stars));
    let offered = false;
    events.on('level:lost', (e) => {
      if (e.reason === 'shots' && !offered) {
        offered = true;
        void this.offerExtraShots(b, () => results(false, e.reason, 0));
        return;
      }
      results(false, e.reason, 0);
    });
  }

  /** Out of shots: if an ad is available, offer 2 more shots chosen from the player's arsenal (once per battle). */
  private async offerExtraShots(b: BattleState, decline: () => void): Promise<void> {
    if (!(await extraShotsReady()) || !this.scene.isActive()) {
      decline();
      return;
    }
    this.scene.pause();
    const data: ExtraShotsData = {
      count: adRules().extraShots,
      owned: profile.owned.weapons.filter((id) => b.content.weapons.some((w) => w.id === id) && (!isForgeWeapon(id) || b.settings.features.weaponForge)),
      onGrant: (ids) => {
        this.scene.resume();
        if (!grantShots(b, ids)) decline();
        else this.hud.hidePause();
      },
      onDecline: () => {
        this.scene.resume();
        decline();
      },
    };
    this.scene.launch('extrashots', data);
  }

  /** Pause the battle (menu, Escape, or the host sending the game to the background). */
  setPaused(on: boolean): void {
    const b = this.b;
    if (!b || b.state === 'won' || b.state === 'lost' || b.paused === on) return;
    if (!on && this.arenaInterrupted) return;
    b.paused = on;
    if (on) {
      this.hud.showPause({
        resume: this.arenaInterrupted ? undefined : () => this.setPaused(false),
        restart: this.arenaSetup || this.practice ? undefined : () => { b.paused = false; this.hud.hidePause(); this.scene.restart({ level: this.levelId, loadout: b.loadout, beat: this.beat, customLevel: this.customLevel, challenge: this.challenge }); },
        title: this.arenaInterrupted ? 'Turn interrupted' : 'Paused',
        mapLabel: this.arenaSetup ? 'Forfeit turn' : this.practice ? 'Leave practice' : undefined,
        map: () => {
          if (this.practice) goTo(this, 'practice', { leave: true });
          else if (this.arenaSetup) { this.arenaLeaving = true; arena.forfeit(); goTo(this, 'arena', { tab: 'match' }); }
          else if (this.challenge) goTo(this, 'challenge', { id: this.challenge.id, challenge: this.challenge });
          else goTo(this, b.custom ? 'builder' : 'map');
        },
      });
    } else {
      this.hud.hidePause();
    }
  }

  pauseBattle(): void {
    this.setPaused(true);
  }

  update(_t: number, delta: number): void {
    update(this.b, delta, this.game.getTime());
    updateCursor(this.b);
    const b = this.b;
    if (this.practice?.bot && !b.paused) this.botStep(b, delta);
    if (this.arenaSetup && b.arena && !this.arenaSubmitted && !this.arenaInterrupted && !this.arenaLeaving) {
      while (this.arenaSent < b.arena.actions.length) {
        if (!arena.sendInput(this.arenaSetup, b.arena.actions[this.arenaSent])) {
          this.arenaInterrupted = true; this.hud.hidePause(); b.paused = false; this.setPaused(true); return;
        }
        this.arenaSent++;
      }
    }
    if (b.custom && !b.paused && (b.state === 'won' || b.state === 'lost')) {
      b.paused = true;
      if (this.practice) { this.practiceEnd(b); return; }
      if (this.arenaSetup) {
        if (!this.arenaSubmitted && !this.arenaInterrupted && b.arena) {
          this.arenaSubmitted = true;
          arena.submit(this.arenaSetup, b.arena);
        }
        this.arenaLeaving = true;
        goTo(this, 'arena', { tab: 'match' });
        return;
      }
      if (this.challenge) { this.challengeEnd(b, this.challenge); return; }
      b.inUi(() => {
        this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.78).setDepth(30);
        text(this, W / 2, 83, b.state === 'won' ? 'Level cleared!' : 'Out of shots', C('4'), 2, C('0')).setDepth(31);
        text(this, W / 2, 111, 'Custom playtest', C('c'), 1, C('0')).setDepth(31);
        makeButton(this, W / 2 - 69, 157, 118, 30, 'Edit level', 'go', () => goTo(this, 'builder'), 32);
        makeButton(this, W / 2 + 69, 157, 118, 30, 'Retry', 'plain', () => {
          this.scene.restart({ level: 1000, loadout: b.loadout, beat: this.beat, customLevel: this.customLevel, challenge: this.challenge });
        }, 32);
      });
    }
  }

  private practiceLabel(p: PracticeTurn): string {
    if (p.bot) return 'Rival Bot turn';
    if (p.vsBot) return 'Your turn';
    return p.who === 0 ? 'Player 1 turn' : 'Player 2 turn';
  }

  /** The Rival Bot: waits a moment, aims at the nearest monster, and corrects its power from where its last shot landed. */
  private botStep(b: BattleState, delta: number): void {
    const cfg = practiceConfig();
    if (b.proj) {
      this.botLastX = b.proj.body.position.x;
      if (!this.botTapped && !b.proj.tapped && b.proj.steps > 55) { this.botTapped = true; activateAbility(b); }
      return;
    }
    if (b.state !== 'ready') return;
    this.botWait += delta;
    if (this.botWait < cfg.botThinkMs) return;
    this.botWait = 0;
    this.botTapped = false;
    const target = b.ents.filter((e) => e.kind === 'monster' && !e.dead).sort((x, y) => x.body.position.x - y.body.position.x)[0];
    if (!target) return;
    if (this.botShots > 0) {
      const err = this.botLastX - target.body.position.x; // positive: it flew past, negative: it fell short
      this.botPower -= Phaser.Math.Clamp(err / 260, -0.3, 0.3);
      if (this.botPower > 1) { this.botPower = 1; this.botAngle = Math.min(60, this.botAngle + 3); }
      if (this.botPower < 0.35) { this.botPower = 0.35; this.botAngle = Math.max(20, this.botAngle - 2); }
    }
    const slip = 1 - cfg.botSkill; // a weaker bot wobbles more
    launchFrom(b, this.botAngle + Phaser.Math.FloatBetween(-1, 1) * slip * 8, Phaser.Math.Clamp(this.botPower + Phaser.Math.FloatBetween(-1, 1) * slip * 0.14, 0.3, 1));
    this.botShots++;
  }

  /** End of a practice turn: show the result for a moment, then hand it to the practice screen. */
  private practiceEnd(b: BattleState): void {
    const cleared = b.state === 'won';
    const score = Math.round(b.score);
    b.inUi(() => {
      this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.7).setDepth(30);
      text(this, W / 2, 100, cleared ? 'Cleared!' : 'Out of shots', C('4'), 2, C('0')).setDepth(31);
      text(this, W / 2, 128, `Score ${score}`, C('c'), 1, C('0')).setDepth(31);
    });
    this.time.delayedCall(1700, () => { if (this.scene.isActive()) goTo(this, 'practice', { result: { cleared, score, shotsUsed: b.shotIdx } }); });
  }

  /** End of a Global Challenge attempt: show the score, keep the player's best on the challenge's own board and show their rank. */
  private challengeEnd(b: BattleState, c: Challenge): void {
    const won = b.state === 'won';
    const score = Math.round(b.score);
    let line: Phaser.GameObjects.Image | undefined;
    b.inUi(() => {
      this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.78).setDepth(30);
      text(this, W / 2, 70, won ? 'Challenge cleared!' : 'Out of shots', C('4'), 2, C('0')).setDepth(31);
      text(this, W / 2, 96, c.title.slice(0, 32), C('c'), 1, C('0')).setDepth(31);
      if (won) text(this, W / 2, 112, `Score ${score}`, C('c'), 1, C('0')).setDepth(31);
      line = text(this, W / 2, 128, won ? 'Saving your score...' : 'Only a clear counts. Try other weapons!', C('d'), 1, C('0')).setDepth(31);
      makeButton(this, W / 2 - 128, 165, 118, 30, 'Leaderboard', 'go', () => goTo(this, 'challenge', { id: c.id, challenge: c }), 32);
      makeButton(this, W / 2, 165, 100, 30, 'Retry', 'plain', () => {
        this.scene.restart({ level: 1000, loadout: b.loadout, customLevel: this.customLevel, challenge: c });
      }, 32);
      makeButton(this, W / 2 + 118, 165, 100, 30, 'Pick weapons', 'plain', () => goTo(this, 'challengeWeapons', { mode: 'play', challenge: c }), 32);
    });
    if (!won) return;
    void submitScore(c, score).then(async (best) => {
      const board = await challengeBoard(c, 1);
      if (!this.scene.isActive() || !line) return;
      setText(line, this, `Your best ${Math.max(best, score)}${board.me ? `   Rank #${board.me.rank}` : ''}`, C('4'), C('0'));
    });
  }

  // ------------------------------------------------------------------ dev and test hooks

  /** Test hook: finish the intro/hop instantly (tweens run on wall-clock time, scripted tests don't). */
  skipToReady(): void {
    skipToReady(this.b);
  }

  activateAbility(): void {
    activateAbility(this.b);
  }

  snapshot(): ReturnType<typeof snapshot> {
    return snapshot(this.b);
  }

  getBattle(): BattleState {
    return this.b;
  }
}
