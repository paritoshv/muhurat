// Dev-only worst-case data for the leaderboard UI (the break-ui toggle).
// Chosen by ?data=demo|worst|empty|one|many|error. Never part of a production build:
// every caller sits behind `if (DEV)`, which the bundler removes.
import type { Entry } from './board';

const row = (name: string, score: number): Entry => ({ name, score, won: true, served: 40, izzat: 60 });

// Built on demand so nothing here survives tree-shaking in a production bundle.
const sets = (): Record<string, Entry[] | null> => ({
  demo: [row('DADI-KI-JAAN', 1480), row('PINKY', 1210), row('HALWAI-BHAI', 990), row('GUDDU', 640), row('SHARMA-JI', 410), row('BITTU', 120)],
  // The widest and narrowest names the server accepts, ties, and a score far above today's ceiling.
  worst: [row('WWWWWWWWWWWW', 1234560), row('WISNIEWSKA-K', 99990), row('ABC', 99990), row('O-O-O-O-O-O', 2490), row('000000000000', 2490), row('MMMMMMMMMMMM', 10), row('III', 10)],
  empty: [],
  one: [row('PINKY', 10)],
  many: Array.from({ length: 20 }, (_, i) => row(i % 3 ? `PHOOLWALA-${10 + i}` : `GUEST-${i}`, 2500 - i * 120)),
  error: null, // the board cannot be reached
});

/** undefined: no fixture chosen, use the real API. null: simulate an unreachable board. */
export function devBoard(): Entry[] | null | undefined {
  const pick = new URLSearchParams(location.search).get('data');
  const all = sets(); return pick && pick in all ? all[pick] : undefined;
}

/** A plain segmented control at the bottom of the page. It is chrome for the test, not part of the design. */
export function mountDevBar() {
  const bar = document.createElement('div'), now = new URLSearchParams(location.search).get('data') ?? 'api';
  bar.style.cssText = 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:9;display:flex;gap:2px;padding:3px;border-radius:8px;background:#d8d8d8;font:12px system-ui,sans-serif';
  for (const key of ['api', ...Object.keys(sets())]) {
    const b = document.createElement('a');
    b.textContent = key; b.href = key === 'api' ? location.pathname + location.hash : `?data=${key}${location.hash}`;
    b.style.cssText = `padding:4px 8px;border-radius:6px;color:#222;text-decoration:none;background:${key === now ? '#fff' : 'transparent'}`;
    bar.append(b);
  }
  document.body.append(bar);
}
