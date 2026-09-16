# Niafied Closet

Turn photos of yourself into a searchable wardrobe, then let it tell you what to wear.

Upload a mirror selfie (or any photo someone took of you), and Claude reads the image and
lists the individual garments you're wearing — each one cropped, colour-matched and
categorised. Confirm what it found, and those pieces become your closet: sortable,
filterable, and the raw material for outfit recommendations.

## Just use it

| | Link | Who it's for |
|---|---|---|
| **Your closet** | [claude.ai/artifact/4MVfhjhKQUKNDV3Hw4ujbn](https://claude.ai/artifact/4MVfhjhKQUKNDV3Hw4ujbn) | You. Saved to the page, so the same wardrobe is on your phone and your laptop. |
| **Shareable copy** | [claude.ai/artifact/TuBrW2Vz9YewDZQvrFd2um](https://claude.ai/artifact/TuBrW2Vz9YewDZQvrFd2um) | Friends. Each person's wardrobe lives in their own browser — nobody sees anyone else's. |

Neither needs anything set up: no API key, no terminal, no install. Both run on the
viewer's own Claude account (the first ✨ action asks permission). Open one, drop in a
photo, and go.

Why two: the storage that syncs your closet between devices is shared per artifact, so a
single link would put everyone in the *same* closet — and an artifact that stores data that
way can only be opened inside your own organization. The shareable copy drops that storage,
which makes the link openable by anyone and gives each viewer their own private wardrobe.
Same page either way; it detects what it has at load and adapts.

Everything below is for running it yourself from this repo.

## What it does

**Build a closet from photos**
- Drop in mirror selfies, full-length shots, or flat lays of a single piece
- Claude identifies each garment: what it is, its fabric colour, pattern, material, how
  dressy it is, and which seasons it suits
- Every detection is shown for review before it's saved — edit anything, drag the crop
  box, or throw it out
- Rather not use AI? Tag pieces by hand: drag a box around a garment and the app samples
  the colour off the pixels and names it for you

**Browse and sort**
- Search across names, colours, materials, patterns and notes
- Filter by category, colour family, season or favourites
- Sort by newest, name, category, colour (neutrals first, then round the colour wheel),
  dressiness, most worn, or least worn
- Tap any piece to edit it, log a wear, or build outfits around it

**Get recommendations**
- **Closet engine** (always available, never calls out): generates real combinations and
  ranks them on colour harmony, dress-code consistency, weather fit, pattern balance, and
  what you haven't reached for lately. Every suggestion explains itself — *"charcoal lets
  the rust do the talking"*, *"gets 2 pieces you have never worn into rotation"*
- **Claude styling**: sends the closet inventory — text only, no photos — for outfit ideas
  with reasoning, a concrete styling tip, and an honest read on what the closet is missing
- Tell it the occasion, the weather, and anything else on your mind ("lots of walking",
  "meeting my partner's parents")

**Insights**
- What you own by category and colour
- What you actually wear vs. what sits there
- Gaps worth filling, based on what your closet can't currently put together

## Running it from this repo

The app uses ES modules, so it needs to be served over HTTP — opening `index.html`
directly from the filesystem won't work.

```bash
cd closet
python3 -m http.server 8000
# then open http://localhost:8000
```

Run this way there's no Claude on the page, so the AI features need an Anthropic API key
from [console.anthropic.com](https://console.anthropic.com/settings/keys), pasted into
**Settings**. They use **Claude Opus 5** with adaptive thinking and JSON-schema structured
outputs through the official `@anthropic-ai/sdk`. Hand-tagging, sorting and the closet
engine all work with no key at all.

> ⚠️ Run locally, the key is used **directly from your browser**, so it's visible to
> anything on the page. Fine for an app you serve on your own machine; not safe for a page
> you put on the internet. That's precisely what the published version avoids.

### Rebuilding the published version

```bash
node build-artifact.mjs   # -> dist/closet-artifact.html
```

This flattens `js/*.js`, `styles.css` and the brand mark into one self-contained page,
since an artifact is a single document rather than a folder of modules. It resolves the
module graph, fails loudly on a name collision, and escapes every non-ASCII character so
the page renders the same however the host decodes it.

It writes the same page twice — `closet-artifact.html` and `closet-shareable.html` — which
publish as the two artifacts above. The only difference is the capabilities each is granted
at publish time.

## One app, two homes

The same source runs both ways and picks its backend at load time:

| | Published | From this repo |
|---|---|---|
| Claude | the page's own access, on your account | Anthropic SDK + your API key |
| Your pieces | the artifact's database, on any device | IndexedDB, this browser |
| Photos | IndexedDB, this browser | IndexedDB, this browser |
| Export | download confirmed by you | direct file download |

`js/capabilities.js` is the seam: each getter resolves `null` when its capability isn't
there, and every caller degrades instead of failing.

## Privacy

Nothing is uploaded unless you press one of the ✨ buttons:

| Action | What leaves your device |
|---|---|
| Find the clothes in this photo | That one photo, downscaled to 1400px |
| Ask Claude to style me | A text list of your items — no images |
| Everything else | Nothing |

Photos always stay in the browser you added them from — they're working material, and once
a piece is catalogued its thumbnail travels with the item. **Settings → Export closet**
writes a JSON backup (items and saved looks, thumbnails included) you can import anywhere.

Because the published page stores data for you, it's internal to your Claude organization
and can't be shared as a public link.

## How the pieces fit together

| File | Responsibility |
|---|---|
| `js/catalog.js` | Categories, subtypes, seasons, dress codes, occasions, weather |
| `js/color.js` | Hex → wearable colour name, neutral detection, pair-harmony scoring |
| `js/imaging.js` | Downscaling, cropping, and pulling a palette out of a region |
| `js/capabilities.js` | Which Claude and which store this page has, if any |
| `js/store.js` | Items and looks (shared store or IndexedDB), photos (IndexedDB) |
| `js/cropbox.js` | The draggable/resizable selection box |
| `js/vision.js` | Photo → garment list, then sanitised into something safe to render |
| `js/stylist.js` | The local outfit engine, Claude styling, stats and gap analysis |
| `js/app.js` | Views, state and wiring |
| `build-artifact.mjs` | Flattens all of the above into one publishable page |

No build step for local use, no framework, nothing to install.

Run `node test/logic.test.mjs` to check the colour naming, harmony scoring and outfit
engine — 25 assertions, no dependencies, no browser.

## Notes on the colour logic

Colour drives most of the recommendations, so it's worth knowing the rules:

- **Neutrals** (black, white, grey, beige, brown, navy) pair with anything and score high
- **Analogous** colours — neighbours on the wheel — are a safe, tonal pairing
- **Complementary** colours score well when muted, lower when both are vivid
- **45–100° apart and both saturated** is the classic clash zone, and gets penalised

Claude's read of a garment's colour is trusted over the raw pixels, since it corrects for
warm indoor lighting and shadow; hand-tagged pieces fall back to sampling the crop. A piece
keeps both: Claude's word for it ("indigo") on its chip, and the computed family ("navy")
for filtering and for what the outfit engine reasons about.

## Design

Built from Niafied's own identity, taken off a studio invoice:

- **Navy `#181f2d` and periwinkle `#83a4cd`**, sampled from the document itself
- **Oswald** condensed for anything that announces itself — the masthead, section labels,
  outfit titles, the big numbers in Insights — and **Poppins** for anything you read
- **The giant word up the right edge**, the studio's signature device, here doing a job: it
  reads `NIAFIED INTAKE`, `NIAFIED CLOSET`, `NIAFIED OUTFITS` and tells you which view
  you're in, exactly the way the invoice says `NIAFIED INVOICE`
- **The `N` mark**, lifted from the invoice and carried in the masthead
- Labels sit over hairline rules, and scale jumps hard from a small label to a large
  statement — both straight from the invoice's layout

One visual world, deliberately: the navy is the brand, and a dark gallery wall is the right
thing to hang clothes on. Every other colour on screen belongs to a garment, not to the
interface.
