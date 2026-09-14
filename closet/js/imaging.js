// Canvas work: loading, downscaling, cropping and pulling a palette out of a region.

import { rgbToHex, rgbToHsl } from './color.js';

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image file.'));
    img.src = src;
  });
}

export async function loadImageFromBlob(blob) {
  // The URL is deliberately not revoked: photo thumbnails re-use img.src for the
  // life of the session, and a revoked URL silently renders as a broken image.
  const img = await loadImage(URL.createObjectURL(blob));
  if (img.decode) { try { await img.decode(); } catch { /* already decoded */ } }
  return img;
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** Downscale an image so its longest edge is at most maxEdge. Returns a Blob. */
export function resizeToBlob(img, maxEdge = 1400, quality = 0.85, type = 'image/jpeg') {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = canvasOf(img.naturalWidth * scale, img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not encode the image.'));
    reader.readAsDataURL(blob);
  });
}

/** Clamp a normalized region to the image and give it a little breathing room. */
export function normalizeRegion(region, pad = 0.02) {
  const r = region || {};
  let x = Number(r.x), y = Number(r.y), w = Number(r.width), h = Number(r.height);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0.01 || h <= 0.01 || w > 1.2 || h > 1.2) return null;
  x = Math.max(0, x - pad);
  y = Math.max(0, y - pad);
  w = Math.min(1 - x, w + pad * 2);
  h = Math.min(1 - y, h + pad * 2);
  if (w <= 0.01 || h <= 0.01) return null;
  return { x, y, width: w, height: h };
}

/** Crop a normalized region out of an image and return a JPEG data URL thumbnail. */
export function cropToDataUrl(img, region, maxEdge = 480, quality = 0.82) {
  const r = normalizeRegion(region, 0) || { x: 0, y: 0, width: 1, height: 1 };
  const sx = r.x * img.naturalWidth;
  const sy = r.y * img.naturalHeight;
  const sw = r.width * img.naturalWidth;
  const sh = r.height * img.naturalHeight;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = canvasOf(sw * scale, sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Dominant colors inside a region, most common first.
 * Samples the middle 80% of the crop so the background edge doesn't win.
 */
export function paletteFromRegion(img, region, count = 3) {
  const r = normalizeRegion(region, 0) || { x: 0, y: 0, width: 1, height: 1 };
  const inset = 0.10;
  const sx = (r.x + r.width * inset) * img.naturalWidth;
  const sy = (r.y + r.height * inset) * img.naturalHeight;
  const sw = Math.max(1, r.width * (1 - inset * 2) * img.naturalWidth);
  const sh = Math.max(1, r.height * (1 - inset * 2) * img.naturalHeight);

  const size = 48;
  const canvas = canvasOf(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

  let data;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return []; // tainted canvas — only possible for cross-origin sources
  }

  // Bucket into a coarse RGB grid, then merge buckets that are visually close.
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 200) continue;
    const r8 = data[i], g8 = data[i + 1], b8 = data[i + 2];
    const key = `${r8 >> 4}-${g8 >> 4}-${b8 >> 4}`;
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r8; bucket.g += g8; bucket.b += b8; bucket.n += 1;
    buckets.set(key, bucket);
  }

  const total = [...buckets.values()].reduce((sum, b) => sum + b.n, 0) || 1;
  const candidates = [...buckets.values()]
    .map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, weight: b.n / total }))
    .sort((a, b) => b.weight - a.weight);

  const picked = [];
  for (const c of candidates) {
    const tooClose = picked.some((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < 46);
    if (tooClose) {
      const match = picked.find((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) < 46);
      match.weight += c.weight;
      continue;
    }
    picked.push({ ...c });
    if (picked.length >= count * 2) break;
  }

  // Prefer colors with some presence; a 3% sliver is usually a shadow.
  return picked
    .filter((c, i) => i === 0 || c.weight >= 0.06)
    .slice(0, count)
    .map((c) => ({
      hex: rgbToHex(c.r, c.g, c.b),
      weight: Number(c.weight.toFixed(3)),
      hsl: rgbToHsl({ r: c.r, g: c.g, b: c.b }),
    }));
}
