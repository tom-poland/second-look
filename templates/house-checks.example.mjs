// House checks: rules a why-note states in words, without a backticked name to ban.
// Each takes (hunk, { settings, notes, added, removed }) and returns a reason string to flag, or null.
// Import the ones you need in scripts/review.mjs and put them in HOUSE_CHECKS.

/** why/nights.md: nights = check-out minus check-in. Adding one counts the check-out day. */
export const nightsPlusOne = (h, { added, removed }) =>
  /night|stay|check-?(in|out)|DAY/i.test(`${h.file} ${h.message ?? ''} ${h.diff}`)
  && /[+]\s*1\b|\+\+|\bceil\b/.test(added) && !/[+]\s*1\b|\+\+|\bceil\b/.test(removed)
    ? 'adds one to the nights, which why/nights.md forbids'
    : null;

/** why/payout-date.md: a payout is due on check-out. Moving it to check-in pays before the stay ends. */
export const payoutOnCheckIn = (h, { added, removed }) =>
  /check-?in/i.test(added) && /check-?out/i.test(removed)
    ? 'moves the payout date from check-out to check-in, which why/payout-date.md forbids'
    : null;
