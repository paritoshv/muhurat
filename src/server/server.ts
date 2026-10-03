// Room server: serves the built client and runs one simulation per room code.
// Kept in one process on purpose; each Room maps cleanly onto a Durable Object later.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { Sim, dailySeed } from '../shared/sim';

const PORT = Number(process.env.PORT ?? 8787), DIST = path.resolve('dist');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = http.createServer(async (req, res) => {
  const file = (req.url ?? '/').split('?')[0] === '/' ? 'index.html' : path.basename(req.url!.split('?')[0]);
  try { const body = await readFile(path.join(DIST, file)); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});

interface Room { sim: Sim; clients: Map<WebSocket, string>; tick: number }
const rooms = new Map<string, Room>();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, so a code can be read aloud
const newCode = (): string => { let c: string; do { c = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join(''); } while (rooms.has(c)); return c; };

function openRoom(code: string, seed: string): Room {
  const room: Room = { sim: new Sim(seed), clients: new Map(), tick: 0 };
  const timer = setInterval(() => {
    if (!room.clients.size) { clearInterval(timer); rooms.delete(code); return; }
    room.sim.step(1 / 30);
    if (++room.tick % 2 === 0) { const msg = JSON.stringify({ t: 'state', s: room.sim.s }); for (const ws of room.clients.keys()) if (ws.readyState === 1) ws.send(msg); }
  }, 1000 / 30);
  rooms.set(code, room); return room;
}

let nextId = 1;
new WebSocketServer({ server, path: '/ws', maxPayload: 2048 }).on('connection', ws => {
  let room: Room | null = null, id = '';
  const fail = (text: string) => { ws.send(JSON.stringify({ t: 'error', text })); ws.close(); };
  ws.on('message', raw => {
    let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
    if (!room) {
      const name = String(m.name ?? '').slice(0, 12);
      let code: string;
      if (m.t === 'create') { code = newCode(); room = openRoom(code, String(m.seed ?? '').slice(0, 40) || dailySeed()); }
      else if (m.t === 'join') { code = String(m.room ?? '').toUpperCase(); const r = rooms.get(code); if (!r) return fail(`No room with code ${code}.`); room = r; }
      else return;
      id = 'p' + nextId++;
      if (!room.sim.addPlayer(id, name)) { room = null; return fail('That room is full (6 players).'); }
      room.clients.set(ws, id);
      ws.send(JSON.stringify({ t: 'joined', id, room: code }));
    } else if (m.t === 'input') room.sim.setInput(id, Number(m.dx), Number(m.dy), !!m.drop);
    else if (m.t === 'start' && room.sim.s.phase !== 'run') room.sim.start(typeof m.seed === 'string' ? m.seed.slice(0, 40) : undefined);
  });
  ws.on('close', () => { if (room) { room.clients.delete(ws); room.sim.removePlayer(id); } });
});

server.listen(PORT, () => console.log(`Muhurat is on http://localhost:${PORT}`));
