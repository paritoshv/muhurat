import { W, H, dailySeed, clipName } from '../shared/sim';
import { draw, type View } from './render';
import { LocalRoom, RemoteRoom, type Room } from './net';
import { boardName, fetchBoard, guestName, postScore, renderBoard } from './board';
import { mountDevBar } from './fixtures';

declare const SOLO_ONLY: boolean; // no room server behind this build
declare const BOARD: boolean;     // a leaderboard API is served next to this build
declare const DEV: boolean;       // dev build: worst-case data toggle

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), canvas = $<HTMLCanvasElement>('lawn'), g = canvas.getContext('2d')!;
const menu = $('menu'), endCard = $('end'), pauseCard = $('paused'), msg = $('msg'), live = $('live');
const startBtn = $('start'), dropBtn = $('drop'), pauseBtn = $('pause'), stick = $('stick'), knob = stick.firstElementChild as HTMLElement;
const nameIn = $<HTMLInputElement>('name'), codeIn = $<HTMLInputElement>('code');
const touch = matchMedia('(pointer: coarse)').matches;

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } },
};
nameIn.value = store.get('muhurat-name') ?? '';
const say = (text: string) => { msg.textContent = text; msg.hidden = !text; };
if (DEV) { mountDevBar(); (window as unknown as { muhurat: () => Room | null }).muhurat = () => room; } // dev builds expose the room for scripted playtests

// Links carry a seed (#s-...) or a room (#r-ABCDE) in the hash.
const hash = location.hash.slice(1);
let seed = hash.startsWith('s-') ? hash.slice(2, 42) : dailySeed();
if (hash.startsWith('r-')) codeIn.value = hash.slice(2).toUpperCase();
$('seedline').textContent = hash.startsWith('s-') ? `Shaadi: ${seed}` : "Today's shaadi is the same for everyone.";
if (SOLO_ONLY) $('rooms').hidden = true;
$('howto').textContent += touch ? ' Drag anywhere to walk.' : ' Move with WASD or the arrow keys. Space drops what you hold.';

async function showMenuBoard() {
  if (!BOARD) return;
  const note = $('menunote');
  $('menuboard').hidden = false;
  const top = await fetchBoard(dailySeed());
  note.hidden = false;
  if (!top) { note.textContent = "Could not load today's board. Your run will still be posted when you finish."; return; }
  note.hidden = top.length > 0;
  note.textContent = "Nobody has finished today's shaadi yet. Be the first.";
  renderBoard($('menulist'), top, null, 5);
}
showMenuBoard();

let room: Room | null = null, shownResult = '', lastToast = '';
const solo = () => room instanceof LocalRoom ? room : null;
const playerName = () => { const typed = clipName(nameIn.value); store.set('muhurat-name', typed); return typed || guestName(); };
function enter(r: Room) { room = r; menu.hidden = true; say(''); }
function leave() {
  room?.close(); room = null; drag = null; stick.hidden = true;
  endCard.hidden = true; pauseCard.hidden = true; menu.hidden = false;
  if (location.hash.startsWith('#r-')) history.replaceState(null, '', location.pathname + location.search);
  showMenuBoard(); $('solo').focus({ preventScroll: true });
}
function pause() {
  const r = solo(); if (!r || r.state?.phase !== 'run' || r.paused) return;
  r.paused = true; pauseCard.hidden = false; drag = null; stick.hidden = true; $('resume').focus({ preventScroll: true });
}
function resume() { const r = solo(); if (r) r.paused = false; pauseCard.hidden = true; }

// Solo goes straight into the run; the first-serve guide on the lawn does the teaching.
$('solo').onclick = () => { enter(new LocalRoom(seed, playerName())); room!.start(); };
$('create').onclick = () => enter(new RemoteRoom({ t: 'create', name: playerName(), seed }));
$('join').onclick = () => {
  const code = codeIn.value.trim().toUpperCase();
  if (code.length !== 5) { say('Room codes are 5 characters. Check the code and try again.'); return; }
  enter(new RemoteRoom({ t: 'join', name: playerName(), room: code }));
};
startBtn.onclick = () => room?.start();
$('again').onclick = () => room?.start();
$('fresh').onclick = () => { seed = 'shaadi-' + Math.random().toString(36).slice(2, 8); room?.start(seed); };
$('tomenu').onclick = leave; $('quit').onclick = leave; $('resume').onclick = resume;
pauseBtn.onclick = () => solo() ? pause() : leave();
$('copy').onclick = async () => {
  const link = `${location.origin}${location.pathname}#s-${room?.state?.seed ?? seed}`;
  const out = $<HTMLInputElement>('link'); out.value = link;
  try { await navigator.clipboard.writeText(link); $('copy').textContent = 'Copied'; } catch { out.hidden = false; out.select(); }
};
// A phone call, a notification or another tab should not cost the player the shaadi.
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// Input: keys, or one finger dragged anywhere outside the buttons and cards.
const keys = new Set<string>();
let drag: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null, dropQueued = false;
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (solo()?.paused) resume(); else pause(); return; }
  if (e.target instanceof HTMLButtonElement && (e.code === 'Enter' || e.code === 'Space')) return; // the button handles its own press
  keys.add(e.code);
  if (e.code === 'Space') { dropQueued = true; e.preventDefault(); }
  if (e.code === 'Enter' && room?.state && room.state.phase !== 'run') room.start();
});
addEventListener('keyup', e => keys.delete(e.code));
stage.addEventListener('pointerdown', e => {
  if (drag || !room?.state || room.state.phase === 'over' || solo()?.paused) return; // a second finger does not steal the stick
  if ((e.target as HTMLElement).closest('button, input, .card')) return;
  const box = stage.getBoundingClientRect();
  drag = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  stick.style.left = `${e.clientX - box.left}px`; stick.style.top = `${e.clientY - box.top}px`; knob.style.transform = ''; stick.hidden = false;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.ox) / 44, dy = (e.clientY - drag.oy) / 44, m = Math.max(1, Math.hypot(dx, dy));
  drag.dx = dx / m; drag.dy = dy / m;
  knob.style.transform = `translate(${drag.dx * 44}px, ${drag.dy * 44}px)`;
});
const endDrag = () => { drag = null; stick.hidden = true; };
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(ev, endDrag);
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

