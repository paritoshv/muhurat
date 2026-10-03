// Builds two things into dist/:
//   index.html + app.js   the full game, served by the room server
//   muhurat-solo.html     one self-contained solo file (no server needed)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
const page = readFileSync('src/client/page.html', 'utf8');
const bundle = async soloOnly => (await build({
  entryPoints: ['src/client/main.ts'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2020',
  define: { SOLO_ONLY: String(soloOnly) },
})).outputFiles[0].text;

writeFileSync('dist/app.js', await bundle(false));
writeFileSync('dist/index.html', `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n${page}<script src="app.js"></script></html>\n`);
writeFileSync('dist/muhurat-solo.html', `${page}<script>${(await bundle(true)).replace(/<\/script/g, '<\\/script')}</script>\n`);
console.log('built dist/');
