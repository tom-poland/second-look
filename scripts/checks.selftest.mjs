// node --test checks.selftest.mjs   (no network, no files)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNote, pureRename, validateFindings, verdict } from './checks.mjs';

const rounding = parseNote('why/payout-rounding.md', [
  '# Why payouts round down',
  '**Decision:** a payout is rounded down to whole EUR (`Math.floor`), never to the nearest EUR.',
  '**So:** That is on purpose. Do not change it to `Math.round` or `Math.ceil`.',
].join('\n'));
const notes = [rounding];
const settings = { version: '2026-11-17', commissionPct: 16 };
const hunk = (id, diff, message = '') => ({ id, file: 'x', message, diff });

test('a "Do not" line keeps code names with dots', () => {
  assert.deepEqual(rounding.banned, ['Math.round', 'Math.ceil']);
});

test('a hunk that adds forbidden code is flagged, even when called a fix', () => {
  const v = verdict(hunk('h1', '-  return Math.floor(x);\n+  return Math.round(x);', 'fix rounding'), settings, notes);
  assert.equal(v.verdict, 'flag');
  assert.match(v.hits[0], /Math\.round.*payout-rounding/);
});

test('a config value from an old copy of the settings is flagged', () => {
  const v = verdict(hunk('h2', '-  "commissionPct": 14,\n+  "commissionPct": 15,'), settings, notes);
  assert.equal(v.verdict, 'flag');
  assert.match(v.hits[0], /live settings .* say 16/);
});

test('a config value equal to the live settings is not flagged by that check', () => {
  assert.notEqual(verdict(hunk('h3', '-  "commissionPct": 14,\n+  "commissionPct": 16,'), settings, notes).verdict, 'flag');
});

test('a pure local rename passes', () => {
  const v = verdict(hunk('h4', '-const t = a + b;\n-return t;\n+const total = a + b;\n+return total;'), settings, notes);
  assert.equal(v.verdict, 'pass');
});

test('renaming a property is not a pure rename', () => {
  assert.equal(pureRename('-return s.total;\n+return s.sum;'), false);
});

test('two names mapped to one is not a pure rename', () => {
  assert.equal(pureRename('-f(a, b);\n+f(c, c);'), false);
});

test('anything else is left to decide', () => {
  assert.equal(verdict(hunk('h5', '-if (n > 0) go();\n+if (n >= 0) go();'), settings, notes).verdict, 'decide');
});

test('house checks add rules a note gives without backticked code', () => {
  const nights = (h, { added, removed }) => (/\+\s*1\b/.test(added) && !/\+\s*1\b/.test(removed) ? 'adds one to the nights (why/nights.md)' : null);
  assert.equal(verdict(hunk('h6', '-const n = (out - inn) / DAY;\n+const n = (out - inn) / DAY + 1;'), settings, notes, [nights]).verdict, 'flag');
});

test('findings: one per hunk, flag or pass, with a reason', () => {
  assert.deepEqual(validateFindings([{ hunk: 'a', verdict: 'flag', reason: 'why' }], ['a']), []);
  assert.equal(validateFindings([{ hunk: 'a', verdict: 'ok', reason: '' }], ['a', 'b']).length, 3);
});
