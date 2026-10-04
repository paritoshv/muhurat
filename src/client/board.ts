// Daily leaderboard client. Every call fails soft: a build with no board
// (the room server, a local file) just shows nothing.
import type { InputLog } from '../shared/replay';
import { devBoard } from './fixtures';

declare const DEV: boolean;

export interface Entry { name: string; score: number; won: boolean; served: number; izzat: number }
export type Posted = { score: number; rank: number; top: Entry[] } | { error: string };

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } },
};

/** A wedding-crew name for players who type nothing, so strangers do not all share one row on the board. */
export function guestName(): string {
  let name = store.get('muhurat-guest');
  if (!name) {
    const crew = ['HALWAI', 'DJ-BABU', 'TENTWALA', 'PHOOLWALA', 'BANDWALA', 'CHACHA', 'MAUSI', 'JIJU'];
    name = `${crew[Math.floor(Math.random() * crew.length)]}-${10 + Math.floor(Math.random() * 90)}`;
    store.set('muhurat-guest', name);
  }
  return name;
}

/** The board takes A-Z, 0-9 and hyphens. A name in another script, or one too short, posts under the crew name instead. */
export function boardName(raw: string): string {
  const clean = raw.normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12).replace(/-+$/, '');
  return clean.length >= 3 ? clean : guestName();
}

export async function fetchBoard(seed: string): Promise<Entry[] | null> {
  if (DEV) { const f = devBoard(); if (f !== undefined) return f; }
  try {
    const res = await fetch(`/api/board?seed=${encodeURIComponent(seed)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.top) ? body.top : null;
  } catch { return null; }
}

export async function postScore(seed: string, name: string, log: InputLog, devScore = 0): Promise<Posted | null> {
  if (DEV) {
    const f = devBoard();
    if (f === null) return null;
    if (f) { const top = [...f, { name, score: devScore, won: false, served: 1, izzat: 0 }].sort((a, b) => b.score - a.score); return { score: devScore, rank: top.findIndex(e => e.name === name) + 1, top }; }
  }
  try {
    const res = await fetch('/api/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed, name, log }) });
    const body = await res.json();
    if (!res.ok) return { error: typeof body.error === 'string' ? body.error : 'The board is not reachable right now.' };
    return body;
  } catch { return null; }
}

/**
 * Draws board rows. With `me`, it shows the podium and then the rows around the
 * player, so their place is visible without a scrolling list.
 */
export function renderBoard(list: HTMLElement, top: Entry[], me: string | null, limit: number) {
  list.replaceChildren();
  const mine = me ? top.findIndex(e => e.name === me) : -1;
  const picks = new Set<number>();
  if (mine < 0) for (let i = 0; i < Math.min(limit, top.length); i++) picks.add(i);
  else { for (let i = 0; i < Math.min(3, top.length); i++) picks.add(i); for (const i of [mine - 1, mine, mine + 1]) if (i >= 0 && i < top.length) picks.add(i); }
  let prev = -1, shownCount = 0;
  for (const i of [...picks].sort((a, b) => a - b)) {
    if (prev >= 0 && i > prev + 1) { const gap = document.createElement('li'); gap.className = 'gap'; gap.setAttribute('aria-hidden', 'true'); gap.textContent = '⋯'; list.append(gap); }
    const e = top[i], li = document.createElement('li');
    if (i === mine) li.className = 'me';
    const cell = (cls: string, text: string) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
    const who = cell('who', e.name); who.title = e.name; // the full name stays readable if the row has to truncate it
    li.append(cell('rank', String(i + 1)), who, cell('pts', e.score.toLocaleString('en-IN')));
    li.style.animationDelay = `${Math.min(shownCount++, 8) * 50}ms`; // 50ms stagger, capped so a long board never feels slow
    list.append(li); prev = i;
  }
}
