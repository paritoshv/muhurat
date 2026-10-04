// The verdict as a picture: the end-of-run headline on an invitation card, for a group chat.
export interface Verdict { won: boolean; title: string; headline: string; score: string }

function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (g.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function verdictImage(v: Verdict): Promise<Blob | null> {
  try { await Promise.all([document.fonts.load('120px "Yatra One"'), document.fonts.load('600 54px Mukta')]); } catch { /* fall back to system fonts */ }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); if (!g) return null;
  const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const rani = css('--rani', '#c9256a'), marigold = css('--marigold', '#f6a821'), cream = css('--cream', '#fff3d6'), ink = css('--ink', '#0a1614'), danger = css('--danger', '#c93426'), soft = css('--ink-soft', '#5a4720');
  const display = '"Yatra One", "Trebuchet MS", sans-serif', body = 'Mukta, "Segoe UI", system-ui, sans-serif';
  g.fillStyle = css('--lawn', '#15493e'); g.fillRect(0, 0, W, H);
  for (let i = 0; i * 90 < W + 90; i++) { g.fillStyle = i % 2 ? marigold : rani; g.beginPath(); g.arc(i * 90, 0, 50, 0, Math.PI); g.fill(); }
  // the invitation card and its double frame
  const x = 70, y = 130, w = W - 140, h = H - 250;
  g.fillStyle = rani; g.beginPath(); g.roundRect(x - 16, y - 16, w + 32, h + 32, 44); g.fill();
  g.fillStyle = marigold; g.beginPath(); g.roundRect(x - 6, y - 6, w + 12, h + 12, 36); g.fill();
  g.fillStyle = cream; g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, h - 8, 28); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = soft; g.font = `800 34px ${body}`; g.fillText('M U H U R A T', W / 2, y + 100);
  g.fillStyle = v.won ? rani : danger; g.font = `118px ${display}`;
  const title = wrap(g, v.title, w - 120); let ty = y + 250;
  for (const line of title) { g.fillText(line, W / 2, ty); ty += 124; }
  g.fillStyle = ink; g.font = `600 56px ${body}`;
  ty += 20; for (const line of wrap(g, v.headline, w - 140)) { g.fillText(line, W / 2, ty); ty += 74; }
  g.fillStyle = soft; g.font = `600 40px ${body}`; g.fillText(v.score, W / 2, ty + 40);
  g.fillStyle = ink; g.font = `800 44px ${body}`; g.fillText("Can you save today's shaadi?", W / 2, y + h - 150);
  g.fillStyle = rani; g.font = `800 44px ${body}`; g.fillText(location.host || 'muhurat', W / 2, y + h - 84);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

/** Hands the picture to the phone's share sheet; on a computer it saves the file. */
export async function shareVerdict(v: Verdict): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  const blob = await verdictImage(v); if (!blob) return 'failed';
  const file = new File([blob], 'muhurat.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${v.headline} ${location.origin}` }); return 'shared'; }
    catch (e) { if ((e as DOMException).name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = 'muhurat.png'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
