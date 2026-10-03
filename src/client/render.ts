// Canvas renderer. Everything is drawn as simple vector shapes so it looks the
// same on every device (no emoji, no image assets).
import { W, H, STATIONS, GEN, GATE, MANDAP, SPOTS, clock, type State, type Item, type Kind, type DKind } from '../shared/sim';

const C = { night: '#0b1f1c', lawn: '#15493e', lawn2: '#134238', marigold: '#f6a821', rani: '#e0347a', cream: '#fff3d6', ink: '#0a1614', danger: '#e5483b', good: '#58c777', skin: '#c98d5e' };
export const PLAYER_COLORS = ['#f6a821', '#4cc3ff', '#e0347a', '#8ee06b', '#c59bff', '#ff8a5c'];
const DISPLAY = '"Yatra One", "Trebuchet MS", sans-serif', BODY = 'Mukta, "Segoe UI", system-ui, sans-serif';
const BANNERS: Record<DKind, string> = {
  bijli: 'BIJLI GAYI  ·  crank the generator', baarish: 'BAARISH  ·  everyone is slow', ghodi: 'GHODI BHAAG GAYI  ·  corner her', paneer: 'PANEER KHATAM  ·  halwai is restocking',
};

const shown = new Map<string, { x: number; y: number }>();
let lastNow = 0;
function ease(key: string, x: number, y: number, dt: number) {
  let p = shown.get(key);
  if (!p || Math.hypot(p.x - x, p.y - y) > 200) { p = { x, y }; shown.set(key, p); }
  const k = Math.min(1, dt * 14); p.x += (x - p.x) * k; p.y += (y - p.y) * k; return p;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'center') {
  g.font = font; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(s, x, y);
}

export function drawItem(g: CanvasRenderingContext2D, item: Item, x: number, y: number, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  if (item === 'chai') {
    g.fillStyle = '#b5651d'; g.beginPath(); g.moveTo(-6, -7); g.lineTo(6, -7); g.lineTo(4, 8); g.lineTo(-4, 8); g.closePath(); g.fill();
    g.fillStyle = '#e9c9a0'; g.fillRect(-6, -8, 12, 3);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, -11); g.quadraticCurveTo(1, -14, -1, -17); g.stroke();
  } else if (item === 'paneer') {
    g.fillStyle = '#d9d9d9'; g.beginPath(); g.arc(0, -1, 9, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = '#e8702a'; g.beginPath(); g.ellipse(0, -1, 9, 3.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff8e7'; g.fillRect(-5, -4, 4, 4); g.fillRect(1, -3, 4, 4);
  } else if (item === 'mithai') {
    g.fillStyle = '#f4b400'; g.beginPath(); g.arc(-4, 2, 5.5, 0, 7); g.arc(4, 2, 5.5, 0, 7); g.fill();
    g.beginPath(); g.arc(0, -5, 5.5, 0, 7); g.fill();
    g.fillStyle = '#c8e6c9'; g.fillRect(-1, -7, 2, 2); g.fillRect(-5, 1, 2, 2); g.fillRect(3, 1, 2, 2);
  } else {
    g.fillStyle = '#d63a3a'; rr(g, -6, -10, 12, 10, 2); g.fill(); g.fillRect(-7, 0, 14, 3);
    g.fillRect(-7, 3, 2.5, 7); g.fillRect(4.5, 3, 2.5, 7);
  }
  g.restore();
}

const BODY_COL: Record<Kind, string> = { fufaji: '#8d99a6', bua: '#d6457f', mama: '#7b5cc9', dadi: '#f1e3c2', pandit: '#f08a24', baraati: '#3f7fd1' };

function person(g: CanvasRenderingContext2D, x: number, y: number, body: string, kind: Kind | 'player' | 'chintu', now: number, small = false) {
  const k = small ? 0.72 : 1;
  g.save(); g.translate(x, y); g.scale(k, k);
  if (kind === 'mama') g.rotate(Math.sin(now * 2.2) * 0.16);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 15, 14, 5, 0, 0, 7); g.fill();
  g.fillStyle = body; g.beginPath(); g.moveTo(-13, 14); g.quadraticCurveTo(-14, -8, 0, -8); g.quadraticCurveTo(14, -8, 13, 14); g.closePath(); g.fill();
  if (kind === 'player') { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-6, 0, 12, 12); }
  g.fillStyle = C.skin; g.beginPath(); g.arc(0, -15, 9, 0, 7); g.fill();
  g.fillStyle = C.ink;
  if (kind === 'fufaji') { g.fillRect(-9, -24, 18, 5); g.beginPath(); g.ellipse(-4, -11, 5, 2.2, 0.3, 0, 7); g.ellipse(4, -11, 5, 2.2, -0.3, 0, 7); g.fill(); }
  else if (kind === 'bua') { g.beginPath(); g.arc(0, -19, 9, Math.PI, 0); g.fill(); g.beginPath(); g.arc(0, -27, 5, 0, 7); g.fill(); g.fillStyle = C.danger; g.beginPath(); g.arc(0, -17, 1.6, 0, 7); g.fill(); }
  else if (kind === 'dadi') { g.fillStyle = '#eeeeee'; g.beginPath(); g.arc(0, -19, 9, Math.PI, 0); g.fill(); g.beginPath(); g.arc(0, -26, 4, 0, 7); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(-6, -17, 5, 3.5); g.strokeRect(1, -17, 5, 3.5); }
  else if (kind === 'pandit') { g.fillStyle = C.danger; g.fillRect(-1, -22, 2, 6); g.fillStyle = '#fff'; g.fillRect(-6, -8, 12, 2); }
  else if (kind === 'baraati') { g.fillStyle = C.rani; g.beginPath(); g.arc(0, -18, 10, Math.PI, 0); g.fill(); g.fillRect(6, -19, 3, 9); }
  else if (kind === 'mama') { g.beginPath(); g.arc(0, -19, 9, Math.PI * 1.1, -0.1); g.fill(); g.fillStyle = '#3fa66b'; g.fillRect(11, -4, 4, 11); }
  else if (kind === 'chintu') { g.fillStyle = C.danger; g.beginPath(); g.arc(0, -18, 9.5, Math.PI, 0); g.fill(); g.fillRect(0, -19, 12, 3); }
  else { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-9, -19); g.lineTo(0, -28); g.lineTo(9, -19); g.closePath(); g.fill(); }
  g.restore();
}

