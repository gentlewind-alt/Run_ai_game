import type { BuilderConfig, Content } from '../data/types';
import { newDraft, validateDraft, type BuilderDocument } from './document';
import { blockBounds, findDraftOverlaps } from './geometry';

export type SurpriseStyle = 'towers' | 'bunker' | 'bridge' | 'castle' | 'stacks';
export type SurpriseSize = 'small' | 'medium' | 'large';
export interface SurpriseOptions {
  content: Content;
  sizeOf: (type: string) => { w: number; h: number };
  style?: SurpriseStyle | 'random';
  size?: SurpriseSize;
  realm?: string;
  unlockedLevel?: number;
}

const STYLES: SurpriseStyle[] = ['towers', 'bunker', 'bridge', 'castle', 'stacks'];
type Preset = BuilderConfig['presets'][number];
interface Room { x: number; base: number; ceiling: number; width: number }

// The same Mulberry32 sequence used by Daily Mash; constants define the RNG, not balance.
function createRng(seed: number): { next: () => number; int: (min: number, max: number) => number } {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

function shuffle<T>(values: T[], rng: ReturnType<typeof createRng>): T[] {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Python fort_gen contacts and supported-load COM, scoped to each independent structure. */
export function checkSurpriseStable(doc: BuilderDocument, content: Content, sizeOf: SurpriseOptions['sizeOf']): boolean {
  const config = content.builder;
  const tune = config.surprise;
  if (findDraftOverlaps(doc, sizeOf).length) return false;
  const pieces = [
    ...doc.blocks,
    ...doc.monsters.map(m => ({ ...m, ...sizeOf(m.t), m: 'wood', shape: 'rectangle' as const })),
  ];
  const bounds = pieces.map(blockBounds);
  const supports = pieces.map((_piece, i) => pieces.flatMap((_other, j) => {
    const a = bounds[i], b = bounds[j];
    return i !== j && Math.abs(a.b - b.t) <= tune.contactTolerance && Math.min(a.r, b.r) > Math.max(a.l, b.l) ? [j] : [];
  }));
  const floorHeight = config.presets.find(p => p.id === tune.pieces.floor)!.h;
  for (let i = 0; i < pieces.length; i++) {
    const a = bounds[i];
    const inset = Math.min(tune.supportInset, (a.r - a.l) / 4);
    const contacts = supports[i];
    const covers = (x: number): boolean => contacts.some(j => bounds[j].l <= x && bounds[j].r >= x);
    const ground = Math.abs(a.b - config.groundY) <= tune.contactTolerance;
    const centre = contacts.some(j => bounds[j].l <= pieces[i].x && bounds[j].r >= pieces[i].x && bounds[j].r - bounds[j].l <= tune.maxSupportWidth);
    if (!ground && !(covers(a.l + inset) && covers(a.r - inset)) && !centre) return false;
    if (i >= doc.blocks.length || a.b - a.t > floorHeight || a.r - a.l <= tune.maxSupportWidth || ground) continue;
    const pillars = contacts.filter(j => bounds[j].r - bounds[j].l <= tune.maxSupportWidth);
    if (pillars.length < 2) return false;
    const left = Math.min(...pillars.map(j => bounds[j].l));
    const right = Math.max(...pillars.map(j => bounds[j].r));
    const above = new Set<number>([i]);
    // Contacts always lead upwards, so this walk cannot include an unrelated neighbouring tower.
    for (const lower of above) {
      supports.forEach((below, upper) => { if (below.includes(lower)) above.add(upper); });
    }
    above.delete(i);
    let mass = 0, moment = 0;
    for (const j of above) {
      const density = j < doc.blocks.length
        ? content.materials.find(m => m.id === pieces[j].m)?.density
        : content.monsters.find(m => m.id === doc.monsters[j - doc.blocks.length].t)?.density;
      const weight = pieces[j].w * pieces[j].h * (density ?? content.materials.find(m => m.id === 'wood')?.density ?? 1);
      mass += weight;
      moment += pieces[j].x * weight;
    }
    if (mass && (moment / mass < left - tune.contactTolerance || moment / mass > right + tune.contactTolerance)) return false;
  }
  return true;
}

/** Pure: all content, dimensions and unlocked progress are explicit inputs. */
export function surpriseFort(seed: number, options: SurpriseOptions): BuilderDocument {
  const { content, sizeOf } = options;
  const config = content.builder;
  const tune = config.surprise;
  const size = tune.sizes[options.size ?? 'medium'];
  const realm = options.realm
    ? content.realms.find(r => r.id === options.realm)
    : content.realms.filter(r => r.levels.some(level => level <= (options.unlockedLevel ?? content.realms[0].levels[0]))).pop() ?? content.realms[0];
  if (!realm) throw new Error('Unknown surprise realm');
  const roster = realm.monsters.filter(id => config.targets.includes(id) && content.monsters.some(m => m.id === id && !m.boss && !tune.excludeBehaviors.includes(m.behavior ?? '')));
  const materials = tune.realmMaterials[realm.id];
  if (!roster.length || !materials?.length) throw new Error('This realm needs surprise materials and targets');
  const preset = (id: string): Preset => {
    const piece = config.presets.find(p => p.id === id);
    if (!piece || piece.shape !== 'rectangle' || piece.variant) throw new Error('Surprise pieces must be solid rectangle presets');
    return piece;
  };
  const post = preset(tune.pieces.post), floor = preset(tune.pieces.floor);
  const taper = preset(tune.pieces.taperFloor), wall = preset(tune.pieces.wall), cap = preset(tune.pieces.crenellation);
  const material = (tier: number): string => materials[Math.min(tier, materials.length - 1)];
  const originalSeed = seed >>> 0;

  const candidate = (attemptSeed: number, fallback: boolean): BuilderDocument => {
    const rng = createRng(attemptSeed);
    const doc = newDraft();
    doc.name = `${tune.namePrefix}${originalSeed}`;
    const rooms: Room[] = [];
    const style = fallback ? 'bunker' : !options.style || options.style === 'random' ? STYLES[rng.int(0, STYLES.length - 1)] : options.style;
    const add = (piece: Preset, x: number, base: number, m: string, rotate = false): void => {
      const height = rotate ? piece.w : piece.h;
      doc.blocks.push({ id: `surprise_block_${doc.blocks.length + 1}`, m, x, y: base - height / 2, w: piece.w, h: piece.h, shape: piece.shape, angle: rotate ? 90 : 0, static: false });
    };
    const battlements = (x: number, base: number, roof: Preset, tier: number): void => {
      const dx = (roof.w - cap.w) / 2;
      add(cap, x - dx, base, material(tier));
      add(cap, x + dx, base, material(tier));
    };
    const roofRoom = (x: number, base: number, roof: Preset): void => {
      rooms.push({ x, base, ceiling: config.minY, width: roof.w });
    };
    // A frame is posts at bay edges and one thin preset floor. Thick walls are stacked rotated bricks.
    const frame = (x: number, base: number, roof: Preset, tier: number, layers = 1, thick = false): number => {
      const height = thick ? wall.w : post.h;
      const width = thick ? wall.h : post.w;
      const dx = thick ? (roof.w - width) / 2 : roof.w / 2 - tune.supportInset;
      for (const side of [-1, 1]) {
        for (let layer = 0; layer < layers; layer++) add(thick ? wall : post, x + side * dx, base - layer * height, material(tier), thick);
      }
      const ceiling = base - layers * height;
      rooms.push({ x, base, ceiling, width: dx * 2 - width });
      add(roof, x, ceiling, material(tier));
      return ceiling - roof.h;
    };
    const tower = (x: number, base: number, tiers: number, startTier: number, crenels: boolean, narrow = false): void => {
      let roof = narrow ? taper : floor;
      let top = base;
      for (let tier = 0; tier < tiers; tier++) {
        if (!fallback && tier && roof.w > taper.w && rng.next() < tune.taperChance) {
          const offset = Math.min(tune.offsetMax, (roof.w - taper.w) / 2);
          x += rng.int(-Math.floor(offset / config.grid), Math.floor(offset / config.grid)) * config.grid;
          roof = taper;
        }
        top = frame(x, top, roof, startTier + tier);
      }
      if (crenels) battlements(x, top, roof, startTier + tiers);
      else roofRoom(x, top, roof);
    };
    const count = style === 'towers' ? size.towers : style === 'stacks' ? size.stacks : style === 'bridge' ? 1 : fallback ? tune.sizes.small.bays : size.bays;
    const separated = style === 'towers' || style === 'stacks';
    const pitch = floor.w + (separated ? tune.structureGap : 0);
    const span = count * floor.w + (count - 1) * (separated ? tune.structureGap : 0);
    const min = Math.ceil(Math.max(config.minX + tune.edgePadding, tune.fortMinX) / config.grid);
    const max = Math.floor((Math.min(config.worldW - tune.edgePadding, tune.fortMaxX) - span) / config.grid);
    if (max < min) throw new Error('Surprise fort is too wide for the build area');
    const left = rng.int(min, max) * config.grid;
    const centres = Array.from({ length: count }, (_v, i) => left + floor.w / 2 + i * pitch);

    if (style === 'towers') {
      const heights = shuffle(Array.from({ length: count }, (_v, i) => Math.max(tune.styles.towers.minTiers, size.tiers - i)), rng);
      centres.forEach((x, i) => tower(x, config.groundY, heights[i], 0, true));
    } else if (style === 'stacks') {
      const heights = shuffle(Array.from({ length: count }, (_v, i) => tune.styles.stacks.minTiers + i % Math.min(size.tiers, tune.styles.stacks.maxTiers)), rng);
      centres.forEach((x, i) => tower(x, config.groundY, heights[i], 0, false));
    } else if (style === 'bunker') {
      centres.forEach(x => {
        let top = config.groundY;
        for (let tier = 0; tier < tune.styles.bunker.tiers; tier++) top = frame(x, top, floor, tier, tune.styles.bunker.wallLayers, true);
        roofRoom(x, top, floor);
      });
    } else if (style === 'bridge') {
      const x = centres[0];
      const top = frame(x, config.groundY, floor, 0, tune.styles.bridge.pillarTiers);
      tower(x, top, Math.max(1, size.tiers - tune.styles.bridge.topTierReduction), 1, false, true);
    } else {
      centres.forEach((x, i) => {
        let top = config.groundY;
        for (let tier = 0; tier < tune.styles.castle.wallTiers; tier++) top = frame(x, top, floor, tier);
        if (i === 0 || i === centres.length - 1) tower(x, top, size.tiers - tune.styles.castle.wallTiers, tune.styles.castle.wallTiers, true);
        else battlements(x, top, floor, tune.styles.castle.wallTiers);
      });
    }

    // Reserve keep_clear rectangles in the empty bays, distributing occupants before choosing types.
    let remaining = size.monsters;
    const available = shuffle(rooms, rng);
    available.forEach((room, i) => {
      const occupants = Math.ceil(remaining / (available.length - i));
      for (let slot = 0; slot < occupants; slot++) {
        const width = room.width / occupants;
        const onGround = Math.abs(room.base - config.groundY) <= tune.contactTolerance;
        const types = roster.filter(id => {
          const body = sizeOf(id);
          const density = content.monsters.find(m => m.id === id)?.density ?? content.materials.find(m => m.id === 'wood')?.density ?? 1;
          // Heavy targets crush the thin posts under an upper floor, so they only stand on the ground.
          return body.w + tune.headroom <= width && body.h + tune.headroom <= room.base - room.ceiling && (onGround || body.w * body.h * density <= tune.maxFloorMass);
        });
        if (!types.length) return;
        const type = types[rng.int(0, types.length - 1)];
        const body = sizeOf(type);
        doc.monsters.push({ id: `surprise_target_${doc.monsters.length + 1}`, t: type, x: room.x - room.width / 2 + width * (slot + 0.5), y: room.base - body.h / 2 });
        remaining--;
      }
    });
    if (remaining || doc.monsters.length < size.monsters) throw new Error('Surprise fort needs more target bays');
    const safe = validateDraft(doc, config, sizeOf);
    if (!checkSurpriseStable(safe, content, sizeOf)) throw new Error('Surprise stability check rejected frame');
    return safe;
  };

  for (let attempt = 0; attempt < tune.retryLimit; attempt++) {
    try { return candidate((originalSeed + attempt) >>> 0, false); }
    catch { /* Retry the next deterministic seed for bounds, overlaps, support or keep_clear. */ }
  }
  return candidate((originalSeed + tune.retryLimit) >>> 0, true);
}
