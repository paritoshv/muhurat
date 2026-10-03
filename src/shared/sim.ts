// Muhurat: the whole game simulation. Pure and seeded, so the same seed gives
// everyone the same wedding. Runs on the server for rooms and in the browser for solo.
import { hashSeed, mulberry32 } from './rng';

export const W = 960, H = 600, RUN_SECONDS = 300, MAX_PLAYERS = 6;
export type Item = 'chai' | 'paneer' | 'mithai' | 'chair';
export type Kind = 'fufaji' | 'bua' | 'mama' | 'dadi' | 'pandit' | 'baraati';
export type DKind = 'bijli' | 'baarish' | 'ghodi' | 'paneer';

export const STATIONS: { item: Item; x: number; y: number; label: string }[] = [
  { item: 'chai', x: 150, y: 110, label: 'Chai' },
  { item: 'paneer', x: 480, y: 100, label: 'Halwai' },
  { item: 'mithai', x: 790, y: 110, label: 'Mithai' },
  { item: 'chair', x: 120, y: 520, label: 'Chairs' },
];
export const GEN = { x: 852, y: 520 }, GATE = { x: 40, y: 330 }, MANDAP = { x: 840, y: 300 };
export const SPOTS: { x: number; y: number }[] = [];
for (const y of [230, 330, 430]) for (const x of [270, 390, 510, 630]) SPOTS.push({ x, y });
const PANDIT_SPOT = SPOTS.push({ x: 752, y: 300 }) - 1;

export const NAMES: Record<Kind, string> = {
  fufaji: 'Fufaji', bua: 'Bua ji', mama: 'Mamaji', dadi: 'Dadi', pandit: 'Pandit ji', baraati: 'Baraati',
};
export const ITEM_NAMES: Record<Item, string> = { chai: 'chai', paneer: 'paneer', mithai: 'mithai', chair: 'a chair' };
export const DISASTER_TEXT: Record<DKind, string> = {
  bijli: 'during the power cut', baarish: 'in the rain', ghodi: 'while the ghodi was loose', paneer: 'after the paneer ran out',
};

export interface Player { id: string; name: string; x: number; y: number; dx: number; dy: number; drop: boolean; carry: Item | null; cd: number; color: number }
export interface Guest {
  id: number; kind: Kind; name: string; x: number; y: number; tx: number; ty: number; spot: number;
  state: 'arriving' | 'content' | 'waiting' | 'leaving'; want: Item | null; patience: number; timer: number; n: number; happy: boolean;
}
export interface Disaster { kind: DKind; until: number; progress: number }
export interface Incident { t: number; text: string; weight: number }
export interface Mover { x: number; y: number; vx: number; vy: number; turn: number; tick: number }
export interface State {
  seed: string; phase: 'lobby' | 'run' | 'over'; t: number; izzat: number; served: number; muhurat: number;
  players: Player[]; guests: Guest[]; disasters: Disaster[]; horse: Mover | null; chintu: Mover | null;
  incidents: Incident[]; toasts: { text: string; t: number }[];
  result: null | { won: boolean; headline: string; score: number };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function dailySeed(d = new Date()): string { return 'daily-' + d.toISOString().slice(0, 10); }

export class Sim {
  s: State;
  private rr: () => number = Math.random;
  private arrivals: { t: number; kind: Kind }[] = [];
  private disasterPlan: { t: number; kind: DKind }[] = [];
  private chintuAt = 0;
  private nextBaraati = 0;
  private gid = 0;

  constructor(seed: string) { this.s = this.fresh(seed); }

  private fresh(seed: string): State {
    return { seed, phase: 'lobby', t: 0, izzat: 100, served: 0, muhurat: RUN_SECONDS, players: [], guests: [], disasters: [], horse: null, chintu: null, incidents: [], toasts: [], result: null };
  }

  addPlayer(id: string, name: string): boolean {
    if (this.s.players.length >= MAX_PLAYERS) return false;
    const used = new Set(this.s.players.map(p => p.color));
    let color = 0; while (used.has(color)) color++;
    const i = this.s.players.length;
    this.s.players.push({ id, name: name.slice(0, 12) || 'Guest', x: 400 + i * 40, y: 525, dx: 0, dy: 0, drop: false, carry: null, cd: 0, color });
    return true;
  }
  removePlayer(id: string) { this.s.players = this.s.players.filter(p => p.id !== id); }
  setInput(id: string, dx: number, dy: number, drop: boolean) {
    const p = this.s.players.find(q => q.id === id); if (!p) return;
    p.dx = Number.isFinite(dx) ? clamp(dx, -1, 1) : 0; p.dy = Number.isFinite(dy) ? clamp(dy, -1, 1) : 0;
    if (drop) p.drop = true;
  }

