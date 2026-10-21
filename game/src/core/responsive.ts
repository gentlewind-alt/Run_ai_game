import Phaser from 'phaser';
import { H, W } from '../config/constants';
import { events } from './events';
import { platform } from '../platform';

export type RealmTheme = 'hills' | 'wood' | 'keep' | 'menu';

const REALM_COLORS: Record<RealmTheme, { glow: string; tint: string; name: string }> = {
  hills: {
    glow: 'rgba(37, 113, 121, 0.45)', // teal
    tint: '#1a2238',
    name: 'Goblin Hills',
  },
  wood: {
    glow: 'rgba(93, 39, 93, 0.48)', // plum
    tint: '#201830',
    name: 'Dark Elf Wood',
  },
  keep: {
    glow: 'rgba(177, 62, 83, 0.42)', // berry / flame
    tint: '#281a24',
    name: 'Iron Keep',
  },
  menu: {
    glow: 'rgba(41, 54, 111, 0.38)', // navy dusk
    tint: '#16192b',
    name: 'Monster Mash',
  },
};

let currentRealm: RealmTheme = 'menu';
export function getCurrentRealm(): RealmTheme {
  return currentRealm;
}
let ditherDataUrl = '';

/** Generates a subtle 8x8 Bayer pixel-dither pattern in Mash32 ink tones as a PNG data URI. */
function generateDitherPattern(): string {
  if (ditherDataUrl) return ditherDataUrl;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 8x8 Bayer matrix threshold values (0..63)
  const bayer8 = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];

  const imgData = ctx.createImageData(8, 8);
  const data = imgData.data;
  // Mash32 palette ink tones:
  // Ink: #1a1c2c (26, 28, 44), Deep Ink: #111322 (17, 19, 34)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const idx = (y * 8 + x) * 4;
      const threshold = bayer8[y * 8 + x];
      // Subtle dither dots: darker where threshold is high, lighter where low
      if (threshold < 24) {
        // Subtle ink highlight dot
        data[idx] = 26;
        data[idx + 1] = 28;
        data[idx + 2] = 44;
        data[idx + 3] = 40; // subtle alpha
      } else if (threshold > 48) {
        // Subtle deep ink shade dot
        data[idx] = 17;
        data[idx + 1] = 19;
        data[idx + 2] = 34;
        data[idx + 3] = 50;
      } else {
        // Transparent
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  ditherDataUrl = canvas.toDataURL('image/png');
  return ditherDataUrl;
}

export function setBackdropRealm(realm: RealmTheme, customName?: string): void {
  currentRealm = realm;
  const cfg = REALM_COLORS[realm] ?? REALM_COLORS.menu;
  const shell = document.getElementById('shell');
  if (shell) {
    shell.style.setProperty('--realm-glow', cfg.glow);
    shell.style.setProperty('--realm-tint', cfg.tint);
  }
  const nameEl = document.getElementById('hud-realm-name');
  if (nameEl) {
    nameEl.textContent = customName || cfg.name;
  }
}

/** Computes responsive display dimensions preserving aspect ratio 216:384. */
export function calculateResponsiveScale(viewportW: number, viewportH: number): {
  displayW: number;
  displayH: number;
  scale: number;
  isInteger: boolean;
  offsetX: number;
  offsetY: number;
} {
  const sa = platform.safeArea ? platform.safeArea() : { top: 0, bottom: 0, left: 0, right: 0 };
  const availW = Math.max(1, viewportW - (sa.left || 0) - (sa.right || 0));
  const availH = Math.max(1, viewportH - (sa.top || 0) - (sa.bottom || 0));

  const sMax = Math.min(availW / W, availH / H);
  const isInteger = sMax >= 2;
  const scale = isInteger ? Math.floor(sMax) : sMax;

  // Exact integer scaling when scale >= 2; smooth fit when scale < 2
  const displayW = isInteger ? W * scale : Math.round(W * scale);
  const displayH = isInteger ? H * scale : Math.round(H * scale);

  const offsetX = (sa.left || 0) + (availW - displayW) / 2;
  const offsetY = (sa.top || 0) + (availH - displayH) / 2;

  return { displayW, displayH, scale, isInteger, offsetX, offsetY };
}

