// Claude vision: look at a photo of an outfit and pull out the individual garments.
//
// Runs entirely in the browser, which means the API key is exposed to any script
// on the page. That's an acceptable trade for a personal, locally-served app —
// it is not safe for anything you deploy publicly. See README.md.

import { SEASONS, PATTERNS, CATEGORY_ORDER } from './catalog.js';
import { resizeToBlob, blobToBase64 } from './imaging.js';

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

const SYSTEM_PROMPT = `You catalogue clothing for a personal wardrobe app.

The user uploads mirror selfies, photos taken by other people, and flat-lay shots. Identify every garment and accessory the person is WEARING or clearly holding.

Rules:
- One entry per garment. A two-piece set is two entries. Do not invent items you cannot see.
- Skip anything that is not clothing: furniture, other people's clothes, pets, the room.
- Skip garments that are more than about 80% hidden — an unidentifiable sliver is not worth cataloguing.
- primary_color_hex must be the color of the FABRIC as it would look in neutral daylight, corrected for a warm or dim room. Never sample skin, hair, or background.
- region is the tight bounding box of the garment itself, as fractions of the image (x, y from the top-left corner). For a mirror selfie where the phone covers part of a top, still box the whole garment.
- name should read like something the owner would call it in their own closet, not a product listing.
- confidence reflects how sure you are the item is what you say it is, including how much of it you can actually see.`;

/** Anything that comes back from the model is untrusted input for our UI, so clamp it. */
function sanitizeDetected(raw) {
  const category = CATEGORY_ORDER.includes(raw.category) ? raw.category : 'top';
  const hex = /^#[0-9a-f]{6}$/i.test(raw.primary_color_hex || '') ? raw.primary_color_hex : null;
  const secondary = /^#[0-9a-f]{6}$/i.test(raw.secondary_color_hex || '') ? raw.secondary_color_hex : null;
  const seasons = Array.isArray(raw.seasons) ? raw.seasons.filter((s) => SEASONS.includes(s)) : [];
  return {
    name: String(raw.name || 'Untitled piece').slice(0, 80),
    category,
    subtype: String(raw.subtype || '').slice(0, 60),
    primaryHex: hex,
    primaryColorName: String(raw.primary_color_name || '').slice(0, 40),
    secondaryHex: secondary,
    pattern: PATTERNS.includes(raw.pattern) ? raw.pattern : 'solid',
    material: String(raw.material || '').slice(0, 40),
    formality: Math.min(5, Math.max(1, Math.round(Number(raw.formality) || 2))),
    seasons: seasons.length ? seasons : ['spring', 'summer', 'fall'],
    fit: String(raw.fit || '').slice(0, 40),
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.5)),
    region: raw.region && typeof raw.region === 'object' ? {
      x: Number(raw.region.x), y: Number(raw.region.y),
      width: Number(raw.region.width), height: Number(raw.region.height),
    } : null,
    notes: String(raw.notes || '').slice(0, 300),
  };
}

/**
 * Send one photo to Claude and get back the garments it contains.
 * @param {object} opts { apiKey, img (HTMLImageElement), signal }
 * @returns {Promise<{items: Array, photoNotes: string}>}
 */
export async function detectGarments({ apiKey, img, signal }) {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use auto-detect.');

  const client = await makeClient(apiKey);
  // 1400px on the long edge keeps garment detail while staying well inside the
  // 5MB-per-image request limit.
  const blob = await resizeToBlob(img, 1400, 0.85, 'image/jpeg');
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
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Got an unexpected response from Claude — try that photo again.');
  }

  return {
    items: (parsed.items || []).map(sanitizeDetected),
    photoNotes: String(parsed.photo_notes || ''),
  };
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
    return new Error('Could not reach the API. Check your connection — and note this page must be served over http://, not opened as a file://.');
  }
  return err instanceof Error ? err : new Error(String(err));
}
