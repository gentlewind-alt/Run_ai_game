import Phaser from 'phaser';
import { homeCx, homeZoom, setView, toggleView } from '../battle/camera';
import { createBattle, buildBattle, startBattle } from '../battle/setup';
import { update } from '../battle/loop';
import { activateAbility, skipToReady, updateCursor } from '../battle/sling';
import type { BattleState } from '../battle/state';
import { events } from '../core/events';
import { irisOpen } from '../core/flow';
import { snapshot } from '../battle/snapshot';
import { iconKey } from '../art/icons';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { pressConsumable } from '../battle/consumables';
import { hasSeenHint, markHintSeen, setMuted } from '../core/profile';
import { goTo } from '../core/flow';
import { createHud, type Hud } from '../ui/hud';

const DEFAULT_LOADOUT = ['w_militia_blade', 'w_militia_blade', 'w_militia_blade', 'w_militia_blade'];

/** Thin orchestrator: builds the battle, hooks the HUD to its events and runs the fixed-step loop. Rules live in battle/. */
export default class BattleScene extends Phaser.Scene {
  private b!: BattleState;
  private hud!: Hud;
  private levelId = 1;
  private loadout: string[] = [];

  constructor() {
    super('game');
  }

  init(data: { level: number; loadout: string[] }): void {
    this.levelId = data.level ?? 1;
    this.loadout = (data.loadout ?? DEFAULT_LOADOUT).slice();
  }

  create(): void {
    events.beginBattle();
    const b = (this.b = createBattle(this, this.levelId, this.loadout));
    buildBattle(b);

    const shouldShowHint = b.settings.features.tutorial !== false && !hasSeenHint(this.levelId, 0);
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
    this.wireHud(b);
    startBattle(b);
    const bgTheme = (b.level.realm === 'wood' || b.level.realm === 'keep' || b.level.kind === 'boss') ? 'dusk' : 'cheerful';
    music.play(bgTheme);
    irisOpen(this, (fn) => b.inUi(fn));
    this.input.keyboard?.on('keydown-ESC', () => this.setPaused(!b.paused));
    this.input.keyboard?.on('keydown-R', () => {
      if (b.paused) {
        b.paused = false;
        this.hud.hidePause();
        this.scene.restart({ level: this.levelId, loadout: b.loadout });
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

    this.events.once('shutdown', () => {
      this.hud?.hidePause();
      this.input.keyboard?.removeAllListeners();
      this.input.removeAllListeners();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      events.clearBattle();
    });

    if ((import.meta as any).env?.DEV) (window as any).__scene = this;
  }

  private wireHud(b: BattleState): void {
    events.on('coins:gained', (e) => this.hud.setCoins(e.total));
    events.on('score:changed', (e) => this.hud.setScore(e.score));
    events.on('combo', (e) => this.hud.mash(e.mult));
    const results = (won: boolean, why: 'shots' | 'escaped', stars: number): void => {
      this.scene.pause();
      this.scene.launch('results', {
        levelId: this.levelId, won, why, stars, score: b.score, target: b.level.scoreTarget ?? 0, loadout: b.loadout, relicUnlocked: b.relicUnlocked,
      });
    };
    events.on('level:won', (e) => results(true, 'shots', e.stars));
    events.on('level:lost', (e) => results(false, e.reason, 0));
  }

  /** Pause the battle (menu, Escape, or the host sending the game to the background). */
  setPaused(on: boolean): void {
    const b = this.b;
    if (!b || b.state === 'won' || b.state === 'lost' || b.paused === on) return;
    b.paused = on;
    if (on) {
      this.hud.showPause({
        resume: () => this.setPaused(false),
        restart: () => { b.paused = false; this.hud.hidePause(); this.scene.restart({ level: this.levelId, loadout: b.loadout }); },
        map: () => goTo(this, 'map'),
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
