# Hard Enough 💪

A 75 Hard tracker scaled down to something you'll actually finish. Pick your own
day count, pick your own nutrition plan, book days off when life happens, and
share one live board with your friends.

Branding is sampled from the Niarox rate proposal: ground `#171F2D`, panel
`#1F2D45`, visible rule `#516889`, cornflower `#82A3CC`. Bordered KPI tiles,
filled label pills, an oversized cropped wordmark and mono data readouts are all
lifted from that document. Anton for display, Outfit for UI, JetBrains Mono for
data. (Outfit stands in for Nexa, which is a commercial Fontfabric face and
cannot be served here — swap it in if you have the licence and the file.)

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

**Squad** — a roll call of who has shown up today, a race to the finish with a
lane each, standings with earned titles (*Leader*, *N day streak*, *Most bonus*,
*Not one missed*), and a button that copies the standings as text to paste into
the group chat.

Titles are only awarded on a strict win, so a tie hands out nothing and they stay
worth having.

Member colours are deliberately kept clear of the four status hues, so an avatar
never reads as "complete" or "missed". With four hues already reserved there is
no fully colourblind-safe six-person set — cyan/pink and lime/amber collapse for
deuteranopes in any order — so identity never rests on colour: every member mark
carries their initials.

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

**Screenshots, via Live Text.** The page cannot look at an image — it has no
vision model, no way to reach one, and no way to load an OCR library. But iPhone
can lift text out of any picture, which covers apps like Ultrahuman that have no
copy button at all:

1. Screenshot the workout.
2. Open it in Photos, press and hold the text.
3. Select All, Copy.
4. Paste into the box and hit the button.

The parser is tuned against real output and runs as a test suite in
`parser-tests.js` (`node parser-tests.js`). An Ultrahuman screenshot is full of
traps — a status-bar clock, a start-end range, and five per-zone durations that
all look like `MM:SS`, plus a MAX HR sitting right next to the average — so
duration is resolved most-specific-first and a heart rate labelled MAX or sitting
on a zone bound is never taken. The activity field is free text, so whatever the
app calls the workout is what gets stored.

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

## How it's hosted

One static file on GitHub Pages, syncing to Supabase. No Claude account, no
sign-in, works on any phone, and it installs to the home screen properly
(Safari → Share → Add to Home Screen) — full screen, no browser chrome.

**The board id lives in the URL fragment**, e.g. `.../hard-enough/#b=k7f2mq9x4v`.
That link is the credential and is never committed.

Opening the plain address does **not** create a board. It asks: start a new one,
or join an existing one by pasting the link or typing the board code. An earlier
version created a board silently, and the result was five people each alone on
five different boards, unable to see each other and with no clue why — the app
looked like it was working perfectly for every one of them.

A code that doesn't exist says so rather than quietly starting a fresh board
under that name. The Squad tab shows the code as text as well as the link,
because a code survives being pasted anywhere a URL fragment might get trimmed.

If Supabase can't be reached the app falls back to `localStorage` on that device
and says so in the status chip, rather than appearing to work and losing writes.

## How the shared board works

Every check-in is its **own row**. Two people ticking a box in the same second
touch different rows, so there is no conflict to resolve and no last-write-wins
clobbering — which is precisely what the earlier Artifact version had to be
designed around.

Reads pull the whole board in two requests (the second uses a nested select to
bring back members with their check-ins, rest days and workouts at once).

Updates arrive by polling: every 4s while the app is in use, 20s once idle,
paused entirely when the tab is hidden, and immediately on tab switch or when
the app comes back to the foreground.

A poll never lands on top of an unsaved edit. Text fields are debounced, and
while that debounce or any write is in flight the poll is skipped — without that
guard, changing a setting and having a refresh arrive first silently reverts what
you typed.

## Notes

- No dependencies, no build step, one file. Fonts come from Google Fonts;
  everything else is inline.
- Dark and light themes both designed, following the viewer's setting.
- Dates are handled in local time throughout, so a day never flips at the wrong
  hour because of UTC.