function horse(g: CanvasRenderingContext2D, x: number, y: number, flip: boolean, now: number) {
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 18, 24, 6, 0, 0, 7); g.fill();
  const leg = Math.sin(now * 18) * 5;
  g.fillStyle = '#f4f1ea'; g.fillRect(-16 + leg, 4, 5, 14); g.fillRect(10 - leg, 4, 5, 14);
  g.beginPath(); g.ellipse(0, 0, 22, 11, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(14, -4); g.lineTo(26, -22); g.lineTo(34, -16); g.lineTo(22, 2); g.closePath(); g.fill();
  g.fillStyle = C.rani; g.fillRect(-10, -12, 18, 7); g.fillStyle = C.marigold; g.fillRect(-10, -6, 18, 2);
  g.fillStyle = C.ink; g.beginPath(); g.arc(28, -17, 1.5, 0, 7); g.fill();
  g.restore();
}

let dark: HTMLCanvasElement | null = null;

export function draw(g: CanvasRenderingContext2D, s: State, myId: string, now: number, code: string | null) {
  const dt = Math.min(0.1, now - lastNow || 0.016); lastNow = now;
  // lawn
  g.fillStyle = C.lawn; g.fillRect(0, 0, W, H);
  g.fillStyle = C.lawn2; for (let y = 0; y < H; y += 60) for (let x = (y / 60) % 2 ? 60 : 0; x < W; x += 120) g.fillRect(x, y, 60, 60);
  // carpet from gate to mandap
  g.fillStyle = 'rgba(224,52,122,.22)'; g.fillRect(GATE.x, 318, MANDAP.x - GATE.x, 24);
  for (const sp of SPOTS.slice(0, 12)) { g.fillStyle = 'rgba(255,243,214,.08)'; g.beginPath(); g.ellipse(sp.x, sp.y + 14, 20, 7, 0, 0, 7); g.fill(); }
  // gate
  g.strokeStyle = C.marigold; g.lineWidth = 6; g.beginPath(); g.arc(GATE.x - 14, GATE.y, 44, -Math.PI / 2, Math.PI / 2); g.stroke();
  // mandap
  g.fillStyle = 'rgba(246,168,33,.16)'; rr(g, MANDAP.x - 55, MANDAP.y - 60, 110, 120, 10); g.fill();
  g.fillStyle = C.rani; rr(g, MANDAP.x - 62, MANDAP.y - 70, 124, 18, 6); g.fill();
  g.fillStyle = C.marigold; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(MANDAP.x - 56 + i * 14, MANDAP.y - 48 + Math.sin(i * 0.8) * 3, 4, 0, 7); g.fill(); }
  g.fillStyle = '#8a5a2b'; for (const [dx, dy] of [[-52, -52], [46, -52], [-52, 52], [46, 52]]) g.fillRect(MANDAP.x + dx, MANDAP.y + dy - 6, 6, 12);
  const fl = 6 + Math.sin(now * 9) * 2; g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(MANDAP.x + 12, MANDAP.y, fl, 0, 7); g.fill();
  g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(MANDAP.x + 12, MANDAP.y + 1, fl * 0.5, 0, 7); g.fill();
  // stations
  const has = (k: DKind) => s.disasters.some(d => d.kind === k);
  for (const st of STATIONS) {
    g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, st.x - 44, st.y - 22, 92, 50, 10); g.fill();
    g.fillStyle = C.cream; rr(g, st.x - 46, st.y - 26, 92, 50, 10); g.fill();
    g.fillStyle = st.item === 'chair' ? '#b9c7c4' : C.marigold; rr(g, st.x - 46, st.y + 10, 92, 14, 6); g.fill();
    const out = st.item === 'paneer' && has('paneer');
    g.globalAlpha = out ? 0.25 : 1;
    for (const dx of [-24, 0, 24]) drawItem(g, st.item, st.x + dx, st.y - 6, 1.25);
    g.globalAlpha = 1;
    text(g, out ? 'KHATAM' : st.label.toUpperCase(), st.x, st.y + 18, `800 11px ${BODY}`, out ? C.danger : C.ink);
  }
  // generator
  g.fillStyle = '#5d6b70'; rr(g, GEN.x - 30, GEN.y - 22, 60, 44, 6); g.fill();
  g.fillStyle = has('bijli') ? C.danger : C.marigold; g.beginPath(); g.moveTo(GEN.x + 3, GEN.y - 16); g.lineTo(GEN.x - 9, GEN.y + 3); g.lineTo(GEN.x - 1, GEN.y + 3); g.lineTo(GEN.x - 4, GEN.y + 16); g.lineTo(GEN.x + 9, GEN.y - 4); g.lineTo(GEN.x + 1, GEN.y - 4); g.closePath(); g.fill();
  text(g, 'GENERATOR', GEN.x, GEN.y + 32, `800 10px ${BODY}`, C.cream);

  // people, sorted by depth
  type D = { y: number; f: () => void };
  const list: D[] = [];
  for (const q of s.guests) {
    const p = ease('g' + q.id, q.x, q.y, dt);
    list.push({ y: p.y, f: () => {
      person(g, p.x, p.y, BODY_COL[q.kind], q.kind, now, q.kind === 'dadi');
      if (q.kind !== 'baraati') text(g, q.name, p.x, p.y + 27, `800 11px ${BODY}`, C.cream);
      if (q.state === 'waiting' && q.want) {
        const bx = p.x + 20, by = p.y - 40, pc = Math.max(0, q.patience);
        const shake = pc < 0.3 ? Math.sin(now * 40) * 2 : 0;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(bx + shake, by, 16, 0, 7); g.fill();
        g.strokeStyle = pc > 0.55 ? C.good : pc > 0.3 ? C.marigold : C.danger; g.lineWidth = 4;
        g.beginPath(); g.arc(bx + shake, by, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pc); g.stroke();
        drawItem(g, q.want, bx + shake, by + 1);
      } else if (q.state === 'leaving') text(g, q.happy ? 'shukriya!' : 'hmph!', p.x, p.y - 34, `800 12px ${BODY}`, q.happy ? C.good : C.danger);
    } });
  }
  if (s.chintu) { const p = ease('c', s.chintu.x, s.chintu.y, dt); list.push({ y: p.y, f: () => { person(g, p.x, p.y, '#3fa66b', 'chintu', now, true); text(g, 'Chintu', p.x, p.y + 22, `800 10px ${BODY}`, C.cream); } }); }
  if (s.horse) { const h = s.horse, p = ease('h', h.x, h.y, dt); list.push({ y: p.y, f: () => horse(g, p.x, p.y, h.vx < 0, now) }); }
  for (const q of s.players) {
    const p = ease('p' + q.id, q.x, q.y, dt), col = PLAYER_COLORS[q.color % PLAYER_COLORS.length];
    list.push({ y: p.y, f: () => {
      if (q.id === myId) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.ellipse(p.x, p.y + 15, 18, 7, 0, 0, 7); g.stroke(); }
      person(g, p.x, p.y, col, 'player', now);
      text(g, q.name, p.x, p.y + 29, `800 12px ${BODY}`, col);
      if (q.carry) drawItem(g, q.carry, p.x, p.y - 38, 1.4);
    } });
  }
  list.sort((a, b) => a.y - b.y).forEach(d => d.f());

  // rain
  if (has('baarish')) {
    g.strokeStyle = 'rgba(190,225,255,.45)'; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < 90; i++) { const x = (i * 97 + now * 260) % W, y = (i * 53 + now * 900) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 16); }
    g.stroke();
  }
  // power cut: darkness with pools of light around the crew
  if (has('bijli')) {
    dark ??= document.createElement('canvas'); dark.width = W; dark.height = H;
    const d = dark.getContext('2d')!;
    d.globalCompositeOperation = 'source-over'; d.fillStyle = 'rgba(2,7,9,.93)'; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number) => { const gr = d.createRadialGradient(x, y, r * 0.25, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill(); };
    for (const q of s.players) { const p = shown.get('p' + q.id) ?? q; hole(p.x, p.y - 8, 125); }
    hole(GEN.x, GEN.y, 60 + Math.sin(now * 6) * 8); hole(MANDAP.x + 12, MANDAP.y, 70);
    g.drawImage(dark, 0, 0);
    const prog = s.disasters.find(d2 => d2.kind === 'bijli')!.progress;
    g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, GEN.x - 30, GEN.y - 36, 60, 7, 3); g.fill();
    g.fillStyle = C.marigold; rr(g, GEN.x - 30, GEN.y - 36, 60 * Math.min(1, prog), 7, 3); g.fill();
  }
  if (s.horse) { const pr = s.disasters.find(d => d.kind === 'ghodi')?.progress ?? 0, p = shown.get('h') ?? s.horse; g.fillStyle = 'rgba(255,255,255,.25)'; rr(g, p.x - 22, p.y - 36, 44, 6, 3); g.fill(); g.fillStyle = C.good; rr(g, p.x - 22, p.y - 36, 44 * Math.min(1, pr), 6, 3); g.fill(); }

  // string lights
  for (let i = 0; i <= 24; i++) {
    const x = i * 40, y = 50 + Math.sin(i * 0.52) * 5;
    g.fillStyle = has('bijli') ? '#39443f' : [C.marigold, C.rani, '#4cc3ff', C.good][i % 4];
    g.globalAlpha = has('bijli') ? 1 : 0.65 + 0.35 * Math.sin(now * 3 + i); g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
  }
  g.globalAlpha = 1;

  // HUD
  g.fillStyle = 'rgba(8,20,18,.92)'; g.fillRect(0, 0, W, 42);
  text(g, 'IZZAT', 16, 22, `800 12px ${BODY}`, C.cream, 'left');
  g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, 64, 13, 220, 16, 8); g.fill();
  const iz = Math.max(0, Math.min(100, s.izzat));
  g.fillStyle = iz > 50 ? C.good : iz > 25 ? C.marigold : C.danger; rr(g, 64, 13, 2.2 * iz, 16, 8); g.fill();
  text(g, String(Math.round(iz)), 296, 22, `800 14px ${BODY}`, C.cream, 'left');
  const left = Math.max(0, s.muhurat - s.t);
  text(g, s.phase === 'lobby' ? 'Muhurat' : `Muhurat in ${clock(left)}`, W / 2, 22, `22px ${DISPLAY}`, left < 30 && s.phase === 'run' ? C.danger : C.marigold);
  text(g, `${code ? 'Room ' + code : 'Solo'}  ·  served ${s.served}`, W - 16, 22, `800 13px ${BODY}`, C.cream, 'right');

  let by = 60;
  for (const d of s.disasters) {
    g.font = `800 13px ${BODY}`; const w = g.measureText(BANNERS[d.kind]).width + 28;
    g.fillStyle = C.danger; rr(g, W / 2 - w / 2, by, w, 26, 13); g.fill();
    text(g, BANNERS[d.kind], W / 2, by + 14, `800 13px ${BODY}`, '#fff'); by += 32;
  }
  let ty = H - 26;
  for (const t of s.toasts.slice().reverse()) {
    const a = Math.max(0, 1 - (s.t - t.t) / 4); g.globalAlpha = Math.min(1, a * 2);
    g.font = `600 14px ${BODY}`; const w = g.measureText(t.text).width + 24;
    g.fillStyle = 'rgba(8,20,18,.88)'; rr(g, W / 2 - w / 2, ty - 13, w, 26, 8); g.fill();
    text(g, t.text, W / 2, ty + 1, `600 14px ${BODY}`, C.cream); ty -= 30;
  }
  g.globalAlpha = 1;
  if (s.phase === 'lobby') {
    text(g, 'The lawn is ready. Walk around while the crew joins.', W / 2, 250, `600 18px ${BODY}`, C.cream);
    if (code) text(g, `Tell your friends the code: ${code}`, W / 2, 284, `26px ${DISPLAY}`, C.marigold);
  }
}
