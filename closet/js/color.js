// Color math: naming, neutrality and pair harmony. Everything the stylist knows
// about color lives here so the scoring stays explainable.

export function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(r, g, b) {
  const to = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : { h: 0, s: 0, l: 0.5 };
}

/** Color families used for filtering and for harmony rules. */
export const FAMILIES = [
  'black', 'white', 'grey', 'beige', 'brown', 'navy',
  'red', 'pink', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'purple',
];

const NEUTRAL_FAMILIES = new Set(['black', 'white', 'grey', 'beige', 'brown', 'navy']);

/**
 * Turn a hex value into a wearable color name plus the family it belongs to.
 * Returns { name, family, isNeutral }.
 */
export function describeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { name: 'unknown', family: 'grey', isNeutral: true };
  const { h, s, l } = rgbToHsl(rgb);

  if (l <= 0.11) return named('black', 'black');
  if (l >= 0.93 && s <= 0.14) return named('white', 'white');
  if (s <= 0.10) {
    if (l < 0.30) return named('charcoal', 'grey');
    if (l < 0.62) return named('grey', 'grey');
    return named('light grey', 'grey');
  }

  // Warm low-saturation tones read as the neutral family, not as orange.
  if (h >= 15 && h < 55 && s <= 0.40 && l >= 0.62) return named(l > 0.80 ? 'cream' : 'beige', 'beige');
  if (h >= 10 && h < 50 && l < 0.42) return named(l < 0.26 ? 'chocolate' : 'brown', 'brown');
  if (h >= 15 && h < 45 && s <= 0.55 && l < 0.62) return named('tan', 'brown');
  if (h >= 200 && h < 250 && l < 0.34) return named('navy', 'navy');

  if (h < 15 || h >= 345) {
    if (l < 0.30) return named('burgundy', 'red');
    if (s < 0.45 && l > 0.65) return named('dusty rose', 'pink');
    return named(l > 0.70 ? 'coral' : 'red', 'red');
  }
  if (h < 45) return named(l > 0.65 ? 'peach' : 'orange', 'orange');
  if (h < 70) {
    if (l < 0.45) return named('olive', 'olive');
    return named(s > 0.6 ? 'yellow' : 'mustard', 'yellow');
  }
  if (h < 100) return named(l < 0.45 ? 'olive' : 'lime', l < 0.45 ? 'olive' : 'green');
  if (h < 155) return named(l < 0.32 ? 'forest green' : (s < 0.35 ? 'sage' : 'green'), 'green');
  if (h < 195) return named(l < 0.35 ? 'deep teal' : 'teal', 'teal');
  if (h < 250) {
    if (l > 0.75) return named('sky blue', 'blue');
    if (s < 0.40) return named('denim blue', 'blue');
    return named('blue', 'blue');
  }
  if (h < 290) return named(l < 0.35 ? 'plum' : 'purple', 'purple');
  if (h < 330) return named(l < 0.35 ? 'plum' : 'magenta', 'purple');
  return named(l > 0.70 ? 'blush' : 'pink', 'pink');

  function named(name, family) {
    return { name, family, isNeutral: NEUTRAL_FAMILIES.has(family) };
  }
}

export function isNeutralFamily(family) {
  return NEUTRAL_FAMILIES.has(family);
}

/** Smallest angle between two hues, 0–180. */
function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Score how well two colors sit together: -1 (clashing) to 1 (made for each other).
 * Returns { score, reason }.
 */
export function pairHarmony(hexA, hexB) {
  const a = describeColor(hexA);
  const b = describeColor(hexB);
  const ha = hexToHsl(hexA);
  const hb = hexToHsl(hexB);

  if (a.isNeutral && b.isNeutral) {
    if ((a.family === 'black' && b.family === 'white') || (a.family === 'white' && b.family === 'black')) {
      return { score: 0.9, reason: 'black and white is a clean, high-contrast base' };
    }
    return { score: 0.75, reason: `${a.name} and ${b.name} are both neutrals, so they never fight` };
  }
  if (a.isNeutral || b.isNeutral) {
    const color = a.isNeutral ? b : a;
    const neutral = a.isNeutral ? a : b;
    return { score: 0.8, reason: `${neutral.name} lets the ${color.name} do the talking` };
  }

  const dist = hueDistance(ha.h, hb.h);
  const bothVivid = ha.s > 0.45 && hb.s > 0.45;

  if (dist <= 20) return { score: 0.6, reason: `tonal ${a.name} and ${b.name} — a monochrome-ish pairing` };
  if (dist <= 45) return { score: 0.7, reason: `${a.name} and ${b.name} are neighbours on the color wheel` };
  if (dist >= 150) {
    return bothVivid
      ? { score: 0.45, reason: `${a.name} against ${b.name} is a bold complementary hit` }
      : { score: 0.65, reason: `${a.name} and ${b.name} are complementary but muted enough to wear` };
  }
  if (dist >= 100 && dist < 150) {
    return bothVivid
      ? { score: 0.1, reason: `${a.name} and ${b.name} are a loud, deliberate combination` }
      : { score: 0.4, reason: `${a.name} and ${b.name} work because both are softened` };
  }
  // 45–100 degrees apart with real saturation is the classic clash zone.
  return bothVivid
    ? { score: -0.5, reason: `${a.name} next to ${b.name} tends to clash` }
    : { score: 0.25, reason: `${a.name} and ${b.name} are close enough in tone to pass` };
}

/** Readable text color for a swatch background. */
export function contrastInk(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#1a1a1a';
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}
