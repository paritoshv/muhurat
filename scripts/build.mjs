// Builds two things into dist/:
//   index.html + app.js   the full game, served by the room server
//   muhurat-solo.html     one self-contained solo fragment (no server needed)
//   site/index.html       the solo build with the daily leaderboard, for Netlify
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
mkdirSync('dist/site', { recursive: true });
const page = readFileSync('src/client/page.html', 'utf8');
const bundle = async (soloOnly, board, dev = false) => (await build({
  entryPoints: ['src/client/main.ts'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2020',
  define: { SOLO_ONLY: String(soloOnly), BOARD: String(board), DEV: String(dev) },
})).outputFiles[0].text;

// The room-server build doubles as the dev build: it carries the worst-case data toggle (?data=worst).
writeFileSync('dist/app.js', await bundle(false, true, true));
const head = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"><meta name="theme-color" content="#0b1f1c">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n`;
writeFileSync('dist/index.html', `${head}${page}<script src="app.js"></script></html>\n`);
const inline = js => `${page}<script>${js.replace(/<\/script/g, '<\\/script')}</script>\n`;
writeFileSync('dist/muhurat-solo.html', inline(await bundle(true, false)));
writeFileSync('dist/site/index.html', `${head}${inline(await bundle(true, true))}</html>\n`);
console.log('built dist/');
