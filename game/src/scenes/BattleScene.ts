import Phaser from 'phaser';
import { toggleView } from '../battle/camera';
import { createBattle, buildBattle, startBattle } from '../battle/setup';
import { update } from '../battle/loop';
import { activateAbility, skipToReady } from '../battle/sling';
import type { BattleState } from '../battle/state';
import { events } from '../core/events';
import { irisOpen } from '../core/flow';
import { snapshot } from '../debug/testHook';
import { iconKey } from '../art/icons';
import { pressConsumable } from '../battle/consumables';
import { goTo } from '../core/flow';
import { platform } from '../platform';
import { createHud, type Hud } from '../ui/hud';

const DEFAULT_LOADOUT = ['w_militia_blade', 'w_militia_blade', 'w_militia_blade', 'w_militia_blade'];

/** Thin orchestrator: builds the battle, hooks the HUD to its events and runs the fixed-step loop. Rules live in battle/. */
export default class BattleScene extends Phaser.Scene {
  private b!: BattleState;
  private hud!: Hud;
  private levelId = 1;
  private loadout: string[] = [];
  private lifecycleWired = false;

  constructor() {
    super('game');
  }

  init(data: { level: number; loadout: string[] }): void {
    this.levelId = data.level ?? 1;
    this.loadout = (data.loadout ?? DEFAULT_LOADOUT).slice();
  }

  create(): void {
    events.beginBattle();
    this.events.once('shutdown', () => events.clearBattle());
    const b = (this.b = createBattle(this, this.levelId, this.loadout));
    buildBattle(b);

    this.hud = createHud(b, {
      escapeLimit: b.level.escapeLimit,
      hint: b.level.hints?.[0],
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
    irisOpen(this, (fn) => b.inUi(fn));
    this.input.keyboard?.on('keydown-ESC', () => this.setPaused(!b.paused));
    if (!this.lifecycleWired) {
      this.lifecycleWired = true;
      platform.lifecycle.onPause(() => { if (this.scene.isActive('game')) this.setPaused(true); });
    }

    if ((import.meta as any).env?.DEV) (window as any).__scene = this;
  }

  private wireHud(b: BattleState): void {
    events.on('coins:gained', (e) => this.hud.setCoins(e.total));
    events.on('score:changed', (e) => this.hud.setScore(e.score));
    events.on('combo', (e) => this.hud.mash(e.mult));
    const results = (won: boolean, why: 'shots' | 'escaped', stars: number): void => {
      this.scene.pause();
      this.scene.launch('results', { levelId: this.levelId, won, why, stars, score: b.score, target: b.level.scoreTarget ?? 0, loadout: b.loadout });
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

  update(_t: number, delta: number): void {
    update(this.b, delta, this.game.getTime());
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