  // Begin (or restart) a run. The schedule comes only from the seed.
  start(seed?: string) {
    const players = this.s.players;
    this.s = this.fresh(seed || this.s.seed);
    players.forEach((p, i) => { p.carry = null; p.cd = 0; p.x = 400 + i * 40; p.y = 525; });
    this.s.players = players; this.s.phase = 'run';
    const r = mulberry32(hashSeed(this.s.seed));
    this.rr = mulberry32(hashSeed(this.s.seed + '#run'));
    const named: Kind[] = ['fufaji', 'bua', 'mama', 'dadi', 'pandit'];
    for (let i = named.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [named[i], named[j]] = [named[j], named[i]]; }
    this.arrivals = named.map((kind, i) => ({ t: 6 + i * 22 + r() * 10, kind }));
    this.chintuAt = 40 + r() * 30;
    this.disasterPlan = [];
    const kinds: DKind[] = ['bijli', 'baarish', 'ghodi', 'paneer'];
    let t = 30 + r() * 10, last: DKind | null = null;
    while (t < RUN_SECONDS - 25) {
      let k: DKind; do { k = kinds[Math.floor(r() * kinds.length)]; } while (k === last);
      this.disasterPlan.push({ t, kind: k }); last = k; t += 32 + r() * 18;
    }
    this.nextBaraati = 2; this.gid = 0;
  }

  has(kind: DKind) { return this.s.disasters.some(d => d.kind === kind); }
  private toast(text: string) { this.s.toasts.push({ text, t: this.s.t }); }

  step(dt: number) {
    const s = this.s;
    const speed = 175 * (this.has('baarish') ? 0.62 : 1);
    for (const p of s.players) {
      const m = Math.hypot(p.dx, p.dy);
      if (m > 0.05) { const k = speed * dt / Math.max(1, m); p.x = clamp(p.x + p.dx * k, 20, W - 20); p.y = clamp(p.y + p.dy * k, 66, H - 20); }
    }
    if (s.phase !== 'run') { for (const p of s.players) p.drop = false; return; }
    s.t += dt;
    this.spawn(); this.updateDisasters(dt); this.updateGuests(dt); this.updateChintu(dt); this.interact(dt);
    s.toasts = s.toasts.filter(x => s.t - x.t < 4).slice(-4);
    if (s.izzat <= 0) this.finish(false); else if (s.t >= s.muhurat) this.finish(true);
  }

  private freeSpot(): number {
    const taken = new Set(this.s.guests.map(g => g.spot));
    const free: number[] = [];
    for (let i = 0; i < PANDIT_SPOT; i++) if (!taken.has(i)) free.push(i);
    return free.length ? free[Math.floor(this.rr() * free.length)] : -1;
  }
  private addGuest(kind: Kind, spot: number) {
    const sp = SPOTS[spot];
    this.s.guests.push({ id: this.gid++, kind, name: NAMES[kind], x: GATE.x, y: GATE.y, tx: sp.x, ty: sp.y, spot, state: 'arriving', want: null, patience: 1, timer: 1.5, n: 0, happy: false });
  }
  private spawn() {
    const s = this.s;
    while (this.arrivals.length && this.arrivals[0].t <= s.t) {
      const kind = this.arrivals[0].kind;
      const spot = kind === 'pandit' ? PANDIT_SPOT : this.freeSpot();
      if (spot < 0) break;
      this.arrivals.shift(); this.addGuest(kind, spot); this.toast(`${NAMES[kind]} has arrived`);
    }
    if (!s.chintu && s.t >= this.chintuAt) { s.chintu = { x: GATE.x, y: GATE.y, vx: 0, vy: 0, turn: 0, tick: 0 }; this.toast('Chintu is here. Guard the mithai'); }
    const cap = Math.min(12, 3 + 2 * s.players.length);
    if (s.t >= this.nextBaraati) {
      this.nextBaraati = s.t + 7;
      if (s.guests.filter(g => g.kind !== 'pandit').length < cap) { const spot = this.freeSpot(); if (spot >= 0) this.addGuest('baraati', spot); }
    }
  }

