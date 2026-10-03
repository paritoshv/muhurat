// Runs greedy bots through full weddings: checks the sim terminates, is
// deterministic per seed, and reports win rates for balance tuning.
import assert from 'node:assert';
import { Sim, STATIONS, GEN, dailySeed, type State } from '../src/shared/sim';

function botInput(s: State, i: number): [number, number] {
  const p = s.players[i];
  const go = (t: { x: number; y: number }): [number, number] => { const d = Math.hypot(t.x - p.x, t.y - p.y) || 1; return [(t.x - p.x) / d, (t.y - p.y) / d]; };
  if (s.disasters.some(d => d.kind === 'bijli') && i === 0) return go(GEN);
  const waiting = s.guests.filter(g => g.state === 'waiting').sort((a, b) => a.patience - b.patience);
  const mine = waiting.filter((_, k) => k % s.players.length === i)[0] ?? waiting[0];
  if (!mine) return [0, 0];
  if (p.carry === mine.want) return go(mine);
  if (p.carry) return [0, 0];
  return go(STATIONS.find(st => st.item === mine.want)!);
}

function run(seed: string, n: number) {
  const sim = new Sim(seed);
  for (let i = 0; i < n; i++) sim.addPlayer('b' + i, 'Bot' + i);
  sim.start();
  let steps = 0;
  while (sim.s.phase === 'run' && steps++ < 30 * 400) {
    sim.s.players.forEach((p, i) => {
      const [dx, dy] = botInput(sim.s, i);
      const wrong = !!p.carry && !sim.s.guests.some(g => g.state === 'waiting' && g.want === p.carry);
      sim.setInput(p.id, dx, dy, wrong);
    });
    sim.step(1 / 30);
  }
  assert.equal(sim.s.phase, 'over', 'run must end');
  assert.ok(sim.s.result!.headline.length > 10);
  return sim.s;
}

const a = run('daily-2026-10-04', 2), b = run('daily-2026-10-04', 2);
assert.deepEqual(a.result, b.result, 'same seed and inputs give the same wedding');
console.log('example:', a.result);

for (const n of [1, 2, 4]) {
  let wins = 0, served = 0; const N = 30;
  for (let k = 0; k < N; k++) { const s = run('seed' + k, n); if (s.result!.won) wins++; served += s.served; }
  console.log(`${n} bot(s): win ${wins}/${N}, avg served ${(served / N).toFixed(0)}`);
}

// Leaderboard: a recorded solo run must replay to the same result, and the
// function must rank it using its own replay, not anything the client claims.
import { replay, quant, validLog, type InputLog } from '../src/shared/replay';
import { handle, type KV } from '../netlify/functions/board/index.mts';
{
  const seed = dailySeed(), sim = new Sim(seed), log: InputLog = [];
  sim.addPlayer('me', 'me'); sim.start();
  for (let tick = 0, last = ''; sim.s.phase === 'run'; tick++) {
    const p = sim.s.players[0], [dx, dy] = botInput(sim.s, 0).map(quant);
    const drop = !!p.carry && !sim.s.guests.some(g => g.state === 'waiting' && g.want === p.carry);
    if (`${dx},${dy}` !== last || drop || tick === 0) { log.push([tick, dx, dy, drop ? 1 : 0]); sim.setInput('me', dx, dy, drop); last = `${dx},${dy}`; }
    sim.step(1 / 30);
  }
  assert.ok(validLog(log));
  assert.deepEqual(replay(seed, log).result, sim.s.result, 'replay reproduces the run');
  const mem = new Map<string, unknown>();
  const kv: KV = { get: async k => mem.get(k) ?? null, setJSON: async (k, v) => { mem.set(k, JSON.parse(JSON.stringify(v))); } };
  const post = (body: unknown) => handle(new Request('https://x/api/score', { method: 'POST', body: JSON.stringify(body) }), kv, '1.2.3.4');
  const ok = await (await post({ seed, name: 'paritosh', log })).json();
  assert.equal(ok.score, sim.s.result!.score); assert.equal(ok.rank, 1);
  assert.equal((await post({ seed, name: 'idle', log: [] })).status, 200, 'an idle run is a real (losing) run');
  assert.equal((await post({ seed: 'daily-2020-01-01', name: 'old', log })).status, 400);
  assert.equal((await post({ seed, name: 'x', log })).status, 422);
  assert.equal((await post({ seed, name: 'cheat', log: [[0, 5, 0, 0]] })).status, 400);
  const board = await (await handle(new Request('https://x/api/board'), kv, '1.2.3.4')).json();
  assert.deepEqual(board.top.map((e: any) => e.name), ['PARITOSH', 'IDLE']);
  console.log('board:', board.top.map((e: any) => `${e.name} ${e.score}`).join(', '));
}
console.log('ok');
