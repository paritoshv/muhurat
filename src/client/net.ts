// A Room hides where the simulation runs: in this tab (solo) or on the server (room code).
import { Sim, type State } from '../shared/sim';

export interface Room {
  state: State | null; myId: string; code: string | null; error: string | null;
  input(dx: number, dy: number, drop: boolean): void;
  start(seed?: string): void;
  close(): void;
}

export class LocalRoom implements Room {
  myId = 'me'; code = null; error = null; state: State | null;
  private sim: Sim; private timer: number;
  constructor(seed: string, name: string) {
    this.sim = new Sim(seed); this.sim.addPlayer('me', name); this.state = this.sim.s;
    this.timer = window.setInterval(() => { this.sim.step(1 / 30); this.state = this.sim.s; }, 1000 / 30);
  }
  input(dx: number, dy: number, drop: boolean) { this.sim.setInput('me', dx, dy, drop); }
  start(seed?: string) { this.sim.start(seed); this.state = this.sim.s; }
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
