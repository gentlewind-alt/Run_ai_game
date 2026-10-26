import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['src/arena/authority.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { ArenaAuthority } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const challenge = { doc: { schema: 'monster-mash-builder', version: 1, name: 'Fixture', blocks: [], monsters: [{ id: 'm', t: 'goblin_grunt', x: 400, y: 313 }], connections: [] }, loadout: ['w_militia_blade', 'w_militia_blade', 'w_militia_blade'] };
const input = { type: 'fire', frame: 0, angle: 35, power: 1 };
const replay = { frames: 1, actions: [input] };
let now = 1000000, nextResult, verified = 0;
const deps = {
  engineVersion: 'fixture-v1', now: () => now,
  online: () => ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase() })),
  loadChallenge: async () => ({ title: 'Fixture', challenge }),
  verify: () => { verified++; return nextResult; },
};
let a;
const reset = () => { now = 1000000; a = new ArenaAuthority(deps); ['a', 'b', 'c'].forEach(id => a.join(id)); };
const invite = async (from = 'a', to = 'b', wager = 10) => {
  await a.act(from, { type: 'arena:invite', targetId: to, challengeId: 'level', wager });
  return a.view(to).invitations.find(i => i.from === from).id;
};
const accept = async (wager = 10) => { const id = await invite('a', 'b', wager); await a.act('b', { type: 'arena:respond', inviteId: id, accept: true, wager }); return a.view('a').match; };
const finish = async (id, result) => {
  const match = a.view(id).match;
  const setup = await a.act(id, { type: 'arena:start', matchId: match.id, revision: match.revision });
  await a.act(id, { type: 'arena:input', matchId: match.id, revision: setup.revision, action: input });
  nextResult = result;
  await a.act(id, { type: 'arena:submit', matchId: match.id, revision: setup.revision, replay });
};
const result = (cleared, score) => ({ cleared, score, shotsUsed: 1, steps: 1, forfeit: false });
const checks = [];
async function test(name, fn) { reset(); await fn(); checks.push(name); }

await test('one starting grant survives snapshot restore', () => {
  a.join('a'); assert.equal(a.view('a').coins, 100);
  a = new ArenaAuthority(deps, a.state); a.join('a'); assert.equal(a.view('a').coins, 100);
});
await test('pending invitation never debits and sender may cancel', async () => {
  const id = await invite(); assert.equal(a.view('a').coins, 100); assert.equal(a.view('b').coins, 100);
  await a.act('a', { type: 'arena:cancel', inviteId: id }); assert.equal(a.view('b').invitations.length, 0);
});
await test('third rejection blocks only the sender-recipient pair for exactly one hour', async () => {
  for (let n = 0; n < 3; n++) { const id = await invite(); await a.act('b', { type: 'arena:respond', inviteId: id, accept: false, wager: 0 }); }
  const until = now + 3600000; assert.equal(a.view('a').cooldowns.b, until);
  await assert.rejects(() => invite(), /one-hour/); await invite('a', 'c', 0); await invite('b', 'a', 0);
  now = until - 1; await assert.rejects(() => invite(), /one-hour/);
  now++; await invite(); assert.equal(a.view('a').cooldowns.b, undefined);
});
await test('acceptance clears a consecutive rejection streak', async () => {
  for (let n = 0; n < 2; n++) { const id = await invite(); await a.act('b', { type: 'arena:respond', inviteId: id, accept: false, wager: 0 }); }
  const match = await accept(0); await a.act('a', { type: 'arena:forfeit', matchId: match.id, revision: match.revision });
  const id = await invite(); await a.act('b', { type: 'arena:respond', inviteId: id, accept: false, wager: 0 });
  assert.equal(a.view('a').cooldowns.b, undefined);
});
await test('wager escrow is atomic, duplicate acceptance cannot debit twice', async () => {
  const id = await invite(); await a.act('b', { type: 'arena:respond', inviteId: id, accept: true, wager: 10 });
  await assert.rejects(() => a.act('b', { type: 'arena:respond', inviteId: id, accept: true, wager: 10 }));
  assert.equal(a.view('a').coins, 90); assert.equal(a.view('b').coins, 90);
});
await test('recipient can accept without a wager', async () => {
  const id = await invite(); await a.act('b', { type: 'arena:respond', inviteId: id, accept: true, wager: 0 });
  assert.equal(a.view('a').match.wager, 0); assert.equal(a.view('a').coins, 100); assert.equal(a.view('b').coins, 100);
});
await test('pre-play cancellation refunds and does not alter records', async () => {
  const match = await accept(); await a.act('b', { type: 'arena:forfeit', matchId: match.id, revision: match.revision });
  assert.equal(a.view('a').coins, 100); assert.equal(a.view('b').coins, 100); assert.equal(a.view('a').wins, 0);
});
await test('clear beats a higher partial score and pot is paid once', async () => {
  await accept(); await finish('a', result(false, 99999)); await finish('b', result(true, 100));
  const match = a.view('a').match; assert.equal(match.winnerId, 'b'); assert.equal(a.view('a').coins, 90); assert.equal(a.view('b').coins, 110);
  assert.equal(a.view('b').wins, 1); assert.equal(a.view('a').losses, 1);
  await assert.rejects(() => a.act('b', { type: 'arena:submit', matchId: match.id, revision: match.revision - 1, replay }));
  assert.equal(a.view('b').coins, 110);
});
await test('equal clear and score draws and refunds both stakes', async () => {
  await accept(25); await finish('a', result(true, 700)); await finish('b', result(true, 700));
  assert.equal(a.view('a').match.resolution, 'draw'); assert.equal(a.view('a').coins, 100); assert.equal(a.view('b').coins, 100); assert.equal(a.view('b').draws, 1);
});
await test('out-of-turn starts and forged input histories are refused', async () => {
  const match = await accept(); await assert.rejects(() => a.act('b', { type: 'arena:start', matchId: match.id, revision: match.revision }), /turn/);
  const setup = await a.act('a', { type: 'arena:start', matchId: match.id, revision: match.revision });
  const before = verified;
  await assert.rejects(() => a.act('a', { type: 'arena:submit', matchId: match.id, revision: setup.revision, replay }), /inputs changed/);
  assert.equal(verified, before);
});
await test('timeouts forfeit turns and double forfeit draws without coin creation', async () => {
  await accept(50); now += 90000; a.expire(); assert.equal(a.view('b').match.turn, 1);
  now += 90000; a.expire(); assert.equal(a.view('a').match.resolution, 'draw'); assert.equal(a.view('a').coins + a.view('b').coins, 200);
});
await test('engine changes refund pending escrow and preserve balances/records', async () => {
  await accept(25); a = new ArenaAuthority({ ...deps, engineVersion: 'fixture-v2' }, a.state);
  assert.equal(a.view('a').match.resolution, 'cancelled'); assert.equal(a.view('a').coins, 100); assert.equal(a.view('b').coins, 100);
});
await test('invalid stakes and self invitations cannot create or reserve coins', async () => {
  for (const wager of [-1, 1.5, 1000, NaN]) await assert.rejects(() => invite('a', 'b', wager));
  await assert.rejects(() => invite('a', 'a', 0)); assert.equal(a.view('a').coins, 100);
});
await test('only the recipient can respond, and no one can increase an offered stake', async () => {
  const id = await invite(); await assert.rejects(() => a.act('c', { type: 'arena:respond', inviteId: id, accept: true, wager: 10 }));
  await assert.rejects(() => a.act('b', { type: 'arena:respond', inviteId: id, accept: true, wager: 50 }));
});
console.log(`Arena authority: ${checks.length} checks passed.`);