  private pickWant(g: Guest): Item {
    const r = this.rr();
    switch (g.kind) {
      case 'fufaji': return r < 0.7 ? 'chai' : 'mithai';
      case 'mama': return r < 0.8 ? 'paneer' : 'chai';
      case 'dadi': return g.n === 0 ? 'chair' : r < 0.5 ? 'mithai' : 'chai';
      case 'pandit': return r < 0.5 ? 'mithai' : 'chai';
      case 'bua': return r < 0.34 ? 'chai' : r < 0.67 ? 'paneer' : 'mithai';
      default: return r < 0.5 ? 'paneer' : r < 0.75 ? 'chai' : 'mithai';
    }
  }

  private updateGuests(dt: number) {
    const s = this.s;
    const drainMul = (this.has('bijli') ? 1.5 : 1) * (this.has('baarish') ? 1.25 : 1);
    const crew = [1.4, 1, 0.9, 0.8, 0.75, 0.7][clamp(s.players.length, 1, 6) - 1]; // small crews get more patient guests
    for (const g of s.guests) {
      const d = Math.hypot(g.tx - g.x, g.ty - g.y);
      const sp = g.state === 'leaving' ? 150 : g.kind === 'dadi' ? 55 : 95;
      if (d > 2) { const k = Math.min(1, sp * dt / d); g.x += (g.tx - g.x) * k; g.y += (g.ty - g.y) * k; }
      if (g.state === 'arriving') { if (d <= 2) g.state = 'content'; }
      else if (g.state === 'content') {
        g.timer -= dt;
        if (g.timer <= 0) { g.want = this.pickWant(g); g.patience = 1; g.state = 'waiting'; }
      } else if (g.state === 'waiting') {
        const trait = g.kind === 'fufaji' ? 1.7 : g.kind === 'dadi' ? 0.6 : 1;
        g.patience -= dt / (21 * crew) * trait * drainMul * (1 + 0.5 * s.t / RUN_SECONDS);
        if (g.patience <= 0) this.naraz(g);
      }
    }
    s.guests = s.guests.filter(g => !(g.state === 'leaving' && dist(g, GATE) < 6));
  }

  private naraz(g: Guest) {
    const s = this.s;
    const penalty = g.kind === 'fufaji' ? 30 : 12;
    const ctx = s.disasters.map(d => DISASTER_TEXT[d.kind]);
    let text = `${g.name} went naraz waiting for ${ITEM_NAMES[g.want!]}`;
    if (ctx.length) text += ' ' + ctx.join(' and ');
    s.izzat -= penalty;
    s.incidents.push({ t: s.t, text, weight: penalty * (1 + ctx.length) });
    this.toast(`${g.name} naraz ho gaye! Izzat -${penalty}`);
    if (g.kind === 'pandit') { s.muhurat = Math.max(s.t + 5, s.muhurat - 20); this.toast('Pandit ji moved the muhurat 20s earlier'); }
    if (g.kind === 'bua') {
      for (const o of s.guests) if (o !== g && o.state === 'waiting' && dist(o, g) < 190) o.patience -= 0.3;
      this.toast('Bua ji is telling everyone');
    }
    g.state = 'leaving'; g.want = null; g.tx = GATE.x; g.ty = GATE.y; g.spot = -1 - g.id;
  }

  private updateDisasters(dt: number) {
    const s = this.s;
    while (this.disasterPlan.length && this.disasterPlan[0].t <= s.t) {
      const { kind } = this.disasterPlan.shift()!;
      const life = { bijli: 40, baarish: 20, ghodi: 45, paneer: 18 }[kind];
      s.disasters.push({ kind, until: s.t + life, progress: 0 });
      if (kind === 'ghodi') s.horse = { x: GATE.x, y: GATE.y, vx: 230, vy: 60, turn: 1, tick: 3 };
      this.toast({ bijli: 'Bijli gayi! Crank the generator', baarish: 'Baarish! Everyone is slow in the keechad', ghodi: 'Ghodi bhaag gayi! Corner her', paneer: 'Paneer khatam! Halwai is restocking' }[kind]);
    }
    for (const d of s.disasters) {
      if (d.kind === 'bijli') { for (const p of s.players) if (dist(p, GEN) < 55) d.progress += dt / 4; if (d.progress >= 1) { d.until = 0; this.toast('Bijli aa gayi'); } }
      if (d.kind === 'ghodi' && s.horse) {
        const h = s.horse;
        h.turn -= dt; if (h.turn <= 0) { const a = this.rr() * Math.PI * 2; h.vx = Math.cos(a) * 230; h.vy = Math.sin(a) * 230; h.turn = 0.8 + this.rr() * 0.9; }
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (h.x < 30 || h.x > W - 30) { h.vx *= -1; h.x = clamp(h.x, 30, W - 30); }
        if (h.y < 80 || h.y > H - 30) { h.vy *= -1; h.y = clamp(h.y, 80, H - 30); }
        for (const p of s.players) {
          if (dist(p, h) < 60) d.progress += dt / 1.6;
          if (dist(p, h) < 28 && p.carry) { this.toast(`The ghodi knocked ${p.name}'s ${p.carry === 'chair' ? 'chair' : p.carry} over`); p.carry = null; p.cd = 0.6; }
        }
        h.tick -= dt;
        if (h.tick <= 0) {
          h.tick = 3; let best: Guest | null = null;
          for (const g of s.guests) if (g.state === 'waiting' && (!best || dist(g, h) < dist(best, h))) best = g;
          if (best) best.patience -= 0.15;
        }
        if (d.progress >= 1) { d.until = 0; this.toast('Ghodi caught'); }
      }
    }
    s.disasters = s.disasters.filter(d => d.until > s.t);
    if (!this.has('ghodi')) s.horse = null;
  }

