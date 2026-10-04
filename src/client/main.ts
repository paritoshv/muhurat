import { W, H, dailySeed } from '../shared/sim';
import { draw, type Joy, type View } from './render';
import { LocalRoom, RemoteRoom, type Room } from './net';
import { boardName, fetchBoard, postScore, renderBoard } from './board';

declare const SOLO_ONLY: boolean; // no room server behind this build
declare const BOARD: boolean;     // a leaderboard API is served next to this build

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('lawn'), g = canvas.getContext('2d')!;
const menu = $('menu'), endCard = $('end'), startBtn = $('start'), dropBtn = $('drop'), msg = $('msg');
const nameIn = $<HTMLInputElement>('name'), codeIn = $<HTMLInputElement>('code');

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } },
};
nameIn.value = store.get('muhurat-name') ?? '';
const say = (text: string) => { msg.textContent = text; msg.hidden = !text; };

// Links carry a seed (#s-...) or a room (#r-ABCDE) in the hash.
const hash = location.hash.slice(1);
let seed = hash.startsWith('s-') ? hash.slice(2) : dailySeed();
if (hash.startsWith('r-')) codeIn.value = hash.slice(2).toUpperCase();
$('seedline').textContent = hash.startsWith('s-') ? `Shaadi: ${seed}` : "Today's shaadi is the same for everyone.";
if (SOLO_ONLY) $('rooms').hidden = true;
if (matchMedia('(pointer: coarse)').matches) $('howto').textContent += ' Drag anywhere to walk.';
else $('howto').textContent += ' Move with WASD or the arrow keys. Space drops what you hold.';

async function showMenuBoard() {
  if (!BOARD) return;
  const note = $('menunote');
  $('menuboard').hidden = false;
  const top = await fetchBoard(dailySeed());
  if (!top) { note.textContent = "Could not load today's board. Your run will still be posted when you finish."; return; }
  note.hidden = top.length > 0;
  note.textContent = "Nobody has finished today's shaadi yet. Be the first.";
  renderBoard($('menulist'), top, null, 5);
}
showMenuBoard();

let room: Room | null = null, shownResult = '';
const playerName = () => { const n = nameIn.value.trim().slice(0, 12) || 'Bhaiya'; store.set('muhurat-name', n); return n; };
function enter(r: Room) { room = r; menu.hidden = true; say(''); }

$('solo').onclick = () => enter(new LocalRoom(seed, playerName()));
$('create').onclick = () => enter(new RemoteRoom({ t: 'create', name: playerName(), seed }));
$('join').onclick = () => {
  const code = codeIn.value.trim().toUpperCase();
  if (code.length !== 5) { say('Room codes are 5 characters. Check the code and try again.'); return; }
  enter(new RemoteRoom({ t: 'join', name: playerName(), room: code }));
};
startBtn.onclick = () => room?.start();
$('again').onclick = () => room?.start();
$('fresh').onclick = () => { seed = 'shaadi-' + Math.random().toString(36).slice(2, 8); room?.start(seed); };
$('copy').onclick = async () => {
  const link = `${location.origin}${location.pathname}#s-${room?.state?.seed ?? seed}`;
  const out = $<HTMLInputElement>('link'); out.value = link;
  try { await navigator.clipboard.writeText(link); $('copy').textContent = 'Link copied'; } catch { out.hidden = false; out.select(); }
};

// Input: keys, or one finger dragged anywhere on the lawn.
const keys = new Set<string>();
let drag: (Joy & { id: number; ox: number; oy: number }) | null = null, dropQueued = false;
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.target instanceof HTMLButtonElement && (e.code === 'Enter' || e.code === 'Space')) return; // the button handles its own press
  keys.add(e.code);
  if (e.code === 'Space') { dropQueued = true; e.preventDefault(); }
  if (e.code === 'Enter' && room?.state && room.state.phase !== 'run') room.start();
});
addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('pointerdown', e => {
  if (drag) return; // a second finger does not steal the stick
  const r = canvas.getBoundingClientRect();
  drag = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX - r.left, y: e.clientY - r.top, dx: 0, dy: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.ox) / 44, dy = (e.clientY - drag.oy) / 44, m = Math.max(1, Math.hypot(dx, dy));
  drag.dx = dx / m; drag.dy = dy / m;
});
const endDrag = () => { drag = null; };
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, endDrag);
addEventListener('blur', () => { endDrag(); keys.clear(); });
dropBtn.addEventListener('pointerdown', () => { dropQueued = true; });