// Big screens show the whole lawn. A phone keeps people a readable size, shows at
// least 400 lawn units across, uses the height it has, and follows the player.
const view: View = { z: 1, vw: W, vh: H, dpr: 1 };
function fit() {
  const box = canvas.parentElement!.getBoundingClientRect();
  const z = Math.max(Math.min(box.width / W, box.height / H), Math.min(Math.max(box.height / H, 0.8), box.width / 400, 1.1));
  const cw = Math.min(box.width, W * z), ch = Math.min(box.height, H * z), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  Object.assign(view, { z, vw: cw / z, vh: ch / z, dpr });
}
addEventListener('resize', fit); fit();

// A finished solo run of today's shaadi goes to the board; the server replays the inputs to score it.
async function postRun(r: LocalRoom, runSeed: string, served: number, score: number) {
  const box = $('endboard'), note = $('boardmsg'), list = $('endlist');
  box.hidden = false; list.replaceChildren();
  if (served === 0) { note.textContent = 'Serve at least one guest to get on the board.'; return; }
  note.textContent = 'Posting your run to the board…';
  const me = boardName(playerName());
  const res = await postScore(runSeed, me, r.log, score);
  if (!res) { note.textContent = 'Could not reach the board. Your run was not posted; play again to retry.'; return; }
  if ('error' in res) { note.textContent = `Not posted. ${res.error}`; return; }
  note.textContent = `You are #${res.rank} today, as ${me}.`;
  renderBoard(list, res.top, me, 20);
}

function frame(ms: number) {
  const now = ms / 1000;
  sendInput(now);
  if (room?.error) { const text = room.error; leave(); say(text); }
  const s = room?.state;
  if (room && s) {
    draw(g, s, room.myId, now, room.code, view, touch);
    if (room.code && location.hash !== '#r-' + room.code) history.replaceState(null, '', '#r-' + room.code);
    const me = s.players.find(p => p.id === room!.myId), running = s.phase === 'run';
    startBtn.hidden = s.phase !== 'lobby';
    dropBtn.hidden = !(running && me?.carry); // only offered while there is something to drop
    pauseBtn.hidden = !running || !!solo()?.paused; pauseBtn.textContent = solo() ? 'Pause' : 'Leave room';
    // Screen readers hear what sighted players read off the lawn.
    const newest = s.toasts[s.toasts.length - 1];
    if (newest && newest.text + newest.t !== lastToast) { lastToast = newest.text + newest.t; live.textContent = newest.text; }
    const key = s.result ? s.result.headline + s.seed + s.served : '';
    if (s.phase === 'over' && s.result && shownResult !== key) {
      shownResult = key;
      $('verdict').textContent = s.result.won ? 'Shaadi ho gayi!' : 'Naak kat gayi';
      endCard.dataset.won = String(s.result.won);
      $('headline').textContent = s.result.headline;
      $('tip').textContent = s.result.tip; $('tip').hidden = !s.result.tip;
      $('score').textContent = `Score ${s.result.score.toLocaleString('en-IN')}  ·  ${s.served} served`;
      $('copy').textContent = 'Copy link'; $<HTMLInputElement>('link').hidden = true;
      $('endboard').hidden = true;
      const r = solo();
      if (BOARD && r && s.seed === dailySeed()) postRun(r, s.seed, s.served, s.result.score);
      endCard.hidden = false; $('again').focus({ preventScroll: true }); // keyboard and screen-reader users land on the next action
    }
    if (s.phase !== 'over') shownResult = '';
    endCard.hidden = s.phase !== 'over';
  } else {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#15493e'; g.fillRect(0, 0, canvas.width, canvas.height);
    startBtn.hidden = true; dropBtn.hidden = true; pauseBtn.hidden = true;
    if (room) { g.fillStyle = '#fff3d6'; g.font = `600 ${18 * view.dpr}px Mukta, system-ui, sans-serif`; g.textAlign = 'center'; g.fillText('Joining the room…', canvas.width / 2, canvas.height / 2); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