  private updateChintu(dt: number) {
    const c = this.s.chintu; if (!c) return;
    c.turn -= dt; c.tick -= dt;
    if (c.turn <= 0) {
      const thief = c.tick <= 0 ? this.s.players.find(p => p.carry === 'mithai') : undefined;
      const tx = thief ? thief.x : 80 + this.rr() * (W - 160), ty = thief ? thief.y : 120 + this.rr() * (H - 200);
      const d = Math.hypot(tx - c.x, ty - c.y) || 1; c.vx = (tx - c.x) / d * 150; c.vy = (ty - c.y) / d * 150; c.turn = thief ? 0.4 : 1.5;
    }
    c.x = clamp(c.x + c.vx * dt, 20, W - 20); c.y = clamp(c.y + c.vy * dt, 70, H - 20);
    if (c.tick <= 0) for (const p of this.s.players) if (p.carry === 'mithai' && dist(p, c) < 26) {
      p.carry = null; p.cd = 0.5; c.tick = 6; c.turn = 0; this.toast(`Chintu stole ${p.name}'s mithai`); break;
    }
  }

  private interact(dt: number) {
    const s = this.s;
    for (const p of s.players) {
      p.cd = Math.max(0, p.cd - dt);
      if (p.drop) { p.drop = false; if (p.carry) { p.carry = null; p.cd = 0.8; } }
      if (!p.carry && p.cd <= 0) {
        for (const st of STATIONS) if (dist(p, st) < 42) {
          if (st.item === 'paneer' && this.has('paneer')) continue;
          p.carry = st.item; break;
        }
      }
      if (p.carry) for (const g of s.guests) {
        if (g.state === 'waiting' && g.want === p.carry && dist(p, g) < 38) {
          p.carry = null; p.cd = 0.3; s.served++; g.n++; g.want = null; g.state = 'content';
          s.izzat = Math.min(100, s.izzat + (g.kind === 'dadi' ? 4 : 1));
          g.timer = g.kind === 'mama' ? 3 + this.rr() * 3 : 5 + this.rr() * 5;
          if (g.kind === 'dadi') this.toast('Dadi gave her blessing. Izzat +4');
          if (g.kind === 'mama') { const spot = this.freeSpot(); if (spot >= 0) { g.spot = spot; g.tx = SPOTS[spot].x; g.ty = SPOTS[spot].y; } }
          if (g.kind === 'baraati' && g.n >= 2) { g.state = 'leaving'; g.happy = true; g.tx = GATE.x; g.ty = GATE.y; g.spot = -1 - g.id; }
          break;
        }
      }
    }
  }

  private finish(won: boolean) {
    const s = this.s; s.phase = 'over'; s.izzat = Math.max(0, Math.round(s.izzat));
    const inc = s.incidents;
    let headline: string;
    if (won) {
      const worst = inc.slice().sort((a, b) => b.weight - a.weight)[0];
      headline = `Shaadi saved with ${s.izzat} izzat. ` + (worst ? `Closest call: ${worst.text}.` : 'Not one relative went naraz.');
    } else headline = `Izzat ran out at ${clock(s.t)}. ${inc[inc.length - 1].text}.`;
    s.result = { won, headline, score: s.served * 10 + (won ? s.izzat * 5 : 0) };
  }
}
