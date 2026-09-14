// Outfit recommendations. Two engines:
//   buildOutfits() — always available, scores real combinations from your closet
//   askStylist()   — sends the closet inventory (text only) to Claude for picks
//                    with reasoning, plus a read on what the closet is missing.

import { pairHarmony, describeColor } from './color.js';
import { occasion as getOccasion, weather as getWeather, categoryLabel } from './catalog.js';
import { makeClient, describeApiError } from './vision.js';

const MODEL = 'claude-opus-5';

const WEIGHTS = { color: 38, formality: 24, season: 16, pattern: 10, freshness: 8, favorite: 4 };
const BOLD_PATTERNS = new Set(['plaid', 'floral', 'animal print', 'graphic', 'polka dot', 'striped']);

const primaryHex = (item) => item?.colors?.[0]?.hex ?? '#8a8a8a';
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : 999);

/* ---------------- local engine ---------------- */

function seasonFit(item, seasons) {
  if (!item.seasons?.length) return 0.5;
  return item.seasons.some((s) => seasons.includes(s)) ? 1 : 0;
}

/** How well a single item suits the brief, used to shortlist before combining. */
function itemFit(item, targetFormality, seasons) {
  const formalityGap = Math.abs((item.formality || 2) - targetFormality);
  return (
    seasonFit(item, seasons) * 0.4 +
    Math.max(0, 1 - formalityGap / 3) * 0.4 +
    Math.min(1, daysSince(item.lastWorn) / 21) * 0.15 +
    (item.favorite ? 0.05 : 0)
  );
}

