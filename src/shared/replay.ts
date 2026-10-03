// A solo run is fully determined by its seed and the player's inputs, tick by
// tick. The client records that log; the leaderboard replays it to get the score,
// so a posted score is computed by the server, never claimed by the client.
import { Sim, RUN_SECONDS, type State } from './sim';

export type InputLog = [tick: number, dx: number, dy: number, drop: 0 | 1][];
export const TICK = 1 / 30, MAX_TICKS = RUN_SECONDS * 30 + 60;
export const quant = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;

export function validLog(log: unknown): log is InputLog {
  if (!Array.isArray(log) || log.length > MAX_TICKS) return false;
  let prev = 0;
  for (const e of log) {
    if (!Array.isArray(e) || e.length !== 4) return false;
    const [t, dx, dy, drop] = e;
    if (!Number.isInteger(t) || t < prev || t > MAX_TICKS) return false;
    if (typeof dx !== 'number' || typeof dy !== 'number' || !(Math.abs(dx) <= 1) || !(Math.abs(dy) <= 1)) return false;
    if (drop !== 0 && drop !== 1) return false;
    prev = t;
  }
  return true;
}

export function replay(seed: string, log: InputLog): State {
  const sim = new Sim(seed); sim.addPlayer('me', 'me'); sim.start();
  let i = 0;
  for (let tick = 0; tick < MAX_TICKS && sim.s.phase === 'run'; tick++) {
    while (i < log.length && log[i][0] <= tick) { sim.setInput('me', log[i][1], log[i][2], !!log[i][3]); i++; }
    sim.step(TICK);
  }
  return sim.s;
}
