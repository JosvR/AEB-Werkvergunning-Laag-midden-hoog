import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('dist', { recursive: true });
for (const entry of await readdir('dist')) await rm(`dist/${entry}`, { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public/images', 'dist/images', { recursive: true });
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,format:'esm',target:['es2022'],jsx:'automatic',outfile:'dist/assets/app.js',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
await writeFile('dist/index.html', `<!doctype html>
<html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="application-version" content="${version}"><meta name="description" content="Tien AEB-praktijkcases over laag, midden en hoog risico. Kies Laag, Midden of Hoog met drie duidelijke knoppen. Met QR en live trainersoverzicht."><title>AEB — Laag, midden of hoog risico? — v${version}</title><link rel="icon" href="./images/aeb-logo.svg"><link rel="stylesheet" href="./assets/app.css?v=${version}"></head><body><div id="app"></div><noscript>Schakel JavaScript in om de oefenapp te gebruiken.</noscript><script type="module" src="./assets/app.js?v=${version}"></script></body></html>\n`);
console.log(`Statische AEB-app v${version} gereed in dist/. Geen build nodig bij Netlify.`);