function shortlist(items, category, targetFormality, seasons, max) {
  return items
    .filter((item) => item.category === category)
    .map((item) => ({ item, fit: itemFit(item, targetFormality, seasons) }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, max)
    .map((entry) => entry.item);
}

function scoreOutfit(pieces, { targetFormality, seasons }) {
  const reasons = [];

  // Color: every meaningful pair, with the hero pair (first two garments) called out.
  const garments = pieces.filter((p) => ['top', 'bottom', 'dress', 'outerwear', 'shoes'].includes(p.category));
  let colorTotal = 0;
  let colorPairs = 0;
  let heroReason = '';
  for (let i = 0; i < garments.length; i += 1) {
    for (let j = i + 1; j < garments.length; j += 1) {
      const harmony = pairHarmony(primaryHex(garments[i]), primaryHex(garments[j]));
      colorTotal += harmony.score;
      colorPairs += 1;
      if (!heroReason && i === 0 && j === 1) heroReason = harmony.reason;
    }
  }
  const colorScore = colorPairs ? (colorTotal / colorPairs + 1) / 2 : 0.6;
  if (heroReason) reasons.push(heroReason.charAt(0).toUpperCase() + heroReason.slice(1));

  // Formality: tight spread, landing near the occasion's level.
  const levels = pieces.map((p) => p.formality || 2);
  const spread = Math.max(...levels) - Math.min(...levels);
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  const formalityScore = Math.max(0, 1 - spread / 3.5) * 0.6 + Math.max(0, 1 - Math.abs(avg - targetFormality) / 3) * 0.4;
  if (spread <= 1) reasons.push('Everything sits at the same dress code, so nothing looks out of place');
  else if (spread >= 3) reasons.push('Mixes very casual and very dressy pieces — deliberate, but it is a choice');

  // Season / weather.
  const seasonScore = pieces.reduce((sum, p) => sum + seasonFit(p, seasons), 0) / pieces.length;
  if (seasonScore === 1) reasons.push(`Every piece is right for ${seasons.join(' / ')} weather`);

  // Pattern: one statement print is styling, two is noise.
  const bold = pieces.filter((p) => BOLD_PATTERNS.has(p.pattern));
  const patternScore = bold.length === 0 ? 0.85 : bold.length === 1 ? 1 : Math.max(0, 1 - (bold.length - 1) * 0.5);
  if (bold.length === 1) reasons.push(`The ${bold[0].pattern} ${bold[0].subtype || bold[0].category} is the one print, so it stays the focus`);
  if (bold.length > 1) reasons.push('Two prints competing — swap one for a solid if it feels busy');

  // Freshness: nudge toward things you have not reached for lately.
  const freshness = pieces.reduce((sum, p) => sum + Math.min(1, daysSince(p.lastWorn) / 21), 0) / pieces.length;
  const neglected = pieces.filter((p) => p.wearCount === 0);
  if (neglected.length) reasons.push(`Gets ${neglected.length === 1 ? 'a piece' : `${neglected.length} pieces`} you have never worn into rotation`);

  const favoriteShare = pieces.filter((p) => p.favorite).length / pieces.length;

  const score =
    colorScore * WEIGHTS.color +
    formalityScore * WEIGHTS.formality +
    seasonScore * WEIGHTS.season +
    patternScore * WEIGHTS.pattern +
    freshness * WEIGHTS.freshness +
    favoriteShare * WEIGHTS.favorite;

  return { score: Math.round(score), reasons: reasons.slice(0, 4) };
}

/**
 * Build and rank real outfits from the closet.
 * @param {Array} items closet items
 * @param {object} opts { occasionId, weatherId, limit, mustIncludeId }
 */
export function buildOutfits(items, { occasionId = 'everyday', weatherId = 'mild', limit = 8, mustIncludeId = null } = {}) {
  const occ = getOccasion(occasionId);
  const wx = getWeather(weatherId);
  const targetFormality = occ.formality;
  const seasons = wx.seasons;

  const tops = shortlist(items, 'top', targetFormality, seasons, 9);
  const bottoms = shortlist(items, 'bottom', targetFormality, seasons, 9);
  const dresses = shortlist(items, 'dress', targetFormality, seasons, 6);
  const shoes = shortlist(items, 'shoes', targetFormality, seasons, 6);
  const outerwear = wx.maxLayers > 0 ? shortlist(items, 'outerwear', targetFormality, seasons, 5) : [];
  const bags = shortlist(items, 'bag', targetFormality, seasons, 3);

  const bases = [];
  for (const top of tops) for (const bottom of bottoms) bases.push([top, bottom]);
  for (const dress of dresses) bases.push([dress]);
  if (!bases.length) return [];

  const shoeOptions = shoes.length ? shoes : [null];
  const layerOptions = wx.maxLayers === 2 && outerwear.length ? outerwear : [null, ...outerwear];

  const candidates = [];
  for (const base of bases) {
    for (const shoe of shoeOptions) {
      for (const layer of layerOptions) {
        const pieces = [...base, shoe, layer].filter(Boolean);
        if (mustIncludeId && !pieces.some((p) => p.id === mustIncludeId)) continue;
        const { score, reasons } = scoreOutfit(pieces, { targetFormality, seasons });
        candidates.push({ pieces, score, reasons });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Spread the results: no single piece should carry every suggestion.
  const usage = new Map();
  const picked = [];
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    const overused = candidate.pieces.some((p) => (usage.get(p.id) || 0) >= 2);
    if (overused) continue;
    candidate.pieces.forEach((p) => usage.set(p.id, (usage.get(p.id) || 0) + 1));

    // A bag is a finishing touch, not part of the ranking — attach the best match.
    const bag = bags.find((b) => b.formality >= (occ.formality - 1)) || bags[0] || null;
    picked.push({
      id: `local_${picked.length}_${candidate.pieces.map((p) => p.id).join('_')}`,
      source: 'engine',
      items: candidate.pieces,
      extras: bag ? [bag] : [],
      score: candidate.score,
      reasons: candidate.reasons,
      occasionId,
      weatherId,
    });
  }
  return picked;
}

/** What the closet cannot do yet — pure counting, no model needed. */
export function closetGaps(items) {
  const gaps = [];
  const byCategory = (cat) => items.filter((i) => i.category === cat);
  const neutralsIn = (cat) => byCategory(cat).filter((i) => describeColor(primaryHex(i)).isNeutral);

  if (!byCategory('shoes').length) gaps.push('No shoes catalogued yet — outfits are built without them.');
  if (byCategory('top').length && !byCategory('bottom').length && !byCategory('dress').length) {
    gaps.push('Plenty of tops but nothing to wear them with. Add bottoms to unlock full outfits.');
  }
  if (byCategory('bottom').length >= 3 && neutralsIn('bottom').length === 0) {
    gaps.push('Every bottom is a colour. One neutral pair (black, denim, cream) would multiply your combinations.');
  }
  if (byCategory('outerwear').length === 0 && items.length >= 6) {
    gaps.push('No outerwear, so cold-weather suggestions will be thin.');
  }
  const dressy = items.filter((i) => (i.formality || 2) >= 4);
  if (items.length >= 10 && dressy.length <= 1) {
    gaps.push('Almost everything is casual — there is little here for a dressy occasion.');
  }
  const unworn = items.filter((i) => i.wearCount === 0);
  if (unworn.length >= 5) gaps.push(`${unworn.length} pieces have never been logged as worn.`);
  return gaps;
}

/* ---------------- Claude stylist ---------------- */

/** Compact, text-only view of the closet. No images, so the call stays cheap. */
function inventoryFor(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    subtype: item.subtype,
    colors: (item.colors || []).map((c) => c.name || c.hex).filter(Boolean),
    pattern: item.pattern,
    material: item.material,
    formality: item.formality,
    seasons: item.seasons,
    fit: item.fit,
    tags: item.tags,
    wear_count: item.wearCount,
    days_since_worn: item.lastWorn ? Math.round(daysSince(item.lastWorn)) : null,
    favorite: item.favorite,
  }));
}

