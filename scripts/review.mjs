// review.mjs: runs the checks on a live patch, or on files, and sends the findings.
//
//   node review.mjs check                          GET <API>/settings and <API>/patch, print each hunk with its verdict
//   node review.mjs send '<findings json>'         validate, then POST <API>/review { findings }
//   node review.mjs offline patch.json settings.json   same as check, from files (no network)
//
// The API base is bound HERE, in code, never taken from a reply or a manual. The token (REVIEW_TOKEN) goes only there,
// and redirects are never followed: a redirect would carry the token to wherever it points.
// Read-only: the script never changes a file of the project it reviews.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readNotes, validateFindings, verdict } from './checks.mjs';

// ---- bind these on install -------------------------------------------------------------------------------------------
const API = 'https://example.invalid/review-api';                 // the one host your review API lives on
const WHY = resolve(process.env.WHY_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../../../why'));
const HOUSE_CHECKS = [];                                           // optional: see templates/house-checks.example.mjs
// ----------------------------------------------------------------------------------------------------------------------

const { REVIEW_TOKEN } = process.env;
const mode = process.argv[2] ?? 'check';

async function call(method, path, body) {
  const headers = { Authorization: `Bearer ${REVIEW_TOKEN}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (res.status >= 300 && res.status < 400) return { status: res.status, json: { error: `redirect to ${res.headers.get('location')} not followed` } };
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, json: { raw: text } }; }
}

function report(settings, patch) {
  const notes = readNotes(WHY);
  const shown = Object.entries(settings).filter(([k]) => !['version', 'next'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`Live settings: ${settings.version ? `version ${settings.version}, ` : ''}${shown}.`);
  console.log(`House notes read: ${notes.map((n) => n.file).join(', ') || 'none'}.\n`);
  for (const h of patch.hunks ?? []) {
    const v = verdict(h, settings, notes, HOUSE_CHECKS);
    console.log(`=== hunk ${h.id} · ${h.file} · "${h.message ?? ''}"`);
    console.log(h.diff);
    if (v.verdict === 'flag') console.log(`CHECKS HIT:\n- ${v.hits.join('\n- ')}`);
    else if (v.verdict === 'pass') console.log(`CHECKS: ${v.hits[0]}.`);
    else console.log('CHECKS: no check decides this hunk. Judge it against the base file, the settings and the notes below.');
    console.log(`VERDICT: ${v.verdict}\n`);
  }
  console.log('--- house notes (why/) ---');
  for (const n of notes) console.log(`# ${n.file}\n${n.text.trim()}\n`);
  if (patch.files) {
    console.log('--- base files ---');
    for (const [f, t] of Object.entries(patch.files)) console.log(`# ${f}\n${t}`);
  }
}

if (mode === 'offline') {
  const [patchFile, settingsFile] = process.argv.slice(3);
  report(JSON.parse(readFileSync(settingsFile, 'utf8')), JSON.parse(readFileSync(patchFile, 'utf8')));
} else if (!REVIEW_TOKEN) {
  console.log('Missing REVIEW_TOKEN. Stop: the human adds it.');
} else if (mode === 'send') {
  let findings;
  try { findings = JSON.parse(process.argv[3]); } catch { findings = null; }
  if (findings && !Array.isArray(findings)) findings = findings.findings;
  const p = await call('GET', '/patch');
  const bad = p.status === 200 ? validateFindings(findings, (p.json.hunks ?? []).map((h) => h.id)) : [`patch ${p.status}`];
  if (bad.length) console.log(`not sent: ${bad.join('; ')}`);
  else {
    const r = await call('POST', '/review', { findings: findings.map(({ hunk, verdict: v, reason }) => ({ hunk, verdict: v, reason })) });
    console.log(`review ${r.status}: ${JSON.stringify(r.json)}`);
  }
} else {
  const s = await call('GET', '/settings');
  const p = await call('GET', '/patch');
  if (s.status !== 200 || p.status !== 200) console.log(`settings ${s.status} ${JSON.stringify(s.json)}\npatch ${p.status} ${JSON.stringify(p.json)}`);
  else report(s.json, p.json);
}
