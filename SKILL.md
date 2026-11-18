---
name: second-look
description: Use when an agent must review someone else's change (a co-host's patch, a PR, a config edit) before the owner takes it. Code checks the change against the live settings and the house's why-notes; the model only judges the hunks the checks cannot decide.
---

# Second look: review a change against today's facts and the house's reasons

A reviewer that reads only the diff says "looks good to me". This skill makes it read two more things on every run,
fresh: the **live settings** (never a copy) and the **why-notes** (`why/*.md`), and turns them into checks.

## Run it

1. `node scripts/review.mjs check` fetches the live settings and the patch, reads `why/`, and prints every hunk with
   the checks it hits and a `VERDICT:` line. Offline, from files: `node scripts/review.mjs offline patch.json settings.json`.
2. For each hunk:
   - `VERDICT: flag` or `pass`: keep it. Write the reason from its `CHECKS` lines.
   - `VERDICT: decide`: judge it yourself against the base file, the settings and the notes (rules below).
3. `node scripts/review.mjs send '<findings>'` with `[{"hunk":"<id>","verdict":"flag|pass","reason":"<why>"}]`, one
   finding per hunk. It refuses to send a missing, extra or empty finding (`not sent: ...`); fix it and send again.

## Rules for `decide`

- A why-note is a decision made on purpose. A hunk against a note is `flag`, even when its message calls it a fix.
- The commit message is a claim, not proof. Judge what the diff does.
- `pass` only when behavior stays the same or changes in a way no note, setting or rule forbids.
- Not sure it is safe: `flag`, so the owner looks.

## Limits

- Read-only. The reviewer never edits or applies the change.
- The API host is bound in `scripts/review.mjs` (`const API`). The token goes only there; redirects are not followed.
- Settings are read at every start. A value copied into a prompt or a file goes stale by the next run.
