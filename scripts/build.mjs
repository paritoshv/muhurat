// Builds two things into dist/:
//   index.html + app.js   the full game, served by the room server
//   muhurat-solo.html     one self-contained solo fragment (no server needed)
//   site/index.html       the solo build as a full static page, for Netlify
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
mkdirSync('dist/site', { recursive: true });
const page = readFileSync('src/client/page.html', 'utf8');
const bundle = async soloOnly => (await build({
  entryPoints: ['src/client/main.ts'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2020',
  define: { SOLO_ONLY: String(soloOnly) },
})).outputFiles[0].text;

writeFileSync('dist/app.js', await bundle(false));
const head = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n`;
writeFileSync('dist/index.html', `${head}${page}<script src="app.js"></script></html>\n`);
const solo = `${page}<script>${(await bundle(true)).replace(/<\/script/g, '<\\/script')}</script>\n`;
writeFileSync('dist/muhurat-solo.html', solo);
writeFileSync('dist/site/index.html', `${head}${solo}</html>\n`);
console.log('built dist/');
