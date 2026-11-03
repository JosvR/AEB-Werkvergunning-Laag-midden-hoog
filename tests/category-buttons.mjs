import assert from 'node:assert/strict';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
await mkdir('.test-runtime', { recursive:true });
try {
  await build({ stdin: { contents: `import React from 'react'; import View from './src/question-view'; import questions from './src/questions.json'; export const view = (props) => React.createElement(View,{q:questions[0],...props});`, resolveDir: process.cwd(), loader: 'jsx' }, outfile:'.test-runtime/category-view.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' });
  const { view } = await import(pathToFileURL(resolve('.test-runtime/category-view.mjs')).href);
  const html = renderToStaticMarkup(view({choice: 2, onChoose: () => {}}));
  for (const label of ['Laag','Midden','Hoog']) assert.match(html, new RegExp('aria-label="' + label + '"'));
  assert.equal((html.match(/role="radio"/g)||[]).length,3);
  assert.match(html,/aria-checked="true"/);
  assert.doesNotMatch(html,/draggable=|Sleep|touch-action:none/);
  const source=await readFile('src/question-view.tsx','utf8');
  assert.doesNotMatch(source,/bindTouchDrag|onPointerDown|onTouchStart|createPortal|setPointerCapture/);
  const offline=renderToStaticMarkup(view({onChoose:()=>{},disabled:false}));
  assert.doesNotMatch(offline,/role="radio"[^>]*disabled/);
  console.log('Geslaagd: drie categorieknoppen, selectie en geen sleepbediening.');
} finally { await rm('.test-runtime',{recursive:true,force:true}); }