const OUTFIT_SCHEMA = {
  type: 'object',
  properties: {
    outfits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'A short name for the look.' },
          item_ids: { type: 'array', items: { type: 'string' }, description: 'ids from the inventory, in wearing order.' },
          why: { type: 'string', description: 'Two sentences on why these pieces work together.' },
          styling_tip: { type: 'string', description: 'One concrete adjustment: tuck, cuff, layer, swap.' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['name', 'item_ids', 'why', 'styling_tip', 'confidence'],
        additionalProperties: false,
      },
    },
    closet_note: { type: 'string', description: 'One honest observation about the closet as a whole.' },
    missing_piece: { type: 'string', description: 'The single item that would unlock the most new outfits.' },
  },
  required: ['outfits', 'closet_note', 'missing_piece'],
  additionalProperties: false,
};

const STYLIST_SYSTEM = `You are a personal stylist working from a catalogue of clothes someone actually owns.

Rules:
- Only use item ids present in the inventory. Never invent a piece.
- Every outfit must be wearable: a top and a bottom, or a one-piece. Add shoes when the closet has them, and outerwear when the weather calls for it.
- Suggest genuinely different outfits — not one look with the shoes swapped.
- Favour pieces that have not been worn recently when the result is just as good.
- "why" is specific about colour, proportion, or texture. No filler like "this is a great look".
- If the closet cannot support the occasion, say so plainly in closet_note and suggest the closest workable thing rather than forcing it.`;

/**
 * Ask Claude for outfit ideas from the real closet.
 * @returns {Promise<{outfits: Array, closetNote: string, missingPiece: string}>}
 */
export async function askStylist({ apiKey, items, occasionId, weatherId, note = '', count = 4, signal }) {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use the AI stylist.');
  if (!items.length) throw new Error('Add some clothes to the closet first.');

  const occ = getOccasion(occasionId);
  const wx = getWeather(weatherId);
  const client = await makeClient(apiKey);

  const prompt = [
    `Occasion: ${occ.label} (target dress code ${occ.formality}/5, tags: ${occ.tags.join(', ')})`,
    `Weather: ${wx.label}`,
    note ? `Also keep in mind: ${note}` : '',
    `Suggest ${count} outfits.`,
    '',
    'Inventory:',
    JSON.stringify(inventoryFor(items)),
  ].filter(Boolean).join('\n');

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: STYLIST_SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTFIT_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    }, { signal });
  } catch (err) {
    throw describeApiError(err);
  }

  if (response.stop_reason === 'refusal') throw new Error('Claude declined that request.');

  const text = response.content.find((block) => block.type === 'text')?.text ?? '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Got an unexpected response from Claude — try again.');
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const outfits = (parsed.outfits || [])
    .map((outfit, index) => {
      const pieces = (outfit.item_ids || []).map((id) => byId.get(id)).filter(Boolean);
      if (pieces.length < 2) return null; // hallucinated or unwearable
      return {
        id: `ai_${Date.now()}_${index}`,
        source: 'claude',
        name: String(outfit.name || 'Suggested look').slice(0, 60),
        items: pieces,
        extras: [],
        reasons: [String(outfit.why || '')].filter(Boolean),
        tip: String(outfit.styling_tip || ''),
        score: Math.round((Number(outfit.confidence) || 0.7) * 100),
        occasionId,
        weatherId,
      };
    })
    .filter(Boolean);

  return {
    outfits,
    closetNote: String(parsed.closet_note || ''),
    missingPiece: String(parsed.missing_piece || ''),
  };
}

/** Category counts, colour spread and wear stats for the Insights view. */
export function closetStats(items) {
  const byCategory = {};
  const byFamily = {};
  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    const family = item.colors?.[0]?.family || describeColor(primaryHex(item)).family;
    byFamily[family] = (byFamily[family] || 0) + 1;
  }
  const worn = items.filter((i) => i.wearCount > 0);
  const mostWorn = [...items].sort((a, b) => b.wearCount - a.wearCount).slice(0, 5);
  const neglected = [...items]
    .filter((i) => i.wearCount === 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 5);

  return {
    total: items.length,
    byCategory,
    byFamily,
    wornShare: items.length ? worn.length / items.length : 0,
    totalWears: items.reduce((sum, i) => sum + (i.wearCount || 0), 0),
    mostWorn,
    neglected,
    categoryLabels: Object.fromEntries(Object.keys(byCategory).map((c) => [c, categoryLabel(c)])),
  };
}
