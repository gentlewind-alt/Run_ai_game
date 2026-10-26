// Local development fixtures. Hosted rooms always load real community entries through the platform.
const doc = (name: string) => ({
  schema: 'monster-mash-builder', version: 1, name,
  blocks: [
    { id: 'post_l', m: 'wood', x: 368, y: 288, w: 8, h: 64, shape: 'rectangle', angle: 0, static: false },
    { id: 'post_r', m: 'wood', x: 432, y: 288, w: 8, h: 64, shape: 'rectangle', angle: 0, static: false },
    { id: 'deck', m: 'stone', x: 400, y: 252, w: 96, h: 8, shape: 'rectangle', angle: 0, static: false },
  ],
  monsters: [{ id: 'guard', t: 'goblin_grunt', x: 400, y: 241 }], connections: [],
});
export const DEV_CHALLENGES = [
  { id: 'seed_1', title: "MashMaster's siege", data: { v: 1, shots: 5, allowed: ['w_militia_blade', 'w_iron_cleaver', 'w_blast_tube'], doc: doc("MashMaster's siege") } },
  { id: 'seed_2', title: "GoblinCrusher's siege", data: { v: 1, shots: 3, allowed: ['w_militia_blade'], doc: doc("GoblinCrusher's siege") } },
];
