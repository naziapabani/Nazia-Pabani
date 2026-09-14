# 🪞 Closet

Turn photos of yourself into a searchable wardrobe, then let it tell you what to wear.

Upload a mirror selfie (or any photo someone took of you), and Claude reads the image and
lists the individual garments you're wearing — each one cropped, colour-matched and
categorised. Confirm what it found, and those pieces become your closet: sortable,
filterable, and the raw material for outfit recommendations.

## What it does

**Build a closet from photos**
- Drop in mirror selfies, full-length shots, or flat lays of a single piece
- Claude identifies each garment: what it is, its fabric colour, pattern, material, how
  dressy it is, and which seasons it suits
- Every detection is shown for review before it's saved — edit anything, drag the crop
  box, or throw it out
- No API key? Tag pieces by hand: drag a box around a garment and the app samples the
  colour off the pixels and names it for you

**Browse and sort**
- Search across names, colours, materials, patterns and notes
- Filter by category, colour family, season or favourites
- Sort by newest, name, category, colour (neutrals first, then round the colour wheel),
  dressiness, most worn, or least worn
- Tap any piece to edit it, log a wear, or build outfits around it

**Get recommendations**
- **Closet engine** (always available, no key): generates real combinations and ranks them
  on colour harmony, dress-code consistency, weather fit, pattern balance, and what you
  haven't reached for lately. Every suggestion explains itself — *"charcoal lets the rust
  do the talking"*, *"gets 2 pieces you have never worn into rotation"*
- **AI stylist** (needs a key): sends the closet inventory — text only, no photos — to
  Claude for outfit ideas with reasoning, a concrete styling tip, and an honest read on
  what the closet is missing
- Tell it the occasion, the weather, and anything else on your mind ("lots of walking",
  "meeting my partner's parents")

**Insights**
- What you own by category and colour
- What you actually wear vs. what sits there
- Gaps worth filling, based on what your closet can't currently put together

## Running it

The app uses ES modules, so it needs to be served over HTTP — opening `index.html`
directly from the filesystem won't work.

```bash
cd closet
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

## Turning on the AI features

1. Get a key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Paste it into **Settings → Anthropic API key**
3. "Remember on this device" stores it in `localStorage`; leave it off and the key lives in
   `sessionStorage` until you close the tab

Both AI features use **Claude Opus 5** with adaptive thinking and structured (JSON-schema)
outputs, called straight from the browser via the official `@anthropic-ai/sdk`.

### ⚠️ About the API key

The key is used **directly from your browser**, which means it's visible to anything
running on the page and is sent from the client. That's a reasonable trade for a personal
app you serve on your own machine. It is **not** safe for a page you publish to the
internet — for that, the API call belongs behind a small server that holds the key.

## Privacy

Photos, items and saved looks live in this browser's IndexedDB. Nothing is uploaded
anywhere unless you press one of the ✨ buttons:

| Action | What leaves your device |
|---|---|
| Detect clothes with AI | The one photo you're tagging, downscaled to 1400px |
| Ask the AI stylist | A text list of your items — no images |
| Everything else | Nothing |

**Settings → Export closet** writes a JSON backup (items and saved looks, thumbnails
included) that you can import on another device.

## How the pieces fit together

| File | Responsibility |
|---|---|
| `js/catalog.js` | Categories, subtypes, seasons, dress codes, occasions, weather |
| `js/color.js` | Hex → wearable colour name, neutral detection, pair-harmony scoring |
| `js/imaging.js` | Downscaling, cropping, and pulling a palette out of a region |
| `js/store.js` | IndexedDB for photos, items, outfits and settings |
| `js/cropbox.js` | The draggable/resizable selection box |
| `js/vision.js` | Claude vision → garment list (schema-constrained, then sanitised) |
| `js/stylist.js` | The local outfit engine, the Claude stylist, stats and gap analysis |
| `js/app.js` | Views, state and wiring |

No build step, no framework, no dependencies to install — the only external code is the
Anthropic SDK, loaded from a pinned CDN URL when you first use an AI feature.

## Notes on the colour logic

Colour drives most of the recommendations, so it's worth knowing the rules:

- **Neutrals** (black, white, grey, beige, brown, navy) pair with anything and score high
- **Analogous** colours — neighbours on the wheel — are a safe, tonal pairing
- **Complementary** colours score well when muted, lower when both are vivid
- **45–100° apart and both saturated** is the classic clash zone, and gets penalised

Claude's read of a garment's colour is trusted over the raw pixels, since it corrects for
warm indoor lighting and shadow; hand-tagged pieces fall back to sampling the crop.
