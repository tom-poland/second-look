// checks.mjs: the routine part of a code review, as pure functions. No network, no files written.
//
// A review hunk is { id, file, message, diff }. The checks decide what code can decide:
//   flag  - a config value differs from the live settings, or the hunk adds code a house note forbids
//   pass  - the hunk only renames local names, one to one (behavior unchanged)
//   decide - nothing above applies: the model (or a human) judges it against the notes and the base file
//
// House notes are Markdown files (why/*.md) with a "**Decision:**" line and "Do not ..." lines.
// Every backticked name on a "Do not" line becomes a ban: a hunk that adds it is flagged.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reads every why/*.md note: its decision, its "Do not" lines and the code names those lines forbid. */
export function readNotes(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md').sort()
    .map((f) => parseNote(`why/${f}`, readFileSync(join(dir, f), 'utf8')));
}

export function parseNote(file, text) {
  const decision = text.match(/\*\*Decision:\*\*\s*(.+)/)?.[1]?.trim() ?? '';
  // To the end of the line, not to the first dot: code names hold dots (Math.round).
  const donts = [...text.matchAll(/\bDo not\b[^\n]*/g)].map((m) => m[0].trim());
  const banned = donts.flatMap((d) => [...d.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
  return { file, decision, donts, banned, text };
}

// ---- diff helpers ----------------------------------------------------------------------------------------------------
export const lines = (diff, sign) => diff.split('\n')
  .filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3))).map((l) => l.slice(1));
const TOKEN = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|\S/g;
const KEYWORDS = new Set(['return', 'const', 'let', 'var', 'function', 'export', 'import', 'from', 'if', 'else', 'new',
  'await', 'async', 'true', 'false', 'null', 'undefined', 'this', 'class', 'Math', 'JSON', 'Number', 'String', 'Object']);

/** True when the added lines are the removed lines with local names changed one to one, and nothing else. */
export function pureRename(diff) {
  const a = lines(diff, '-').join('\n').match(TOKEN) ?? [];
  const b = lines(diff, '+').join('\n').match(TOKEN) ?? [];
  if (!a.length || a.length !== b.length) return false;
  const fwd = new Map(), back = new Map();
  const ident = /^[A-Za-z_$][\w$]*$/;
  let renamed = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (!ident.test(a[i]) || !ident.test(b[i]) || KEYWORDS.has(a[i]) || KEYWORDS.has(b[i])) return false;
    // A name after "." is a property, not a local: renaming it changes behavior.
    if (a[i - 1] === '.' || b[i - 1] === '.') return false;
    if ((fwd.has(a[i]) && fwd.get(a[i]) !== b[i]) || (back.has(b[i]) && back.get(b[i]) !== a[i])) return false;
    fwd.set(a[i], b[i]); back.set(b[i], a[i]); renamed = true;
  }
  return renamed;
}

/** "key": value pairs set on the added lines of a JSON config hunk. */
export function configSets(diff) {
  return lines(diff, '+').flatMap((l) => {
    const m = l.match(/^\s*"([^"]+)"\s*:\s*([^,]+?)\s*,?\s*$/);
    if (!m) return [];
    let v; try { v = JSON.parse(m[2]); } catch { v = m[2]; }
    return [[m[1], v]];
  });
}

/**
 * The checks a hunk hits, as readable lines. houseChecks are optional extra functions
 * (hunk, { settings, notes, added, removed }) => string | null, for rules a note states without backticked code.
 */
export function checks(h, settings, notes, houseChecks = []) {
  const hits = [];
  const added = lines(h.diff, '+').join('\n');
  const removed = lines(h.diff, '-').join('\n');
  // 1. A config value must match the live settings, never an older copy.
  for (const [k, v] of configSets(h.diff)) {
    if (k in settings && settings[k] !== v) {
      hits.push(`sets ${k} to ${JSON.stringify(v)}, but the live settings${settings.version ? ` (version ${settings.version})` : ''} say ${JSON.stringify(settings[k])}`);
    }
  }
  // 2. Code a house note forbids.
  for (const n of notes) {
    for (const ban of n.banned) {
      if (added.includes(ban) && !removed.includes(ban)) {
        hits.push(`adds \`${ban}\`, which ${n.file} forbids: "${n.donts.find((d) => d.includes(ban))}"${n.decision ? ` Decision: ${n.decision}` : ''}`);
      }
    }
  }
  // 3. The house's own rules.
  for (const fn of houseChecks) {
    const hit = fn(h, { settings, notes, added, removed });
    if (hit) hits.push(hit);
  }
  return hits;
}

/** flag | pass | decide, with the lines that decided it. */
export function verdict(h, settings, notes, houseChecks = []) {
  const hits = checks(h, settings, notes, houseChecks);
  if (hits.length) return { verdict: 'flag', hits };
  if (pureRename(h.diff)) return { verdict: 'pass', hits: ['only local names change, one to one; the behavior is the same'] };
  return { verdict: 'decide', hits: [] };
}

/** One finding per hunk id, verdict flag|pass, a non-empty reason. Returns the problems, [] when it can be sent. */
export function validateFindings(findings, hunkIds) {
  const bad = [];
  if (!Array.isArray(findings)) return ['findings must be an array'];
  for (const id of hunkIds) if (findings.filter((f) => f?.hunk === id).length !== 1) bad.push(`exactly one finding for hunk ${id}`);
  for (const f of findings) {
    if (!hunkIds.includes(f?.hunk)) bad.push(`unknown hunk ${f?.hunk}`);
    if (!['flag', 'pass'].includes(f?.verdict)) bad.push(`verdict for ${f?.hunk} must be flag or pass`);
    if (typeof f?.reason !== 'string' || !f.reason.trim()) bad.push(`reason for ${f?.hunk} is empty`);
  }
  return bad;
}
