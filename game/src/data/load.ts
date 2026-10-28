import type { MusicData } from '../audio/trackgen';
import type { Config, Content, Level } from './types';
import type { ForgeConfig } from './forgeTypes';
import { TARGET } from '../config/target';

export const data = {
  content: undefined as unknown as Content,
  config: undefined as unknown as Config,
  forge: undefined as unknown as ForgeConfig,
  levels: {} as Record<number, Level>,
  music: undefined as unknown as MusicData | undefined,
  tutorials: undefined as unknown as { sections: Record<string, { title: string; pages: { title: string; body: string }[] }> } | undefined,
};

async function getJson<T>(path: string): Promise<T | undefined> {
  try {
    const r = await fetch(path);
    return r.ok ? ((await r.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Loads config.json, content.json and every level file before the game starts. */
export async function loadData(): Promise<void> {
  const [config, content, forge] = await Promise.all([getJson<Config>('data/config.json'), getJson<Content>('data/content.json'), getJson<ForgeConfig>('data/forge.json')]);
  if (!config || !content || !forge) throw new Error('cannot load game data');
  // a build target (the Android app) switches features off: config.json targets.<target>.features
  Object.assign(config.features, config.targets?.[TARGET]?.features ?? {});
  data.config = config;
  data.content = content;
  data.music = await getJson<MusicData>('data/music.json');
  data.tutorials = await getJson<NonNullable<typeof data.tutorials>>('data/tutorials.json');
  data.forge = forge;
  if (config.features.weaponForge) content.weapons.push(...forge.weapons.map((w) => ({ ...w })));
  await Promise.all((config.levels ?? []).map(async (id) => {
    const lv = await getJson<Level>(`data/levels/level_${String(id).padStart(2, '0')}.json`);
    if (lv) data.levels[id] = lv;
  }));
}
