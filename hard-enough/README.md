# Hard Enough 💪

A 75 Hard tracker scaled down to something you'll actually finish. Pick your own
day count, pick your own rules, and share one live board with your friends.

## What it does

**Today** — the day you're on, a checklist of that day's tasks, and a chain gauge
showing every day of the challenge at a glance.

**Squad** — everyone on the board ranked by days completed, with each person's
streak history as a mini chain and who has checked in today.

**Card** — the full punch card. Tap any day to fill it in after the fact.

**Settings** — everything is editable: challenge name, day count, your start
date, the task list, whether each task is required or optional, and what happens
when you miss a day.

## What makes it looser than 75 Hard

| 75 Hard | Hard Enough (defaults) |
| --- | --- |
| 75 days, fixed | 45 days, change it to anything from 1 to 365 |
| Two 45-min workouts, one outdoors | One 30-min workout; "get outside" is optional |
| A gallon of water | 3 litres |
| 10 pages of non-fiction | 10 pages of anything |
| Progress photo required | Progress photo optional |
| Miss anything → restart at day 1 | 5 misses allowed; or strict, or no reset at all |

A day counts as complete when every **required** task is ticked. Optional tasks
are there for credit, not pressure.

Everyone counts from their **own** start date, so friends can join late without
wrecking the board.

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