export function initResponsive(game: Phaser.Game): () => void {
  const backdrop = document.getElementById('backdrop');
  const app = document.getElementById('app');
  const hud = document.getElementById('desktop-hud');

  // Setup dither pattern on backdrop
  const patternUrl = generateDitherPattern();
  if (backdrop && patternUrl) {
    backdrop.style.backgroundImage = `
      radial-gradient(ellipse at center, var(--realm-glow, rgba(41, 54, 111, 0.38)) 0%, var(--realm-tint, #16192b) 60%, #111322 100%),
      url(${patternUrl})
    `;
    backdrop.style.backgroundRepeat = 'no-repeat, repeat';
  }

  // Prevent right-click context menu on canvas so right-drag works seamlessly
  const preventContext = (e: MouseEvent): void => e.preventDefault();
  game.canvas?.addEventListener('contextmenu', preventContext);

  const applyLayout = (): void => {
    if (!app) return;
    const vpW = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vpH = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    const isPortrait = vpW < vpH;
    const rotateEl = document.getElementById('rotate-overlay');
    if (rotateEl) {
      if (isPortrait) {
        rotateEl.classList.remove('hidden');
        rotateEl.setAttribute('aria-hidden', 'false');
        app.style.display = 'none';
        if (hud) {
          hud.classList.add('hidden');
          hud.style.display = 'none';
        }
        // Pause active battle while in portrait
        const gameScene = game.scene.getScene('game') as any;
        if (gameScene && game.scene.isActive('game')) {
          const b = gameScene.getBattle?.();
          if (b && b.state !== 'won' && b.state !== 'lost' && !b.paused) {
            gameScene.pauseBattle?.();
          }
        }
        return;
      } else {
        rotateEl.classList.add('hidden');
        rotateEl.setAttribute('aria-hidden', 'true');
        app.style.display = 'block';
      }
    }

    const { displayW, displayH, isInteger, offsetX, offsetY } = calculateResponsiveScale(vpW, vpH);

    app.style.width = `${displayW}px`;
    app.style.height = `${displayH}px`;
    app.style.left = `${Math.round(offsetX)}px`;
    app.style.top = `${Math.round(offsetY)}px`;

    // Add bevel frame on tablet / desktop (when scale >= 2 or when there is border breathing room)
    const hasMargin = vpW - displayW >= 24 && vpH - displayH >= 24;
    if (isInteger || hasMargin) {
      app.classList.add('beveled-frame');
    } else {
      app.classList.remove('beveled-frame');
    }

    // Desktop controls hint only if there is ample room on the sides (ultrawide / wide desktop)
    const rightSpace = vpW - (offsetX + displayW);
    const leftSpace = offsetX;
    const panelW = 120;
    const hasSideRoom = rightSpace >= panelW + 20 || leftSpace >= panelW + 20;

    if (hud) {
      if (hasSideRoom && vpW >= 700) {
        hud.classList.remove('hidden');
        hud.style.display = 'block';

        const realmBadge = document.getElementById('hud-realm-badge');
        const controlsPanel = document.getElementById('hud-controls-panel');

        if (leftSpace >= panelW + 20 && rightSpace >= panelW + 20) {
          if (realmBadge) {
            realmBadge.style.left = `${Math.max(12, Math.round(offsetX - panelW - 14))}px`;
            realmBadge.style.top = `${Math.round(offsetY + 20)}px`;
            realmBadge.style.right = 'auto';
          }
          if (controlsPanel) {
            controlsPanel.style.left = `${Math.round(offsetX + displayW + 14)}px`;
            controlsPanel.style.top = `${Math.round(offsetY + 20)}px`;
            controlsPanel.style.right = 'auto';
          }
        } else if (rightSpace >= panelW + 16) {
          if (realmBadge) {
            realmBadge.style.left = `${Math.round(offsetX + displayW + 14)}px`;
            realmBadge.style.top = `${Math.round(offsetY + 14)}px`;
            realmBadge.style.right = 'auto';
          }
          if (controlsPanel) {
            controlsPanel.style.left = `${Math.round(offsetX + displayW + 14)}px`;
            controlsPanel.style.top = `${Math.round(offsetY + 70)}px`;
            controlsPanel.style.right = 'auto';
          }
        } else if (leftSpace >= panelW + 16) {
          if (realmBadge) {
            realmBadge.style.left = `${Math.max(10, Math.round(offsetX - panelW - 14))}px`;
            realmBadge.style.top = `${Math.round(offsetY + 14)}px`;
            realmBadge.style.right = 'auto';
          }
          if (controlsPanel) {
            controlsPanel.style.left = `${Math.max(10, Math.round(offsetX - panelW - 14))}px`;
            controlsPanel.style.top = `${Math.round(offsetY + 70)}px`;
            controlsPanel.style.right = 'auto';
          }
        }
      } else {
        hud.classList.add('hidden');
        hud.style.display = 'none';
      }
    }

    // Refresh Phaser scale manager to ensure displaySize and canvasBounds stay exact
    game.scale.refresh();
  };

  // Listen for level start to update realm backdrop
  const unLevel = events.on('level:start', ({ levelId }) => {
    let r: RealmTheme = 'hills';
    if (levelId >= 9 && levelId <= 12) r = 'keep';
    else if (levelId >= 5 && levelId <= 8) r = 'wood';
    else if (levelId === 0) r = 'wood'; // daily
    setBackdropRealm(r);
  });

  // Listen for window resize, orientationchange, and visualViewport
  window.addEventListener('resize', applyLayout);
  window.addEventListener('orientationchange', applyLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyLayout);
  }

  // Initial layout application
  applyLayout();

  return () => {
    unLevel();
    window.removeEventListener('resize', applyLayout);
    window.removeEventListener('orientationchange', applyLayout);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', applyLayout);
    }
    game.canvas?.removeEventListener('contextmenu', preventContext);
  };
}
