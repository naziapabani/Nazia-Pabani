# Hard Enough 💪

A 75 Hard tracker scaled down to something you'll actually finish. Pick your own
day count, pick your own nutrition plan, book days off when life happens, and
share one live board with your friends.

Branding is sampled from the Niarox rate proposal: ground `#171F2D`, panel
`#1F2D45`, visible rule `#516889`, cornflower `#82A3CC`. Bordered KPI tiles,
filled label pills, an oversized cropped wordmark and mono data readouts are all
lifted from that document. Anton for display, Archivo for UI, JetBrains Mono for
data.

**Deliberately single-theme.** The brand has no light mode, so the page commits
to dark and paints every colour explicitly rather than following the viewer's
setting.

**The status hues were validated, not eyeballed.** Run through the CVD checker,
the original violet collided with the brand cornflower (ΔE 12.5 in normal vision,
below the 15 floor). Cornflower is locked by the brand, so bonus moved to gold.
"Partial" now sits on the mint ramp instead of owning a hue, because partial is
progress toward complete, not a separate category. Final set: mint complete,
cornflower rest, coral missed, gold bonus — every state also carries a glyph and
a labelled legend, so none of it is colour-alone.

## What it does

**Today** — the day you're on, a KPI row, the checklist split into *Every day*
and *Go harder*, and a chain gauge showing every day of the challenge at once.

**Train** — log a session (type, minutes, calories, average heart rate) and it
ticks the workout boxes for you. Totals, a minutes-per-day chart against your
target, and a paste box that pulls the numbers out of text copied from a watch
app.

**Squad** — everyone on the board ranked by days completed, with each person's
streak history as a mini chain and who has checked in today.

**Card** — the full punch card. Tap any day to fill it in after the fact.

**Settings** — everything is editable: challenge name, day count, your start
date, your nutrition plan, the task list, whether each task is every-day or
bonus, your workout target, how many rest days you get, and what happens when you
miss a day.

## What makes it looser than 75 Hard

| 75 Hard | Hard Enough (defaults) |
| --- | --- |
| 75 days, fixed | 45 days, change it to anything from 1 to 365 |
| Two 45-min workouts, one outdoors | One 45-min workout; the second is bonus |
| A gallon of water | A gallon of water (unchanged) |
| A diet of your choice | A diet of your choice, picked at signup and shown on the checkmark |
| 10 pages of non-fiction | 10 pages of non-fiction |
| Progress photo required | Progress photo is bonus |
| Miss anything → restart at day 1 | 5 rest days you book on purpose, then 3 misses |

A day counts as complete when every **every day** task is ticked. **Bonus** tasks
never block a day — they stack up a separate score, so anyone who wants the full
75 Hard load can chase it and it shows on the leaderboard as `+N`.

Everyone counts from their **own** start date, so friends can join late without
wrecking the board.

### Nutrition plans

Each person picks their own plan when they join — presets like *High protein* or
*Mediterranean*, or type your own. It becomes the subtitle on that person's daily
nutrition checkmark and shows next to their name on the squad board. Change it
any time in Settings.

### The training log

Log a session and the workout checkmarks follow — hitting the target (45 minutes
by default) ticks the daily workout, and double it also ticks the bonus second
session. You enter the numbers once instead of logging *and* ticking. Deleting
the sessions untick them again.

**On uploading watch screenshots:** the page cannot read an image. It has no
vision model and no way to reach one, and an OCR library can't be loaded (the
page is locked down to its own assets). So instead:

- **Paste the text.** Most watch apps let you share or copy a workout summary.
  The paste box regex-extracts duration (`00:42:30`, `45 min`, `1h 10m`),
  calories, average heart rate, and the activity type.
- **Or type three numbers** — minutes, kcal, HR. It's faster than it sounds.

### Rest days

The reason this is 45 and not 75. Book a day off in advance (or on the day) from
Today or from the Card, for a birthday, a holiday, or a week that got away from
you. A rest day:

- does **not** count as missed,
- does **not** break your streak,
- and is **refunded** if you end up doing all the work anyway.

Misses are the separate, unplanned case: skip a day without booking it off and it
counts against the miss allowance. Both budgets are configurable, and the reset
can be switched off entirely.

## Two ways to run it

### 1. Shared board (what you want for a group)

Published as a Claude Artifact. Every check-in publishes a new version of the
page, so all of you read and write the same board — open the link, tap your
name, and you're on it.

Your friends need **edit access** to the artifact for their check-ins to save.
Share it from the page's share menu with editing turned on; anyone with view-only
access sees the board but gets a "read only" banner instead of working
checkboxes.

### 2. Standalone copy (one phone, no server)

Open `index.html` from anywhere — a local file, GitHub Pages, any static host.
It detects there's no shared backend and saves to `localStorage` on that device
instead. Same app, no sharing.

To put it on your home screen: open it in Safari on iPhone → Share → **Add to
Home Screen**. It gets its own icon and opens full screen with no browser bars.

## Editing it

`index.html` is the canonical source and a complete standalone document.
`artifact.html` is generated from it — the Artifact host wraps published files in
its own `<head>`/`<body>`, so that copy has to be content-only.

```sh
# after editing index.html
python3 build-artifact.py
```

Then republish `artifact.html` to the same artifact URL. Never edit
`artifact.html` directly; it gets overwritten.

## How the shared board works

The page holds the whole squad's state as JSON inside its own HTML. On a
check-in it regenerates a complete replacement document from its own `<style>`
and `<script>` text plus the new state, and publishes that. Every open view
reloads to the winner.

Writes are compare-and-set. If two people check in at once, one gets a
`conflict`, both views reload to the version that landed, and the loser just taps
again — there's no retry loop and nothing to apologise for. Saves are debounced
about a second, and never fire while a text field has focus, so typing in
Settings can't get interrupted by a reload.

## Notes

- No dependencies, no build step, one file. Fonts come from Google Fonts;
  everything else is inline.
- Dark and light themes both designed, following the viewer's setting.
- Dates are handled in local time throughout, so a day never flips at the wrong
  hour because of UTC.
