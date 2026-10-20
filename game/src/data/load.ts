import type { Config, Content, Level } from './types';

export const data = {
  content: undefined as unknown as Content,
  config: undefined as unknown as Config,
  levels: {} as Record<number, Level>,
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
  const [config, content] = await Promise.all([getJson<Config>('data/config.json'), getJson<Content>('data/content.json')]);
  if (!config || !content) throw new Error('cannot load data/config.json or data/content.json');
  data.config = config;
  data.content = content;
  await Promise.all((config.levels ?? []).map(async (id) => {
    const lv = await getJson<Level>(`data/levels/level_${String(id).padStart(2, '0')}.json`);
    if (lv) data.levels[id] = lv;
  }));
}
