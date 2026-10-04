import { getDeployStore, getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { checkName } from './moderation'
import { replay, validLog } from '../../../src/shared/replay'
import { dailySeed } from '../../../src/shared/sim'

/**
 * Daily leaderboard for solo runs.
 *
 *   GET  /api/board?seed=daily-YYYY-MM-DD  → { seed, top }
 *   POST /api/score { seed, name, log }    → { score, rank, top }
 *
 * Unlike Aura Farm's board, a score here is proved rather than bounded. The
 * sim is deterministic, so the client sends its input log and this function
 * replays the run to compute the score itself. What that does not stop is a
 * script that plays well: a tool-assisted run is still a valid run.
 */

export interface Entry { name: string; score: number; won: boolean; served: number; izzat: number; at: number }
export interface KV {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown): Promise<void>
}

const SEED = /^daily-\d{4}-\d{2}-\d{2}$/
const TOP_SIZE = 100, RETURNED = 20, MAX_BODY = 400_000
const RATE_LIMIT = 20, RATE_WINDOW_MS = 15 * 60 * 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function overRateLimit(s: KV, ip: string, now: number): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  const key = `rl/${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)}`
  const cur = (await s.get(key, { type: 'json' })) as { count: number; start: number } | null
  if (!cur || now - cur.start > RATE_WINDOW_MS) { await s.setJSON(key, { count: 1, start: now }); return false }
  if (cur.count >= RATE_LIMIT) return true
  await s.setJSON(key, { count: cur.count + 1, start: cur.start }); return false
}

async function readTop(s: KV, seed: string): Promise<Entry[]> {
  const top = await s.get(`top/${seed}`, { type: 'json' })
  return Array.isArray(top) ? (top as Entry[]) : []
}

/** One row per name, best score kept. Blobs are last-write-wins, so every accepted run is also appended under log/. */
async function insert(s: KV, seed: string, entry: Entry): Promise<{ rank: number; top: Entry[] }> {
  await s.setJSON(`log/${seed}/${entry.at}-${crypto.randomUUID()}`, entry)
  const top = await readTop(s, seed)
  const i = top.findIndex(e => e.name === entry.name)
  if (i !== -1) { if (top[i].score >= entry.score) return { rank: i + 1, top }; top.splice(i, 1) }
  top.push(entry)
  top.sort((a, b) => b.score - a.score || a.at - b.at)
  const trimmed = top.slice(0, TOP_SIZE)
  await s.setJSON(`top/${seed}`, trimmed)
  return { rank: trimmed.indexOf(entry) + 1, top: trimmed }
}

export async function handle(req: Request, s: KV, ip: string, now = Date.now()): Promise<Response> {
  const url = new URL(req.url)

  if (url.pathname === '/api/board') {
    const seed = url.searchParams.get('seed') ?? dailySeed(new Date(now))
    if (!SEED.test(seed)) return json({ error: 'Boards exist only for daily shaadis.' }, 400)
    return json({ seed, top: (await readTop(s, seed)).slice(0, RETURNED) })
  }

  if (url.pathname !== '/api/score') return json({ error: 'Not found.' }, 404)
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const raw = await req.text()
  if (raw.length > MAX_BODY) return json({ error: 'That run is too large to submit.' }, 413)
  let body: { seed?: unknown; name?: unknown; log?: unknown }
  try { body = JSON.parse(raw) } catch { return json({ error: 'Malformed body.' }, 400) }

  if (await overRateLimit(s, ip, now)) return json({ error: 'Too many runs submitted. Try again in a few minutes.' }, 429)

  // Today's seed, or yesterday's for a run that crossed midnight UTC.
  const allowed = [dailySeed(new Date(now)), dailySeed(new Date(now - 86_400_000))]
  if (typeof body.seed !== 'string' || !allowed.includes(body.seed)) return json({ error: "Only today's shaadi counts for the board." }, 400)

  const name = checkName(body.name)
  if (!name.ok) return json({ error: name.reason }, 422)
  if (!validLog(body.log)) return json({ error: 'That run could not be read.' }, 400)

  const end = replay(body.seed, body.log)
  if (end.phase !== 'over' || !end.result) return json({ error: 'That run did not finish.' }, 400)
  // An abandoned tab is not a run. Nothing reaches the board until someone has been served.
  if (end.served === 0) return json({ error: 'Serve at least one guest to get on the board.' }, 422)

  const entry: Entry = { name: name.name, score: end.result.score, won: end.result.won, served: end.served, izzat: end.izzat, at: now }
  const { rank, top } = await insert(s, body.seed, entry)
  return json({ score: entry.score, rank, top: top.slice(0, RETURNED) })
}

export default async (req: Request, context: Context) => {
  // Production data lives in the global store; previews and branch deploys get their own.
  const production = (globalThis as any).Netlify?.context?.deploy?.context === 'production'
  const opts = { name: 'muhurat-board', consistency: 'strong' as const }
  const store = production ? getStore(opts) : getDeployStore(opts)
  return handle(req, store as unknown as KV, context.ip || 'unknown')
}

export const config: Config = { path: ['/api/board', '/api/score'] }
