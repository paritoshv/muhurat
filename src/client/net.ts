// A Room hides where the simulation runs: in this tab (solo) or on the server (room code).
import { Sim, type State } from '../shared/sim';
import { TICK, quant, type InputLog } from '../shared/replay';

export interface Room {
  state: State | null; myId: string; code: string | null; error: string | null;
  input(dx: number, dy: number, drop: boolean): void;
  start(seed?: string): void;
  close(): void;
}

export class LocalRoom implements Room {
  myId = 'me'; code = null; error = null; state: State | null;
  /** Inputs of the current run, tick by tick. The leaderboard replays this. */
  log: InputLog = [];
  private sim: Sim; private timer: number; private tick = 0; private last = '';
  private pending = { dx: 0, dy: 0, drop: false };
  constructor(seed: string, name: string) {
    this.sim = new Sim(seed); this.sim.addPlayer('me', name); this.state = this.sim.s;
    this.timer = window.setInterval(() => this.step(), 1000 * TICK);
  }
  private step() {
    const p = this.pending;
    if (this.sim.s.phase === 'run') {
      const sig = `${p.dx},${p.dy}`;
      if (sig !== this.last || p.drop || this.tick === 0) {
        this.log.push([this.tick, p.dx, p.dy, p.drop ? 1 : 0]);
        this.sim.setInput('me', p.dx, p.dy, p.drop); this.last = sig;
      }
      this.tick++;
    } else this.sim.setInput('me', p.dx, p.dy, false);
    p.drop = false;
    this.sim.step(TICK); this.state = this.sim.s;
  }
  input(dx: number, dy: number, drop: boolean) { this.pending.dx = quant(dx); this.pending.dy = quant(dy); if (drop) this.pending.drop = true; }
  start(seed?: string) { this.sim.start(seed); this.state = this.sim.s; this.tick = 0; this.log = []; this.last = ''; }
  close() { clearInterval(this.timer); }
}

export class RemoteRoom implements Room {
  myId = ''; code: string | null = null; error: string | null = null; state: State | null = null;
  private ws: WebSocket;
  constructor(hello: { t: 'create' | 'join'; name: string; seed?: string; room?: string }) {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.send(hello);
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'joined') { this.myId = m.id; this.code = m.room; }
      else if (m.t === 'state') this.state = m.s;
      else if (m.t === 'error') this.error = m.text;
    };
    this.ws.onclose = () => { if (!this.error) this.error = 'Lost the connection to the room.'; };
    this.ws.onerror = () => { this.error = 'Could not reach the game server.'; };
  }
  private send(m: unknown) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  input(dx: number, dy: number, drop: boolean) { this.send({ t: 'input', dx, dy, drop }); }
  start(seed?: string) { this.send({ t: 'start', seed }); }
  close() { this.ws.onclose = null; this.ws.close(); }
}
