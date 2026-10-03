// Daily leaderboard client. Every call fails soft: a build with no board
// (the room server, a local file) just shows nothing.
import type { InputLog } from '../shared/replay';

export interface Entry { name: string; score: number; won: boolean; served: number; izzat: number }
export type Posted = { score: number; rank: number; top: Entry[] } | { error: string };

export const boardName = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12);

export async function fetchBoard(seed: string): Promise<Entry[] | null> {
  try {
    const res = await fetch(`/api/board?seed=${encodeURIComponent(seed)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.top) ? body.top : null;
  } catch { return null; }
}

export async function postScore(seed: string, name: string, log: InputLog): Promise<Posted | null> {
  try {
    const res = await fetch('/api/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed, name: boardName(name), log }) });
    const body = await res.json();
    if (!res.ok) return { error: typeof body.error === 'string' ? body.error : 'The board is not reachable right now.' };
    return body;
  } catch { return null; }
}

export function renderBoard(list: HTMLElement, top: Entry[], me: string | null, limit: number) {
  list.replaceChildren();
  top.slice(0, limit).forEach((e, i) => {
    const li = document.createElement('li');
    if (e.name === me) li.className = 'me';
    const cell = (cls: string, text: string) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
    li.append(cell('rank', String(i + 1)), cell('who', e.name), cell('pts', String(e.score)));
    list.append(li);
  });
}
