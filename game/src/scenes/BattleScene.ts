import Phaser from 'phaser';
import { homeCx, homeZoom, setView, toggleView } from '../battle/camera';
import { createBattle, buildBattle, startBattle } from '../battle/setup';
import { update } from '../battle/loop';
import { activateAbility, skipToReady, updateCursor } from '../battle/sling';
import type { BattleState } from '../battle/state';
import type { Level } from '../data/types';
import { C } from '../art/palette';
import { text } from '../art/font5x7';
import { H, W } from '../config/constants';
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

const DEFAULT_LOADOUT = Array.from({ length: 6 }, () => 'w_militia_blade');

/** Thin orchestrator: builds the battle, hooks the HUD to its events and runs the fixed-step loop. Rules live in battle/. */
export default class BattleScene extends Phaser.Scene {
  private b!: BattleState;
  private hud!: Hud;
  private levelId = 1;
  private loadout: string[] = [];
  private customLevel?: Level;

  constructor() {
    super('game');
  }

  init(data: { level: number; loadout: string[]; customLevel?: Level }): void {
    this.levelId = data.level ?? 1;
    this.loadout = (data.loadout ?? DEFAULT_LOADOUT).slice();
    this.customLevel = data.customLevel;
  }

  create(): void {
    this.scene.resume();
    events.beginBattle();
    const b = (this.b = createBattle(this, this.levelId, this.loadout, this.customLevel));
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
    if (b.custom) b.inUi(() => {
      makeButton(this, W - 98, 14, 42, 24, 'Edit', 'plain', () => goTo(this, 'builder'), 12);
    });
    this.wireHud(b);
    startBattle(b);
    music.playForLevel(this.levelId, b.level.realm ?? '', b.level.kind === 'boss');
    irisOpen(this, (fn) => b.inUi(fn));
    this.input.keyboard?.on('keydown-ESC', () => this.setPaused(!b.paused));
    this.input.keyboard?.on('keydown-R', () => {
      if (b.paused) {
        b.paused = false;
        this.hud.hidePause();
        this.scene.restart({ level: this.levelId, loadout: b.loadout, customLevel: this.customLevel });
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
    if (b.custom) return;
    const results = (won: boolean, why: 'shots' | 'escaped', stars: number): void => {
      this.scene.pause();
      this.scene.launch('results', {
        levelId: this.levelId, won, why, stars, score: b.score, target: b.level.scoreTarget ?? 0, loadout: b.loadout, relicUnlocked: b.relicUnlocked,
        seconds: Math.round(b.steps / 60),
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
      owned: profile.owned.weapons.slice(),
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
    b.paused = on;
    if (on) {
      this.hud.showPause({
        resume: () => this.setPaused(false),
        restart: () => { b.paused = false; this.hud.hidePause(); this.scene.restart({ level: this.levelId, loadout: b.loadout, customLevel: this.customLevel }); },
        map: () => goTo(this, b.custom ? 'builder' : 'map'),
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
    if (b.custom && !b.paused && (b.state === 'won' || b.state === 'lost')) {
      b.paused = true;
      b.inUi(() => {
        this.add.rectangle(W / 2, H / 2, W, H, C('0'), 0.78).setDepth(30);
        text(this, W / 2, 83, b.state === 'won' ? 'Level cleared!' : 'Out of shots', C('4'), 2, C('0')).setDepth(31);
        text(this, W / 2, 111, 'Custom playtest', C('c'), 1, C('0')).setDepth(31);
        makeButton(this, W / 2 - 69, 157, 118, 30, 'Edit level', 'go', () => goTo(this, 'builder'), 32);
        makeButton(this, W / 2 + 69, 157, 118, 30, 'Retry', 'plain', () => {
          this.scene.restart({ level: 1000, loadout: b.loadout, customLevel: this.customLevel });
        }, 32);
      });
    }
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
