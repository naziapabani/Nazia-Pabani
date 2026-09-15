// Reading garments out of a photo.
//
// Two backends, same output. Published as an Artifact, the photo goes to Claude
// through the page's `sample` capability — the viewer's own account, no key.
// Served locally, it goes through the Anthropic SDK with a key from Settings.

import { SEASONS, PATTERNS, CATEGORY_ORDER } from './catalog.js';
import { resizeToBlob, blobToBase64 } from './imaging.js';
import { getSample, sampleLimits, describeSampleError, isHosted } from './capabilities.js';

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@0.125.0';
const MODEL = 'claude-opus-5';

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import(/* @vite-ignore */ SDK_URL)
      .then((mod) => mod.default ?? mod.Anthropic)
      .catch((err) => {
        sdkPromise = null; // let the next attempt retry rather than cache the failure
        throw new Error(`Could not load the Anthropic SDK from ${SDK_URL}. Check your connection — the AI features need it, the rest of the app does not. (${err.message})`);
      });
  }
  return sdkPromise;
}

export async function makeClient(apiKey) {
  const Anthropic = await loadSdk();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * What the AI features can do in this view.
 * @returns {Promise<{ai: boolean, photos: boolean, source: 'claude'|'apiKey'|null}>}
 */
export async function aiStatus(apiKey) {
  const sample = await getSample();
  if (sample) {
    const limits = await sampleLimits();
    return { ai: true, photos: Boolean(limits?.images), source: 'claude' };
  }
  if (apiKey) return { ai: true, photos: true, source: 'apiKey' };
  return { ai: false, photos: false, source: null };
}

const GARMENT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per distinct garment or accessory visible on the person.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short wardrobe label, e.g. "cropped white ribbed tank".' },
          category: { type: 'string', enum: CATEGORY_ORDER },
          subtype: { type: 'string', description: 'More specific garment type, e.g. "denim jacket".' },
          primary_color_hex: { type: 'string', description: 'Hex value of the dominant fabric color, e.g. "#2f3a52".' },
          primary_color_name: { type: 'string' },
          secondary_color_hex: { type: ['string', 'null'], description: 'Hex of a clear second color, or null.' },
          pattern: { type: 'string', enum: PATTERNS },
          material: { type: 'string', description: 'Best guess at the fabric, or "" if unclear.' },
          formality: { type: 'integer', minimum: 1, maximum: 5, description: '1 loungewear, 2 casual, 3 smart casual, 4 dressy, 5 formal.' },
          seasons: { type: 'array', items: { type: 'string', enum: SEASONS } },
          fit: { type: 'string', description: 'e.g. "oversized", "fitted", "straight leg", or "".' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          region: {
            type: 'object',
            description: 'Approximate bounding box of the garment as fractions of the image, origin top-left.',
            properties: {
              x: { type: 'number', minimum: 0, maximum: 1 },
              y: { type: 'number', minimum: 0, maximum: 1 },
              width: { type: 'number', minimum: 0, maximum: 1 },
              height: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['x', 'y', 'width', 'height'],
            additionalProperties: false,
          },
          notes: { type: 'string', description: 'Anything worth remembering: details, hardware, condition, styling.' },
        },
        required: ['name', 'category', 'subtype', 'primary_color_hex', 'primary_color_name',
          'secondary_color_hex', 'pattern', 'material', 'formality', 'seasons', 'fit',
          'confidence', 'region', 'notes'],
        additionalProperties: false,
      },
    },
    photo_notes: { type: 'string', description: 'One line about the photo itself — lighting, angle, anything obscured.' },
  },
  required: ['items', 'photo_notes'],
  additionalProperties: false,
};

const RULES = `Identify every garment and accessory the person is WEARING or clearly holding.

- One entry per garment. A two-piece set is two entries. Do not invent items you cannot see.
- Skip anything that is not clothing: furniture, other people's clothes, pets, the room.
- Skip garments more than about 80% hidden — an unidentifiable sliver is not worth cataloguing.
- primary_color_hex is the colour of the FABRIC as it would look in neutral daylight, corrected for a warm or dim room. Never sample skin, hair or background.
- region is the tight bounding box of the garment itself, as fractions of the image (x, y from the top-left corner). For a mirror selfie where the phone covers part of a top, still box the whole garment.
- name should read like something the owner would call it in their own closet, not a product listing.
- confidence reflects how sure you are the item is what you say it is, including how much of it you can actually see.`;

const SYSTEM_PROMPT = `You catalogue clothing for a personal wardrobe app.

The user uploads mirror selfies, photos taken by other people, and flat-lay shots. ${RULES}`;

