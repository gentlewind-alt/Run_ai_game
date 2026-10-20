import Phaser from 'phaser';
import { toggleView } from '../battle/camera';
import { createBattle, buildBattle, startBattle } from '../battle/setup';
import { update } from '../battle/loop';
import { activateAbility, skipToReady } from '../battle/sling';
import type { BattleState } from '../battle/state';
import { MAX_LEVEL } from '../core/profile';
import { events } from '../core/events';
import { snapshot } from '../debug/testHook';
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
    });
    b.ui = this.hud.ui;
    this.wireHud(b);
    startBattle(b);

    if ((import.meta as any).env?.DEV) (window as any).__scene = this;
  }

  private wireHud(b: BattleState): void {
    events.on('coins:gained', (e) => this.hud.setCoins(e.total));
    events.on('score:changed', (e) => this.hud.setScore(e.score));
    events.on('combo', (e) => this.hud.mash(e.mult));
    const restart = (): void => { this.scene.restart({ level: this.levelId, loadout: b.loadout }); };
    const results = (won: boolean, why: 'shots' | 'escaped', stars: number): void => {
      const next = won && this.levelId < MAX_LEVEL;
      this.hud.results({
        won, why, stars, score: b.score, coins: b.coins, target: b.level.scoreTarget ?? 0,
        primary: {
          label: won ? (next ? 'Next level' : 'Play again') : 'Try again',
          action: won ? () => this.scene.start('loadout', { level: next ? this.levelId + 1 : 1 }) : restart,
        },
        secondary: {
          label: won ? 'Replay' : 'Change loadout',
          action: won ? restart : () => this.scene.start('loadout', { level: this.levelId }),
        },
      });
    };
    events.on('level:won', (e) => results(true, 'shots', e.stars));
    events.on('level:lost', (e) => results(false, e.reason, 0));
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
}
