# MEGA card: Second Look

| Field | Value |
|---|---|
| name | Second Look |
| class | COMMUNITY (forged) |
| type | GUARD |
| part | EYES |
| line | the message says fix. the note says don't. the diff decides. |
| from | Lesson S04E02 · Challenge "Looks good to me" |
| skill folder | `second-look` · 10 files |

**What it does**

Reviewer skill. Reads the live settings and the house's why-notes at every start, turns every "Do not" into a
check, flags what they catch, passes pure renames, and leaves only the rest for the model to judge.

**Proof**

- The starter reviewer was refused: two wrong verdicts (a stale 15 % commission, a `Math.round` "fix").
- With this skill, the first review sent was accepted: "every verdict is right".
- `node --test scripts/checks.selftest.mjs`: 10 of 10 pass, no network.
