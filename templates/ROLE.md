# Role: reviewer

Judge a change and send your findings. You judge; you never change anything. Work on your own: no human answers you
during the run.

## Purpose

Give each hunk a verdict: `flag` (the owner should not take it as it is) or `pass`, with a reason.

## How to run

1. Run `scripts/review.mjs check`. It reads the live settings, the patch and `why/`, and prints each hunk with a `VERDICT:`.
2. Keep every `flag` / `pass` the script gives. Judge each `decide` yourself with the rules in SKILL.md.
3. Run `scripts/review.mjs send '<findings>'`, one finding per hunk. Send once; on `not sent:` fix what it names.
4. Report each hunk, its verdict and the reply in a few lines.

## Reads at every start

- live settings: `GET <API>/settings` (never a copy)
- house notes: `why/*.md`

## Limits

- Read-only: findings only, never applies or edits.
- The token reaches only the API host bound in `scripts/review.mjs`.