/** The `sample` capability has no schema enforcement, so the shape goes in the prompt. */
const SAMPLE_PROMPT = `You catalogue clothing for a personal wardrobe app. Look at the attached photo of a person and ${RULES.charAt(0).toLowerCase()}${RULES.slice(1)}

Reply with ONLY a JSON object of this shape, no other text:

{
  "photo_notes": "one line about the photo itself — lighting, angle, anything obscured",
  "items": [
    {
      "name": "cropped white ribbed tank",
      "category": one of ${CATEGORY_ORDER.map((c) => `"${c}"`).join(', ')},
      "subtype": "tank top",
      "primary_color_hex": "#F5F5F4",
      "primary_color_name": "off-white",
      "secondary_color_hex": null,
      "pattern": one of ${PATTERNS.map((p) => `"${p}"`).join(', ')},
      "material": "cotton",
      "formality": 1-5 where 1 is loungewear, 2 casual, 3 smart casual, 4 dressy, 5 formal,
      "seasons": any of ${SEASONS.map((s) => `"${s}"`).join(', ')},
      "fit": "fitted",
      "confidence": 0.0-1.0,
      "region": {"x": 0.26, "y": 0.15, "width": 0.48, "height": 0.31},
      "notes": "ribbed knit, scoop neck"
    }
  ]
}`;

/** Anything that comes back from the model is untrusted input for our UI, so clamp it. */
function sanitizeDetected(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const category = CATEGORY_ORDER.includes(source.category) ? source.category : 'top';
  const hex = /^#[0-9a-f]{6}$/i.test(source.primary_color_hex || '') ? source.primary_color_hex : null;
  const secondary = /^#[0-9a-f]{6}$/i.test(source.secondary_color_hex || '') ? source.secondary_color_hex : null;
  const seasons = Array.isArray(source.seasons) ? source.seasons.filter((s) => SEASONS.includes(s)) : [];
  return {
    name: String(source.name || 'Untitled piece').slice(0, 80),
    category,
    subtype: String(source.subtype || '').slice(0, 60),
    primaryHex: hex,
    primaryColorName: String(source.primary_color_name || '').slice(0, 40),
    secondaryHex: secondary,
    pattern: PATTERNS.includes(source.pattern) ? source.pattern : 'solid',
    material: String(source.material || '').slice(0, 40),
    formality: Math.min(5, Math.max(1, Math.round(Number(source.formality) || 2))),
    seasons: seasons.length ? seasons : ['spring', 'summer', 'fall'],
    fit: String(source.fit || '').slice(0, 40),
    confidence: Math.min(1, Math.max(0, Number(source.confidence) || 0.5)),
    region: source.region && typeof source.region === 'object' ? {
      x: Number(source.region.x), y: Number(source.region.y),
      width: Number(source.region.width), height: Number(source.region.height),
    } : null,
    notes: String(source.notes || '').slice(0, 300),
  };
}

const shapeResult = (parsed) => ({
  items: (Array.isArray(parsed?.items) ? parsed.items : []).map(sanitizeDetected),
  photoNotes: String(parsed?.photo_notes || ''),
});

/**
 * Send one photo to Claude and get back the garments it contains.
 * @param {object} opts { img (HTMLImageElement), apiKey, signal, onProgress }
 * @returns {Promise<{items: Array, photoNotes: string}>}
 */
export async function detectGarments({ img, apiKey, signal }) {
  // 1400px on the long edge keeps garment detail while staying small on the wire.
  const blob = await resizeToBlob(img, 1400, 0.85, 'image/jpeg');

  const sample = await getSample();
  if (sample) {
    const limits = await sampleLimits();
    if (!limits?.images) throw new Error('This view cannot send photos to Claude. You can still tag pieces by hand.');
    try {
      const parsed = await sample.json(SAMPLE_PROMPT, {
        images: [blob],
        modelTier: 'complex',
        signal,
        cache: false,
      });
      return shapeResult(parsed);
    } catch (err) {
      throw describeSampleError(err);
    }
  }

  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use auto-detect.');
  const client = await makeClient(apiKey);
  const data = await blobToBase64(blob);

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: GARMENT_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: 'Catalogue every garment and accessory this person is wearing.' },
        ],
      }],
    }, { signal });
  } catch (err) {
    throw describeApiError(err);
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to analyse this photo. Try a different image.');
  }

  const text = response.content.find((block) => block.type === 'text')?.text ?? '';
  try {
    return shapeResult(JSON.parse(text));
  } catch {
    throw new Error('Got an unexpected response from Claude — try that photo again.');
  }
}

/** Turn SDK/network failures into something worth showing a person. */
export function describeApiError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 401) return new Error('That API key was rejected. Check it in Settings.');
  if (status === 403) return new Error('This key is not allowed to call the Messages API.');
  if (status === 429) return new Error('Rate limited by the API. Wait a moment and try again.');
  if (status === 400 && /credit|billing/i.test(err?.message || '')) {
    return new Error('The API account needs credit before it can run requests.');
  }
  if (status >= 500) return new Error('The API had a server error. Try again shortly.');
  if (err?.name === 'AbortError') return err;
  if (/fetch|network|Failed to fetch|Load failed/i.test(err?.message || '')) {
    return new Error(isHosted()
      ? 'Could not reach Claude. Try again in a moment.'
      : 'Could not reach the API. Check your connection — and note this page must be served over http://, not opened as a file://.');
  }
  return err instanceof Error ? err : new Error(String(err));
}