let lastSent = '', lastSendAt = 0;
function sendInput(now: number) {
  if (!room) return;
  let dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (drag) { dx = drag.dx; dy = drag.dy; }
  const sig = `${dx.toFixed(2)},${dy.toFixed(2)}`;
  if (sig !== lastSent || dropQueued || now - lastSendAt > 0.25) { room.input(dx, dy, dropQueued); lastSent = sig; lastSendAt = now; dropQueued = false; }
}

// Big screens show the whole lawn. Small ones keep people a readable size and follow the player.
const view: View = { z: 1, vw: W, vh: H, dpr: 1 };
function fit() {
  const box = canvas.parentElement!.getBoundingClientRect();
  const z = Math.max(Math.min(box.width / W, box.height / H), 0.8);
  const cw = Math.min(box.width, W * z), ch = Math.min(box.height, H * z), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  Object.assign(view, { z, vw: cw / z, vh: ch / z, dpr });
}
addEventListener('resize', fit); fit();

// A finished solo run of today's shaadi goes to the board; the server replays the inputs to score it.
async function postRun(r: LocalRoom, runSeed: string) {
  const box = $('endboard'), note = $('boardmsg'), list = $('endlist');
  box.hidden = false; list.replaceChildren(); note.textContent = 'Posting your run to the board…';
  const me = boardName(playerName());
  const res = await postScore(runSeed, me, r.log);
  if (!res) { note.textContent = 'Could not reach the board. Your run was not posted; play again to retry.'; return; }
  if ('error' in res) { note.textContent = `Not posted. ${res.error}`; return; }
  note.textContent = `You are #${res.rank} today with ${res.score}.`;
  renderBoard(list, res.top, me, 20);
  list.querySelector('.me')?.scrollIntoView({ block: 'nearest' });
}

function frame(ms: number) {
  const now = ms / 1000;
  sendInput(now);
  if (room?.error) { say(room.error); room.close(); room = null; menu.hidden = false; endCard.hidden = true; }
  const s = room?.state;
  if (room && s) {
    draw(g, s, room.myId, now, room.code, view, drag && s.phase !== 'over' ? drag : null);
    if (room.code && location.hash !== '#r-' + room.code) history.replaceState(null, '', '#r-' + room.code);
    startBtn.hidden = s.phase !== 'lobby'; dropBtn.hidden = s.phase !== 'run';
    const key = s.result ? s.result.headline + s.seed + s.served : '';
    if (s.phase === 'over' && s.result && shownResult !== key) {
      shownResult = key;
      $('verdict').textContent = s.result.won ? 'Shaadi ho gayi!' : 'Naak kat gayi';
      endCard.dataset.won = String(s.result.won);
      $('headline').textContent = s.result.headline;
      $('score').textContent = `Score ${s.result.score}  ·  ${s.served} served`;
      $('copy').textContent = 'Copy link to this shaadi'; $<HTMLInputElement>('link').hidden = true;
      $('endboard').hidden = true;
      if (BOARD && room instanceof LocalRoom && s.seed === dailySeed()) postRun(room, s.seed);
      endCard.hidden = false; $('again').focus({ preventScroll: true }); // keyboard and screen-reader users land on the next action
    }
    if (s.phase !== 'over') shownResult = '';
    endCard.hidden = s.phase !== 'over';
  } else {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#15493e'; g.fillRect(0, 0, canvas.width, canvas.height); startBtn.hidden = true; dropBtn.hidden = true;
    if (room) { g.fillStyle = '#fff3d6'; g.font = `600 ${18 * view.dpr}px Mukta, system-ui, sans-serif`; g.textAlign = 'center'; g.fillText('Joining the room…', canvas.width / 2, canvas.height / 2); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
