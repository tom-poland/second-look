# second-look

A reviewer role for an agent harness, built in MEGA.dev S04E02 "Looks good to me". It reviews a co-host's patch before
the owner takes it, and it does not say "looks good to me" by default.

## What it fixes

The starter reviewer read only the patch. It passed two bad hunks:

| Hunk | What it did | Why the starter passed it | What catches it here |
|---|---|---|---|
| commission 15 % | set a config value | the role had the commission copied in its file (15 %, 10 Nov); the house was at 16 % | check 1: every config value is compared with `GET /settings`, read at every start |
| `Math.floor` → `Math.round`, "fix" | changed rounding | it never read `why/payout-rounding.md` | check 2: every backticked name on a "Do not" line of a why-note is a ban |

With the checks, the course accepted the review on the first send ("every verdict is right").

## How it decides

```
hunk ──► config value ≠ live settings? ──► flag
     └─► adds code a why-note forbids?  ──► flag
     └─► house check hits?               ──► flag
     └─► only local names renamed 1:1?   ──► pass
     └─► otherwise                       ──► decide  (the model judges, with the notes and the base file printed)
```

The model judges only what code cannot. Routine verdicts never depend on it reading carefully.

## Files

| File | What it is |
|---|---|
| `SKILL.md` | how an agent runs it, and the rules for `decide` |
| `scripts/checks.mjs` | the checks as pure functions (no network, no writes) |
| `scripts/review.mjs` | `check` / `send` against your API, `offline` from files |
| `scripts/checks.selftest.mjs` | `node --test scripts/checks.selftest.mjs`: 10 cases, no network |
| `templates/ROLE.md` | a role file for a Host Desk style harness |
| `templates/why/example.md` | the why-note shape the checks read |
| `templates/house-checks.example.mjs` | rules a note gives in words (nights, payout date) |
| `templates/example/` | a patch and settings to try `offline` |

## Install

1. Copy the folder into your skills folder (or a role's `scripts/`).
2. In `scripts/review.mjs`, set `const API` to your review API host, and `WHY_DIR` if your notes are not at `../../../why`.
3. Put the token in the environment as `REVIEW_TOKEN` (from your secrets store, never in a prompt).
4. Try it: `node scripts/review.mjs offline templates/example/patch.json templates/example/settings.json`.
   Expected: h-1 flag (`Math.round`), h-2 flag (15 vs 16), h-3 pass (rename), h-4 decide.

## Factory rules it follows

4. Read facts from their source at every start: settings change between runs (14–18 % seen in one day).
5. Write the why next to the code, and read it before judging: a note is a decision, not a comment.
