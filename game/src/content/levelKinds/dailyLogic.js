// Pure JS daily level generator (zero dependencies) shared by game code and check-daily.mjs

function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

export function getDailySeed(epochMs) {
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const weekday = d.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const seed = y * 10000 + m * 100 + day;
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { seed, dateStr, weekday };
}

export function generateDailyLevel(epochMs) {
  const { seed, dateStr, weekday } = getDailySeed(epochMs);
  const rng = createRng(seed);

  const worldW = 432;
  const GROUND = 320;
  const realm = weekday === 0 || weekday === 6 ? 'iron_keep' : weekday % 2 === 1 ? 'goblin_hills' : 'dark_elf_wood';

  // Terrain profile
  const terrainType = weekday % 3;
  let terrain;
  let baseY = GROUND;

  if (terrainType === 0) {
    terrain = [[0, GROUND], [worldW, GROUND]];
    baseY = GROUND;
  } else if (terrainType === 1) {
    baseY = 296;
    terrain = [[0, GROUND], [110, GROUND], [140, baseY], [330, baseY], [360, GROUND], [worldW, GROUND]];
  } else {
    baseY = 304;
    terrain = [[0, GROUND], [120, GROUND], [150, baseY], [320, baseY], [350, GROUND], [worldW, GROUND]];
  }

  const blocks = [];
  const monsters = [];

  // Template archetypes: 0 = pillars, 1 = towers, 2 = bunker
  // Rotation ensuring no two consecutive weekdays share the same fort archetype:
  // Sun(0): pillars, Mon(1): towers, Tue(2): bunker, Wed(3): pillars, Thu(4): bunker, Fri(5): pillars, Sat(6): towers
  const TEMPLATE_BY_WEEKDAY = [0, 1, 2, 0, 2, 0, 1];
  const ARCHETYPES = ['pillars', 'towers', 'bunker'];
  const template = TEMPLATE_BY_WEEKDAY[weekday];
  const archetype = ARCHETYPES[template];
  const cx = 230 + Math.round((rng.next() - 0.5) * 20);

  if (template === 0) {
    // Pillars template
    const pillarMat = weekday === 0 ? 'iron' : 'stone';
    const floorMat = 'wood';
    const pw = 10;
    const ph = 32;
    const span = 64;

    blocks.push({ m: pillarMat, x: cx - span / 2, y: baseY - ph / 2, w: pw, h: ph });
    blocks.push({ m: pillarMat, x: cx + span / 2, y: baseY - ph / 2, w: pw, h: ph });
    blocks.push({ m: floorMat, x: cx, y: baseY - ph - 3, w: span + 14, h: 6 });

    const ph2 = 24;
    blocks.push({ m: floorMat, x: cx - 18, y: baseY - ph - 6 - ph2 / 2, w: 8, h: ph2 });
    blocks.push({ m: floorMat, x: cx + 18, y: baseY - ph - 6 - ph2 / 2, w: 8, h: ph2 });
    blocks.push({ m: 'stone', x: cx, y: baseY - ph - 6 - ph2 - 3, w: 44, h: 6 });

    if (weekday === 0) {
      monsters.push({ t: 'orc_brute', x: cx, y: baseY - 14 });
      monsters.push({ t: 'dark_elf_hexer', x: cx, y: baseY - ph - 6 - 8 });
      monsters.push({ t: 'goblin_bomber', x: cx, y: baseY - ph - 6 - ph2 - 6 - 8 });
    } else if (weekday === 5) {
      monsters.push({ t: 'skeleton_runner', x: cx - 18, y: baseY - 8, dir: 1, speed: 0.8 });
      monsters.push({ t: 'goblin_grunt', x: cx + 18, y: baseY - 8 });
      monsters.push({ t: 'dark_elf_archer', x: cx, y: baseY - ph - 6 - 8 });
      monsters.push({ t: 'imp', x: cx, y: baseY - ph - 6 - ph2 - 6 - 8 });
    } else {
      monsters.push({ t: 'goblin_grunt', x: cx, y: baseY - 8 });
      monsters.push({ t: 'dark_elf_archer', x: cx - 16, y: baseY - ph - 6 - 8 });
      monsters.push({ t: 'dark_elf_archer', x: cx + 16, y: baseY - ph - 6 - 8 });
      monsters.push({ t: 'goblin_bomber', x: cx, y: baseY - ph - 6 - ph2 - 6 - 8 });
    }
  } else if (template === 1) {
    // Towers template: twin towers with crossbridge
    const tMat = weekday === 6 ? 'iron' : 'stone';
    const tw = 32;
    const th = 36;
    const x1 = cx - 36;
    const x2 = cx + 36;

    blocks.push({ m: tMat, x: x1 - 10, y: baseY - th / 2, w: 8, h: th });
    blocks.push({ m: tMat, x: x1 + 10, y: baseY - th / 2, w: 8, h: th });
    blocks.push({ m: 'wood', x: x1, y: baseY - th - 3, w: tw + 4, h: 6 });

    blocks.push({ m: tMat, x: x2 - 10, y: baseY - th / 2, w: 8, h: th });
    blocks.push({ m: tMat, x: x2 + 10, y: baseY - th / 2, w: 8, h: th });
    blocks.push({ m: 'wood', x: x2, y: baseY - th - 3, w: tw + 4, h: 6 });

    blocks.push({ m: 'wood', x: cx, y: baseY - th - 3, w: 32, h: 6 });

    if (weekday === 6) {
      monsters.push({ t: 'troll', x: cx, y: baseY - 14 });
      monsters.push({ t: 'orc_brute', x: x1, y: baseY - th - 6 - 14 });
      monsters.push({ t: 'dark_elf_hexer', x: x2, y: baseY - th - 6 - 8 });
    } else {
      monsters.push({ t: 'goblin_grunt', x: cx, y: baseY - 8 });
      monsters.push({ t: 'dark_elf_archer', x: x1, y: baseY - th - 6 - 8 });
      monsters.push({ t: 'dark_elf_archer', x: x2, y: baseY - th - 6 - 8 });
      monsters.push({ t: 'imp', x: cx, y: baseY - th - 26 });
    }
  } else {
    // Bunker template
    const bMat = weekday === 4 ? 'iron' : 'stone';
    const bw = 70;
    const bh = 28;

    blocks.push({ m: bMat, x: cx - bw / 2 + 5, y: baseY - bh / 2, w: 10, h: bh });
    blocks.push({ m: bMat, x: cx + bw / 2 - 5, y: baseY - bh / 2, w: 10, h: bh });
    blocks.push({ m: bMat, x: cx, y: baseY - bh - 3, w: bw, h: 6 });
    blocks.push({ m: 'wood', x: cx, y: baseY - bh - 6 - 12, w: 8, h: 24 });
    blocks.push({ m: 'wood', x: cx, y: baseY - bh - 6 - 27, w: 36, h: 6 });

    if (weekday === 4) {
      monsters.push({ t: 'orc_brute', x: cx, y: baseY - 14 });
      monsters.push({ t: 'dark_elf_hexer', x: cx - 18, y: baseY - bh - 6 - 8 });
      monsters.push({ t: 'goblin_bomber', x: cx + 18, y: baseY - bh - 6 - 8 });
    } else {
      monsters.push({ t: 'goblin_grunt', x: cx - 16, y: baseY - 8 });
      monsters.push({ t: 'goblin_grunt', x: cx + 16, y: baseY - 8 });
      monsters.push({ t: 'dark_elf_archer', x: cx, y: baseY - bh - 6 - 8 });
      monsters.push({ t: 'imp', x: cx, y: baseY - bh - 40 });
    }
  }

  blocks.push({ m: 'wood', x: cx - 75, y: baseY - 12, w: 8, h: 24 });

  const scoreTarget = 1000 + monsters.length * 150 + blocks.length * 40;

  return {
    id: 0,
    name: `Daily ${dateStr}`,
    realm,
    kind: 'daily',
    worldW,
    shots: 4,
    hints: ['Aim for structure joints.', 'One daily attempt per day.'],
    scoreTarget,
    _archetype: archetype,
    terrain,
    blocks,
    monsters,
  };
}
