import { W, H, dailySeed } from '../shared/sim';
import { draw } from './render';
import { LocalRoom, RemoteRoom, type Room } from './net';

declare const SOLO_ONLY: boolean; // true in the single-file build, which has no server

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('lawn'), g = canvas.getContext('2d')!;
const menu = $('menu'), endCard = $('end'), startBtn = $('start'), dropBtn = $('drop'), msg = $('msg');
const nameIn = $<HTMLInputElement>('name'), codeIn = $<HTMLInputElement>('code');

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } },
};
nameIn.value = store.get('muhurat-name') ?? '';

// Links carry a seed (#s-...) or a room (#r-ABCDE) in the hash.
const hash = location.hash.slice(1);
let seed = hash.startsWith('s-') ? hash.slice(2) : dailySeed();
if (hash.startsWith('r-')) codeIn.value = hash.slice(2).toUpperCase();
$('seedline').textContent = hash.startsWith('s-') ? `Shaadi: ${seed}` : "Today's shaadi is the same for everyone.";
if (SOLO_ONLY) $('rooms').hidden = true;

let room: Room | null = null, shownResult: unknown = null;
const playerName = () => { const n = nameIn.value.trim().slice(0, 12) || 'Bhaiya'; store.set('muhurat-name', n); return n; };
function enter(r: Room) { room = r; menu.hidden = true; msg.textContent = ''; }

$('solo').onclick = () => enter(new LocalRoom(seed, playerName()));
$('create').onclick = () => enter(new RemoteRoom({ t: 'create', name: playerName(), seed }));
$('join').onclick = () => {
  const code = codeIn.value.trim().toUpperCase();
  if (code.length !== 5) { msg.textContent = 'Room codes are 5 characters.'; return; }
  enter(new RemoteRoom({ t: 'join', name: playerName(), room: code }));
};
startBtn.onclick = () => room?.start();
$('again').onclick = () => room?.start();
$('fresh').onclick = () => { seed = 'shaadi-' + Math.random().toString(36).slice(2, 8); room?.start(seed); };
$('copy').onclick = async () => {
  const link = `${location.origin}${location.pathname}#s-${room?.state?.seed ?? seed}`;
  const out = $<HTMLInputElement>('link'); out.value = link; out.hidden = false;
  try { await navigator.clipboard.writeText(link); $('copy').textContent = 'Link copied'; } catch { out.select(); }
};

// Input: keys, or drag anywhere on the lawn.
const keys = new Set<string>();
let drag: { x: number; y: number; dx: number; dy: number } | null = null, dropQueued = false;
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  keys.add(e.code);
  if (e.code === 'Space') { dropQueued = true; e.preventDefault(); }
  if (e.code === 'Enter' && room?.state && room.state.phase !== 'run') room.start();
});
addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (drag) { drag.dx = Math.max(-1, Math.min(1, (e.clientX - drag.x) / 40)); drag.dy = Math.max(-1, Math.min(1, (e.clientY - drag.y) / 40)); } });
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
dropBtn.onclick = () => { dropQueued = true; };

let lastSent = '', lastSendAt = 0;
function sendInput(now: number) {
  if (!room) return;
  let dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (drag) { dx = drag.dx; dy = drag.dy; }
  const sig = `${dx.toFixed(2)},${dy.toFixed(2)}`;
  if (sig !== lastSent || dropQueued || now - lastSendAt > 0.25) { room.input(dx, dy, dropQueued); lastSent = sig; lastSendAt = now; dropQueued = false; }
}

function fit() {
  const box = $('stage').getBoundingClientRect(), k = Math.min(box.width / W, box.height / H), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.style.width = `${W * k}px`; canvas.style.height = `${H * k}px`;
  canvas.width = Math.round(W * k * dpr); canvas.height = Math.round(H * k * dpr);
  g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
addEventListener('resize', fit); fit();

function frame(ms: number) {
  const now = ms / 1000;
  sendInput(now);
  if (room?.error) { msg.textContent = room.error; room.close(); room = null; menu.hidden = false; endCard.hidden = true; }
  const s = room?.state;
  if (room && s) {
    draw(g, s, room.myId, now, room.code);
    if (room.code && location.hash !== '#r-' + room.code) history.replaceState(null, '', '#r-' + room.code);
    startBtn.hidden = s.phase !== 'lobby'; dropBtn.hidden = s.phase !== 'run';
    if (s.phase === 'over' && s.result && shownResult !== s.result.headline + s.t) {
      shownResult = s.result.headline + s.t;
      $('verdict').textContent = s.result.won ? 'Shaadi ho gayi!' : 'Naak kat gayi';
      endCard.dataset.won = String(s.result.won);
      $('headline').textContent = s.result.headline;
      $('score').textContent = `Score ${s.result.score}  ·  ${s.served} served  ·  ${s.seed}`;
      $('copy').textContent = 'Copy link to this shaadi'; $<HTMLInputElement>('link').hidden = true;
    }
    endCard.hidden = s.phase !== 'over';
  } else { g.fillStyle = '#15493e'; g.fillRect(0, 0, W, H); startBtn.hidden = true; dropBtn.hidden = true; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
