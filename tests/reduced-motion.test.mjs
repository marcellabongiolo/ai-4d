import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');

test('main visualizer draws once instead of scheduling frames for reduced motion', () => {
  assert.ok(script.includes('if(!reduceMotion)requestAnimationFrame(render)}'));
  assert.ok(script.includes('if(reduceMotion)render(0);else requestAnimationFrame(render);'));
});
