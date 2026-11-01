import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');

test('drag completion and cancellation share pointer capture cleanup', () => {
  assert.match(script, /function endDrag\(e\)\{drag=false;cv\.style\.cursor='grab';/);
  assert.match(script, /cv\.hasPointerCapture\(e\.pointerId\)\)cv\.releasePointerCapture\(e\.pointerId\)/);
  assert.match(script, /addEventListener\('pointerup',endDrag\)/);
  assert.match(script, /addEventListener\('pointercancel',endDrag\)/);
});
