// Closet app shell: photo studio, closet grid, outfit views, insights, settings.

import {
  CATEGORY_ORDER, SUBTYPES, PATTERNS, MATERIALS, SEASONS,
  FORMALITY, OCCASIONS, WEATHER, DEFAULT_REGIONS,
  categoryLabel, categoryIcon, formalityLabel,
} from './catalog.js';
import { describeColor, contrastInk, hexToHsl, FAMILIES } from './color.js';
import { loadImageFromBlob, resizeToBlob, cropToDataUrl, paletteFromRegion, normalizeRegion } from './imaging.js';
import * as store from './store.js';
import { createCropBox } from './cropbox.js';
import { detectGarments, aiStatus } from './vision.js';
import { getDownloads, isHosted } from './capabilities.js';
import { buildOutfits, askStylist, closetGaps, closetStats } from './stylist.js';

const KEY_STORAGE = 'closet.apiKey';

const state = {
  view: 'studio',
  items: [],
  photos: [],
  savedOutfits: [],
  activePhotoId: null,
  pending: [],          // detected/manual items awaiting confirmation
  activePendingId: null, // which pending item the crop box is bound to
  suggestions: [],
  stylistNote: '',
  busy: '',
  ai: { ai: false, photos: false, source: null },
  filters: { search: '', category: 'all', family: 'all', season: 'all', favorite: false },
  sort: 'newest',
  brief: { occasionId: 'everyday', weatherId: 'mild', note: '' },
};

const imageCache = new Map(); // photoId -> HTMLImageElement
let cropBox = null;

/* ---------------- tiny helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const uid = () => Math.random().toString(36).slice(2, 10);

function toast(message, tone = 'info') {
  const host = $('#toasts');
  const node = document.createElement('div');
  node.className = `toast toast-${tone}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => { node.classList.add('leaving'); setTimeout(() => node.remove(), 300); }, tone === 'error' ? 6000 : 3200);
}

function getApiKey() {
  return sessionStorage.getItem(KEY_STORAGE) || localStorage.getItem(KEY_STORAGE) || '';
}

function setBusy(message) {
  state.busy = message;
  const bar = $('#busy');
  bar.textContent = message;
  bar.classList.toggle('visible', Boolean(message));
}

async function imageFor(photoId) {
  if (imageCache.has(photoId)) return imageCache.get(photoId);
  const photo = state.photos.find((p) => p.id === photoId) || await store.getPhoto(photoId);
  if (!photo) return null;
  const img = await loadImageFromBlob(photo.blob);
  imageCache.set(photoId, img);
  return img;
}

/* ---------------- boot ---------------- */

async function boot() {
  state.ai = await aiStatus(getApiKey());
  const [items, photos, outfits] = await Promise.all([store.allItems(), store.allPhotos(), store.allOutfits()]);
  state.items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  state.photos = photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  state.savedOutfits = outfits;
  if (state.photos.length) state.activePhotoId = state.photos[0].id;
  if (state.items.length) state.view = 'closet';

  wireChrome();
  render();
}

function wireChrome() {
  $$('.nav-tab').forEach((tab) => tab.addEventListener('click', () => {
    state.view = tab.dataset.view;
    render();
  }));
}

const VIEW_WORDS = { studio: 'Intake', closet: 'Closet', outfits: 'Outfits', insights: 'Insights', settings: 'Settings' };

function render() {
  $$('.nav-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === state.view));
  const edge = $('#edge-word');
  if (edge) edge.textContent = `Niafied ${VIEW_WORDS[state.view] ?? 'Closet'}`;
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${state.view}`));
  const counts = { closet: state.items.length };
  $('#count-closet').textContent = counts.closet ? `${counts.closet}` : '';

  if (state.view === 'studio') renderStudio();
  if (state.view === 'closet') renderCloset();
  if (state.view === 'outfits') renderOutfits();
  if (state.view === 'insights') renderInsights();
  if (state.view === 'settings') renderSettings();
}

/* ================= STUDIO: photos in, garments out ================= */

function renderStudio() {
  const root = $('#view-studio');
  root.innerHTML = `
    <div class="panel">
      <h2>Add photos</h2>
      <p class="hint">Mirror selfies, full-length shots someone took of you, or a flat lay of one piece. Claude reads the photo and lists what you're wearing; you confirm before anything lands in the closet.</p>
      <label class="dropzone" id="dropzone">
        <input type="file" id="file-input" accept="image/*" multiple hidden>
        <span class="dropzone-title">Drop photos here or click to choose</span>
        <span class="dropzone-sub">JPEG, PNG or HEIC-converted images. They stay on this device.</span>
      </label>
    </div>

    ${state.photos.length ? `
      <div class="panel">
        <h2>Your photos</h2>
        <div class="photo-strip" id="photo-strip"></div>
      </div>
      <div class="panel studio-panel" id="studio-panel"></div>
    ` : ''}
  `;

  const input = $('#file-input');
  const zone = $('#dropzone');
  input.addEventListener('change', () => { handleFiles([...input.files]); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragging');
    handleFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
  });

  if (state.photos.length) {
    renderPhotoStrip();
    renderStudioPanel();
  }
}

function renderPhotoStrip() {
  const strip = $('#photo-strip');
  if (!strip) return;
  strip.innerHTML = '';
  for (const photo of state.photos) {
    const button = document.createElement('button');
    button.className = `photo-chip${photo.id === state.activePhotoId ? ' active' : ''}`;
    button.innerHTML = `<img alt="Uploaded photo" loading="lazy"><span class="photo-chip-count">${countItemsForPhoto(photo.id)}</span>`;
    imageFor(photo.id).then((img) => { if (img) button.querySelector('img').src = img.src; });
    button.addEventListener('click', () => {
      state.activePhotoId = photo.id;
      state.pending = [];
      state.activePendingId = null;
      renderStudio();
    });
    strip.appendChild(button);
  }
}

const countItemsForPhoto = (photoId) => state.items.filter((i) => i.photoId === photoId).length;

function detectUnavailableReason() {
  if (state.ai.ai && !state.ai.photos) return 'This view cannot send photos to Claude, so auto-detect is off. Tagging by hand works exactly the same way.';
  return 'Auto-detect needs an Anthropic API key (Settings). Tagging by hand works without one.';
}

async function handleFiles(files) {
  if (!files.length) return;
  setBusy(`Importing ${files.length} photo${files.length > 1 ? 's' : ''}…`);
  try {
    for (const file of files) {
      const original = await loadImageFromBlob(file);
      // Store a downscaled copy: full-resolution phone photos fill up storage fast.
      const blob = await resizeToBlob(original, 1600, 0.88, 'image/jpeg');
      const photo = {
        id: store.newId('photo'),
        blob,
        width: original.naturalWidth,
        height: original.naturalHeight,
        createdAt: new Date().toISOString(),
      };
      await store.savePhoto(photo);
      state.photos.unshift(photo);
      state.activePhotoId = photo.id;
    }
    state.pending = [];
    toast(`Added ${files.length} photo${files.length > 1 ? 's' : ''}.`);
  } catch (err) {
    toast(err.message || 'Could not read that file.', 'error');
  } finally {
    setBusy('');
    renderStudio();
  }
}

function renderStudioPanel() {
  const panel = $('#studio-panel');
  if (!panel || !state.activePhotoId) return;
  const canDetect = state.ai.ai && state.ai.photos;

  panel.innerHTML = `
    <div class="studio-grid">
      <div>
        <div class="studio-stage" id="studio-stage">
          <img id="studio-image" alt="Photo being tagged">
        </div>
        <p class="hint stage-hint" id="stage-hint">Drag on the photo to draw a box around one piece.</p>
      </div>
      <div class="studio-side">
        <div class="studio-actions">
          <button class="btn primary" id="btn-detect" ${canDetect ? '' : 'disabled'}>✨ Find the clothes in this photo</button>
          <button class="btn" id="btn-manual">＋ Tag a piece by hand</button>
          <button class="btn ghost" id="btn-delete-photo">Remove photo</button>
        </div>
        ${canDetect ? '' : `<p class="notice">${esc(detectUnavailableReason())}</p>`}
        <div id="pending-list"></div>
      </div>
    </div>
  `;

  imageFor(state.activePhotoId).then((img) => {
    if (img) $('#studio-image').src = img.src;
  });

  $('#btn-detect').addEventListener('click', runDetection);
  $('#btn-manual').addEventListener('click', addManualPending);
  $('#btn-delete-photo').addEventListener('click', removeActivePhoto);
  renderPending();
}

async function removeActivePhoto() {
  const used = countItemsForPhoto(state.activePhotoId);
  const message = used
    ? `Remove this photo? ${used} closet item${used > 1 ? 's' : ''} came from it — they keep their thumbnails and stay in your closet.`
    : 'Remove this photo?';
  if (!confirm(message)) return;
  await store.deletePhoto(state.activePhotoId);
  imageCache.delete(state.activePhotoId);
  state.photos = state.photos.filter((p) => p.id !== state.activePhotoId);
  state.activePhotoId = state.photos[0]?.id ?? null;
  state.pending = [];
  renderStudio();
}

async function runDetection() {
  const img = await imageFor(state.activePhotoId);
  if (!img) return;
  setBusy('Claude is reading the photo…');
  $('#btn-detect').disabled = true;
  try {
    const { items, photoNotes } = await detectGarments({ img, apiKey: getApiKey() });
    if (!items.length) {
      toast('No clothing found in that photo. Try a fuller shot, or tag by hand.', 'error');
      return;
    }
    state.pending = items.map((detected) => pendingFromDetection(detected, img));
    state.activePendingId = state.pending[0].id;
    if (photoNotes) toast(photoNotes);
    renderPending();
    bindCropBox();
  } catch (err) {
    toast(err.message || 'Detection failed.', 'error');
  } finally {
    setBusy('');
    const button = $('#btn-detect');
    if (button) button.disabled = false;
  }
}

function pendingFromDetection(detected, img) {
  const region = normalizeRegion(detected.region, 0.03) || DEFAULT_REGIONS[detected.category];
  const palette = paletteFromRegion(img, region, 3);
  // Trust Claude's read of the fabric colour; fall back to pixels if it gave none.
  const primary = detected.primaryHex || palette[0]?.hex || '#8a8a8a';
  const described = describeColor(primary);
  return {
    id: `pending_${uid()}`,
    include: true,
    source: 'claude',
    name: detected.name,
    category: detected.category,
    subtype: detected.subtype,
    pattern: detected.pattern,
    material: detected.material,
    formality: detected.formality,
    seasons: detected.seasons,
    fit: detected.fit,
    notes: detected.notes,
    confidence: detected.confidence,
    region,
    colors: [{ hex: primary, name: detected.primaryColorName || described.name, family: described.family }]
      .concat(detected.secondaryHex ? [{ hex: detected.secondaryHex, ...pick(describeColor(detected.secondaryHex)) }] : []),
    thumb: cropToDataUrl(img, region),
  };
}

const pick = ({ name, family }) => ({ name, family });

async function addManualPending() {
  const img = await imageFor(state.activePhotoId);
  if (!img) return;
  const region = DEFAULT_REGIONS.top;
  const palette = paletteFromRegion(img, region, 3);
  const primary = palette[0]?.hex || '#8a8a8a';
  const described = describeColor(primary);
  const entry = {
    id: `pending_${uid()}`,
    include: true,
    source: 'manual',
    name: '',
    category: 'top',
    subtype: '',
    pattern: 'solid',
    material: '',
    formality: 2,
    seasons: ['spring', 'summer', 'fall'],
    fit: '',
    notes: '',
    confidence: null,
    region,
    colors: [{ hex: primary, name: described.name, family: described.family }],
    thumb: cropToDataUrl(img, region),
  };
  state.pending.unshift(entry);
  state.activePendingId = entry.id;
  renderPending();
  bindCropBox();
}

function renderPending() {
  const host = $('#pending-list');
  if (!host) return;
  if (!state.pending.length) {
    host.innerHTML = '';
    return;
  }
  const included = state.pending.filter((p) => p.include).length;
  host.innerHTML = `
    <div class="pending-header">
      <h3>Found ${state.pending.length} piece${state.pending.length > 1 ? 's' : ''}</h3>
      <button class="btn primary" id="btn-save-pending" ${included ? '' : 'disabled'}>Add ${included} to closet</button>
    </div>
    <div class="pending-cards">${state.pending.map(pendingCard).join('')}</div>
  `;

  $('#btn-save-pending').addEventListener('click', savePending);
  $$('.pending-card', host).forEach(wirePendingCard);
}

function pendingCard(entry) {
  const swatch = entry.colors[0];
  const confidence = entry.confidence != null
    ? `<span class="chip ${entry.confidence < 0.55 ? 'chip-warn' : ''}">${Math.round(entry.confidence * 100)}% sure</span>`
    : '<span class="chip">hand-tagged</span>';
  return `
    <div class="pending-card${entry.include ? '' : ' excluded'}${entry.id === state.activePendingId ? ' focused' : ''}" data-id="${entry.id}">
      <div class="pending-top">
        <img class="pending-thumb" src="${entry.thumb}" alt="${esc(entry.name || 'Detected piece')}">
        <div class="pending-head">
          <input class="field-name" data-field="name" value="${esc(entry.name)}" placeholder="Name this piece">
          <div class="pending-meta">
            ${confidence}
            <span class="chip" style="background:${swatch.hex};color:${contrastInk(swatch.hex)}">${esc(swatch.name)}</span>
          </div>
        </div>
        <label class="include-toggle" title="Include in closet">
          <input type="checkbox" data-field="include" ${entry.include ? 'checked' : ''}>
        </label>
      </div>
      <div class="pending-fields">
        <label>Category
          <select data-field="category">
            ${CATEGORY_ORDER.map((c) => `<option value="${c}" ${c === entry.category ? 'selected' : ''}>${categoryLabel(c)}</option>`).join('')}
          </select>
        </label>
        <label>Type
          <input list="subtype-options" data-field="subtype" value="${esc(entry.subtype)}" placeholder="e.g. denim jacket">
        </label>
        <label>Colour
          <input type="color" data-field="color" value="${swatch.hex}">
        </label>
        <label>Dress code
          <select data-field="formality">
            ${FORMALITY.map((f) => `<option value="${f.value}" ${f.value === entry.formality ? 'selected' : ''}>${f.label}</option>`).join('')}
          </select>
        </label>
        <label>Pattern
          <select data-field="pattern">
            ${PATTERNS.map((p) => `<option value="${p}" ${p === entry.pattern ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </label>
        <label>Material
          <input list="material-options" data-field="material" value="${esc(entry.material)}" placeholder="optional">
        </label>
      </div>
      <div class="season-row">
        ${SEASONS.map((s) => `<label class="season-chip${entry.seasons.includes(s) ? ' on' : ''}"><input type="checkbox" data-field="season" value="${s}" ${entry.seasons.includes(s) ? 'checked' : ''}>${s}</label>`).join('')}
      </div>
      <div class="pending-foot">
        <button class="btn tiny" data-action="crop">Adjust crop</button>
        <button class="btn tiny ghost" data-action="drop">Discard</button>
      </div>
    </div>
  `;
}

function wirePendingCard(card) {
  const entry = state.pending.find((p) => p.id === card.dataset.id);
  if (!entry) return;

  card.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    if (state.activePendingId !== entry.id) {
      state.activePendingId = entry.id;
      $$('.pending-card').forEach((el) => el.classList.toggle('focused', el.dataset.id === entry.id));
      bindCropBox();
    }
  });

  $$('[data-field]', card).forEach((input) => {
    input.addEventListener('change', async () => {
      const field = input.dataset.field;
      if (field === 'include') {
        entry.include = input.checked;
        card.classList.toggle('excluded', !entry.include);
        const button = $('#btn-save-pending');
        const included = state.pending.filter((p) => p.include).length;
        button.disabled = !included;
        button.textContent = `Add ${included} to closet`;
        return;
      }
      if (field === 'season') {
        entry.seasons = $$('[data-field="season"]', card).filter((el) => el.checked).map((el) => el.value);
        input.closest('.season-chip').classList.toggle('on', input.checked);
        return;
      }
      if (field === 'color') {
        const described = describeColor(input.value);
        entry.colors[0] = { hex: input.value, name: described.name, family: described.family };
        const chip = $$('.pending-meta .chip', card)[1];
        chip.style.background = input.value;
        chip.style.color = contrastInk(input.value);
        chip.textContent = described.name;
        return;
      }
      if (field === 'category') {
        entry.category = input.value;
        if (entry.source === 'manual' && !entry.userMovedCrop) {
          entry.region = DEFAULT_REGIONS[input.value] || DEFAULT_REGIONS.top;
          await refreshPendingCrop(entry, card);
          if (state.activePendingId === entry.id) bindCropBox();
        }
        return;
      }
      if (field === 'formality') { entry.formality = Number(input.value); return; }
      entry[field] = input.value;
    });
  });

  $('[data-action="crop"]', card).addEventListener('click', () => {
    state.activePendingId = entry.id;
    $$('.pending-card').forEach((el) => el.classList.toggle('focused', el.dataset.id === entry.id));
    bindCropBox();
    $('#studio-stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('[data-action="drop"]', card).addEventListener('click', () => {
    state.pending = state.pending.filter((p) => p.id !== entry.id);
    if (state.activePendingId === entry.id) state.activePendingId = state.pending[0]?.id ?? null;
    renderPending();
    bindCropBox();
  });
}

async function refreshPendingCrop(entry, card) {
  const img = await imageFor(state.activePhotoId);
  if (!img) return;
  entry.thumb = cropToDataUrl(img, entry.region);
  const palette = paletteFromRegion(img, entry.region, 3);
  if (palette[0] && entry.source === 'manual') {
    const described = describeColor(palette[0].hex);
    entry.colors[0] = { hex: palette[0].hex, name: described.name, family: described.family };
  }
  const node = card || $(`.pending-card[data-id="${entry.id}"]`);
  if (!node) return;
  $('.pending-thumb', node).src = entry.thumb;
  const colorInput = $('[data-field="color"]', node);
  if (colorInput) colorInput.value = entry.colors[0].hex;
  const chip = $$('.pending-meta .chip', node)[1];
  if (chip) {
    chip.style.background = entry.colors[0].hex;
    chip.style.color = contrastInk(entry.colors[0].hex);
    chip.textContent = entry.colors[0].name;
  }
}

function bindCropBox() {
  cropBox?.destroy();
  cropBox = null;
  const stage = $('#studio-stage');
  const hint = $('#stage-hint');
  const entry = state.pending.find((p) => p.id === state.activePendingId);
  if (!stage || !entry) {
    if (hint) hint.textContent = 'Drag on the photo to draw a box around one piece.';
    return;
  }
  if (hint) hint.textContent = `Adjusting: ${entry.name || 'new piece'} — drag the box or its corners.`;

  let timer = null;
  cropBox = createCropBox(stage, {
    region: entry.region,
    onChange: (region) => {
      entry.region = region;
      entry.userMovedCrop = true;
      clearTimeout(timer);
      timer = setTimeout(() => refreshPendingCrop(entry), 120);
    },
  });
}

async function savePending() {
  const chosen = state.pending.filter((p) => p.include);
  if (!chosen.length) return;
  setBusy('Saving to closet…');
  try {
    const items = chosen.map((entry) => store.makeItem({
      photoId: state.activePhotoId,
      name: entry.name?.trim() || `${entry.colors[0].name} ${entry.subtype || categoryLabel(entry.category).toLowerCase()}`,
      category: entry.category,
      subtype: entry.subtype,
      colors: entry.colors,
      pattern: entry.pattern,
      material: entry.material,
      formality: entry.formality,
      seasons: entry.seasons,
      fit: entry.fit,
      notes: entry.notes,
      thumb: entry.thumb,
      region: entry.region,
      source: entry.source,
      confidence: entry.confidence,
    }));
    await store.saveItems(items);
    state.items = [...items, ...state.items];
    state.pending = [];
    state.activePendingId = null;
    cropBox?.destroy();
    cropBox = null;
    toast(`Added ${items.length} piece${items.length > 1 ? 's' : ''} to your closet.`);
    state.view = 'closet';
    render();
  } catch (err) {
    toast(err.message || 'Could not save those items.', 'error');
  } finally {
    setBusy('');
  }
}

/* ================= CLOSET ================= */

function visibleItems() {
  const { search, category, family, season, favorite } = state.filters;
  const needle = search.trim().toLowerCase();
  let list = state.items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (family !== 'all' && (item.colors?.[0]?.family || '') !== family) return false;
    if (season !== 'all' && !item.seasons?.includes(season)) return false;
    if (favorite && !item.favorite) return false;
    if (needle) {
      const haystack = [item.name, item.subtype, item.material, item.notes, item.pattern, ...(item.tags || []),
        ...(item.colors || []).map((c) => c.name)].join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const sorters = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
    mostWorn: (a, b) => b.wearCount - a.wearCount || new Date(b.createdAt) - new Date(a.createdAt),
    leastWorn: (a, b) => a.wearCount - b.wearCount || new Date(a.createdAt) - new Date(b.createdAt),
    color: (a, b) => {
      const ha = hexToHsl(a.colors?.[0]?.hex || '#888');
      const hb = hexToHsl(b.colors?.[0]?.hex || '#888');
      const neutral = (h) => (h.s < 0.12 ? 0 : 1);
      return neutral(ha) - neutral(hb) || ha.h - hb.h || ha.l - hb.l;
    },
    formality: (a, b) => b.formality - a.formality,
    category: (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name),
  };
  return list.sort(sorters[state.sort] || sorters.newest);
}

function renderCloset() {
  const root = $('#view-closet');
  if (!state.items.length) {
    root.innerHTML = emptyState('Your closet is empty', 'Upload a photo of yourself and let Claude pull the pieces out of it.', 'Add photos', 'studio');
    wireEmptyState(root);
    return;
  }

  const list = visibleItems();
  const familiesPresent = FAMILIES.filter((f) => state.items.some((i) => i.colors?.[0]?.family === f));

  root.innerHTML = `
    <div class="panel toolbar">
      <input id="search" class="search" type="search" placeholder="Search your closet…" value="${esc(state.filters.search)}">
      <div class="toolbar-row">
        <select id="filter-category">
          <option value="all">All categories</option>
          ${CATEGORY_ORDER.filter((c) => state.items.some((i) => i.category === c))
            .map((c) => `<option value="${c}" ${state.filters.category === c ? 'selected' : ''}>${categoryIcon(c)} ${categoryLabel(c)}</option>`).join('')}
        </select>
        <select id="filter-family">
          <option value="all">All colours</option>
          ${familiesPresent.map((f) => `<option value="${f}" ${state.filters.family === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
        <select id="filter-season">
          <option value="all">All seasons</option>
          ${SEASONS.map((s) => `<option value="${s}" ${state.filters.season === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="sort">
          ${[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A–Z'], ['category', 'By category'],
             ['color', 'By colour'], ['formality', 'Dressiest first'], ['mostWorn', 'Most worn'], ['leastWorn', 'Least worn']]
            .map(([value, label]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <label class="switch"><input type="checkbox" id="filter-favorite" ${state.filters.favorite ? 'checked' : ''}> ★ Favourites</label>
      </div>
      <p class="result-count">${list.length} of ${state.items.length} pieces</p>
    </div>
    <div class="item-grid">${list.map(itemCard).join('') || '<p class="hint">Nothing matches those filters.</p>'}</div>
  `;

  const search = $('#search');
  search.addEventListener('input', () => {
    state.filters.search = search.value;
    const list2 = visibleItems();
    $('.item-grid').innerHTML = list2.map(itemCard).join('') || '<p class="hint">Nothing matches those filters.</p>';
    $('.result-count').textContent = `${list2.length} of ${state.items.length} pieces`;
    wireItemCards();
  });
  $('#filter-category').addEventListener('change', (e) => { state.filters.category = e.target.value; renderCloset(); });
  $('#filter-family').addEventListener('change', (e) => { state.filters.family = e.target.value; renderCloset(); });
  $('#filter-season').addEventListener('change', (e) => { state.filters.season = e.target.value; renderCloset(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderCloset(); });
  $('#filter-favorite').addEventListener('change', (e) => { state.filters.favorite = e.target.checked; renderCloset(); });
  wireItemCards();
}

function itemCard(item) {
  const color = item.colors?.[0] ?? { hex: '#888', name: '' };
  const worn = item.wearCount ? `${item.wearCount}×` : 'unworn';
  return `
    <article class="item-card" data-id="${item.id}">
      <div class="item-thumb">
        ${item.thumb ? `<img src="${item.thumb}" alt="${esc(item.name)}" loading="lazy">` : `<span class="item-placeholder">${categoryIcon(item.category)}</span>`}
        <button class="fav${item.favorite ? ' on' : ''}" data-action="fav" title="Favourite">★</button>
      </div>
      <div class="item-body">
        <h3>${esc(item.name)}</h3>
        <p class="item-sub">${esc(item.subtype || categoryLabel(item.category))} · ${esc(formalityLabel(item.formality))}</p>
        <div class="item-chips">
          <span class="chip" style="background:${color.hex};color:${contrastInk(color.hex)}">${esc(color.name)}</span>
          <span class="chip subtle">${worn}</span>
        </div>
      </div>
    </article>
  `;
}

function wireItemCards() {
  $$('.item-card').forEach((card) => {
    const item = state.items.find((i) => i.id === card.dataset.id);
    if (!item) return;
    $('[data-action="fav"]', card).addEventListener('click', async (event) => {
      event.stopPropagation();
      item.favorite = !item.favorite;
      await store.saveItem(item);
      event.currentTarget.classList.toggle('on', item.favorite);
    });
    card.addEventListener('click', () => openItemModal(item));
  });
}

/* ---------------- item detail ---------------- */

function openItemModal(item) {
  const modal = $('#modal');
  const color = item.colors?.[0] ?? { hex: '#888', name: '' };
  modal.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" data-action="close">✕</button>
      <div class="modal-grid">
        <div class="modal-image">${item.thumb ? `<img src="${item.thumb}" alt="${esc(item.name)}">` : `<span class="item-placeholder big">${categoryIcon(item.category)}</span>`}</div>
        <div class="modal-body">
          <input class="modal-title" data-field="name" value="${esc(item.name)}">
          <div class="modal-fields">
            <label>Category
              <select data-field="category">${CATEGORY_ORDER.map((c) => `<option value="${c}" ${c === item.category ? 'selected' : ''}>${categoryLabel(c)}</option>`).join('')}</select>
            </label>
            <label>Type <input list="subtype-options" data-field="subtype" value="${esc(item.subtype)}"></label>
            <label>Colour <input type="color" data-field="color" value="${color.hex}"></label>
            <label>Dress code
              <select data-field="formality">${FORMALITY.map((f) => `<option value="${f.value}" ${f.value === item.formality ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
            </label>
            <label>Pattern
              <select data-field="pattern">${PATTERNS.map((p) => `<option value="${p}" ${p === item.pattern ? 'selected' : ''}>${p}</option>`).join('')}</select>
            </label>
            <label>Material <input list="material-options" data-field="material" value="${esc(item.material)}"></label>
          </div>
          <div class="season-row">
            ${SEASONS.map((s) => `<label class="season-chip${item.seasons?.includes(s) ? ' on' : ''}"><input type="checkbox" data-field="season" value="${s}" ${item.seasons?.includes(s) ? 'checked' : ''}>${s}</label>`).join('')}
          </div>
          <label class="block">Notes <textarea data-field="notes" rows="2">${esc(item.notes)}</textarea></label>
          <p class="wear-line">Worn <strong>${item.wearCount}</strong> time${item.wearCount === 1 ? '' : 's'}${item.lastWorn ? ` · last on ${new Date(item.lastWorn).toLocaleDateString()}` : ''}</p>
          <div class="modal-actions">
            <button class="btn primary" data-action="wear">Wore it today</button>
            <button class="btn" data-action="style">Build outfits around this</button>
            <button class="btn ghost danger" data-action="delete">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;
  modal.classList.add('open');

  const close = async () => {
    await store.saveItem(item);
    modal.classList.remove('open');
    modal.innerHTML = '';
    renderCloset();
  };

  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  $('[data-action="close"]', modal).addEventListener('click', close);

  $$('[data-field]', modal).forEach((input) => {
    input.addEventListener('change', () => {
      const field = input.dataset.field;
      if (field === 'season') {
        item.seasons = $$('[data-field="season"]', modal).filter((el) => el.checked).map((el) => el.value);
        input.closest('.season-chip').classList.toggle('on', input.checked);
      } else if (field === 'color') {
        const described = describeColor(input.value);
        item.colors[0] = { hex: input.value, name: described.name, family: described.family };
      } else if (field === 'formality') {
        item.formality = Number(input.value);
      } else {
        item[field] = input.value;
      }
      item.updatedAt = new Date().toISOString();
    });
  });

  $('[data-action="wear"]', modal).addEventListener('click', async () => {
    await markWorn([item.id]);
    toast(`Logged a wear for ${item.name}.`);
    close();
  });
  $('[data-action="style"]', modal).addEventListener('click', async () => {
    await store.saveItem(item);
    modal.classList.remove('open');
    modal.innerHTML = '';
    state.view = 'outfits';
    state.suggestions = buildOutfits(state.items, { ...state.brief, mustIncludeId: item.id, limit: 6 });
    state.stylistNote = state.suggestions.length ? `Outfits built around ${item.name}.` : `Nothing in the closet pairs with ${item.name} yet.`;
    render();
  });
  $('[data-action="delete"]', modal).addEventListener('click', async () => {
    if (!confirm(`Delete "${item.name}" from your closet?`)) return;
    await store.deleteItem(item.id);
    state.items = state.items.filter((i) => i.id !== item.id);
    modal.classList.remove('open');
    modal.innerHTML = '';
    toast('Deleted.');
    renderCloset();
  });
}

async function markWorn(itemIds) {
  const today = new Date().toISOString();
  const touched = state.items.filter((item) => itemIds.includes(item.id));
  touched.forEach((item) => {
    item.wearCount = (item.wearCount || 0) + 1;
    item.lastWorn = today;
    item.updatedAt = today;
  });
  await store.saveItems(touched);
}

/* ================= OUTFITS ================= */

function renderOutfits() {
  const root = $('#view-outfits');
  if (state.items.length < 2) {
    root.innerHTML = emptyState('Not enough to work with yet', 'Add at least a top and a bottom — then the stylist has something to combine.', 'Add photos', 'studio');
    wireEmptyState(root);
    return;
  }
  const canAsk = state.ai.ai;

  root.innerHTML = `
    <div class="panel">
      <h2>What are you dressing for?</h2>
      <div class="brief-row">
        <label>Occasion
          <select id="brief-occasion">${OCCASIONS.map((o) => `<option value="${o.id}" ${state.brief.occasionId === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
        </label>
        <label>Weather
          <select id="brief-weather">${WEATHER.map((w) => `<option value="${w.id}" ${state.brief.weatherId === w.id ? 'selected' : ''}>${w.label}</option>`).join('')}</select>
        </label>
        <label class="grow">Anything else? <input id="brief-note" value="${esc(state.brief.note)}" placeholder="e.g. lots of walking, meeting my partner's parents"></label>
      </div>
      <div class="brief-actions">
        <button class="btn primary" id="btn-build">Build outfits</button>
        <button class="btn accent" id="btn-ai" ${canAsk ? '' : 'disabled'}>✨ Ask Claude to style me</button>
      </div>
      ${canAsk ? '' : '<p class="notice">Claude styling needs an API key (Settings). The closet engine below works without one.</p>'}
      ${state.stylistNote ? `<p class="stylist-note">${esc(state.stylistNote)}</p>` : ''}
    </div>
    <div id="suggestions">${state.suggestions.length ? state.suggestions.map(outfitCard).join('') : '<p class="hint">Pick an occasion and hit <strong>Build outfits</strong>.</p>'}</div>
  `;

  $('#brief-occasion').addEventListener('change', (e) => { state.brief.occasionId = e.target.value; });
  $('#brief-weather').addEventListener('change', (e) => { state.brief.weatherId = e.target.value; });
  $('#brief-note').addEventListener('input', (e) => { state.brief.note = e.target.value; });
  $('#btn-build').addEventListener('click', () => {
    state.suggestions = buildOutfits(state.items, { ...state.brief, limit: 8 });
    state.stylistNote = state.suggestions.length
      ? 'Ranked by colour harmony, dress code, weather and what you have not worn lately.'
      : 'No complete outfit yet — you need a top and a bottom, or a one-piece.';
    renderOutfits();
  });
  $('#btn-ai').addEventListener('click', runStylist);
  wireOutfitCards();
}

async function runStylist() {
  setBusy('Claude is styling you…');
  $('#btn-ai').disabled = true;
  try {
    const result = await askStylist({
      apiKey: getApiKey(),
      items: state.items,
      occasionId: state.brief.occasionId,
      weatherId: state.brief.weatherId,
      note: state.brief.note,
      count: 4,
    });
    state.suggestions = result.outfits;
    state.stylistNote = [result.closetNote, result.missingPiece ? `Biggest gap: ${result.missingPiece}` : '']
      .filter(Boolean).join(' ');
    if (!result.outfits.length) toast('The stylist could not build a full outfit from this closet yet.', 'error');
  } catch (err) {
    toast(err.message || 'The stylist request failed.', 'error');
  } finally {
    setBusy('');
    renderOutfits();
  }
}

function outfitCard(outfit) {
  const pieces = [...outfit.items, ...(outfit.extras || [])];
  return `
    <article class="outfit-card" data-id="${outfit.id}">
      <header class="outfit-head">
        <div>
          <h3>${esc(outfit.name || outfitTitle(pieces))}</h3>
          <p class="outfit-sub">${outfit.source === 'claude' ? '✨ Claude' : 'Closet engine'} · score ${outfit.score}</p>
        </div>
        <div class="outfit-actions">
          <button class="btn tiny primary" data-action="wore">Wore this</button>
          <button class="btn tiny" data-action="save">Save</button>
        </div>
      </header>
      <div class="outfit-pieces">
        ${pieces.map((p) => `
          <div class="outfit-piece" title="${esc(p.name)}">
            ${p.thumb ? `<img src="${p.thumb}" alt="${esc(p.name)}">` : `<span class="item-placeholder">${categoryIcon(p.category)}</span>`}
            <span>${esc(p.name)}</span>
          </div>`).join('')}
      </div>
      <ul class="outfit-reasons">
        ${(outfit.reasons || []).map((r) => `<li>${esc(r)}</li>`).join('')}
        ${outfit.tip ? `<li class="tip">💡 ${esc(outfit.tip)}</li>` : ''}
      </ul>
    </article>
  `;
}

/** "white tank + navy jeans" reads better than "top + bottom". */
function outfitTitle(pieces) {
  return pieces.slice(0, 2)
    .map((p) => `${p.colors?.[0]?.name ?? ''} ${p.subtype || p.category}`.trim())
    .join(' + ');
}

function wireOutfitCards() {
  $$('.outfit-card').forEach((card) => {
    const outfit = state.suggestions.find((o) => o.id === card.dataset.id);
    if (!outfit) return;
    $('[data-action="wore"]', card).addEventListener('click', async () => {
      await markWorn(outfit.items.map((i) => i.id));
      toast('Logged — those pieces will drop down the rotation for a while.');
      card.classList.add('worn');
    });
    $('[data-action="save"]', card).addEventListener('click', async () => {
      const record = {
        id: store.newId('outfit'),
        itemIds: outfit.items.map((i) => i.id),
        name: outfit.name || outfit.items.map((p) => p.name).join(' + '),
        source: outfit.source,
        reasons: outfit.reasons,
        occasionId: outfit.occasionId,
        weatherId: outfit.weatherId,
        createdAt: new Date().toISOString(),
      };
      await store.saveOutfit(record);
      state.savedOutfits.push(record);
      toast('Saved to your looks.');
    });
  });
}

/* ================= INSIGHTS ================= */

function renderInsights() {
  const root = $('#view-insights');
  if (!state.items.length) {
    root.innerHTML = emptyState('Nothing to analyse yet', 'Your closet stats show up here once you add pieces.', 'Add photos', 'studio');
    wireEmptyState(root);
    return;
  }
  const stats = closetStats(state.items);
  const gaps = closetGaps(state.items);
  const maxCategory = Math.max(...Object.values(stats.byCategory));
  const maxFamily = Math.max(...Object.values(stats.byFamily));

  root.innerHTML = `
    <div class="stat-row">
      <div class="stat"><span class="stat-value">${stats.total}</span><span class="stat-label">pieces</span></div>
      <div class="stat"><span class="stat-value">${stats.totalWears}</span><span class="stat-label">wears logged</span></div>
      <div class="stat"><span class="stat-value">${Math.round(stats.wornShare * 100)}%</span><span class="stat-label">of closet worn</span></div>
      <div class="stat"><span class="stat-value">${state.savedOutfits.length}</span><span class="stat-label">saved looks</span></div>
    </div>

    <div class="panel">
      <h2>What you own</h2>
      <div class="bars">
        ${CATEGORY_ORDER.filter((c) => stats.byCategory[c]).map((c) => `
          <div class="bar-row">
            <span class="bar-label">${categoryIcon(c)} ${categoryLabel(c)}</span>
            <div class="bar"><div class="bar-fill" style="width:${(stats.byCategory[c] / maxCategory) * 100}%"></div></div>
            <span class="bar-value">${stats.byCategory[c]}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel">
      <h2>Your palette</h2>
      <div class="bars">
        ${Object.entries(stats.byFamily).sort((a, b) => b[1] - a[1]).map(([family, count]) => `
          <div class="bar-row">
            <span class="bar-label">${esc(family)}</span>
            <div class="bar"><div class="bar-fill family-${esc(family)}" style="width:${(count / maxFamily) * 100}%"></div></div>
            <span class="bar-value">${count}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel">
      <h2>Rotation</h2>
      <div class="two-col">
        <div>
          <h3>Most worn</h3>
          ${stats.mostWorn.filter((i) => i.wearCount > 0).map(miniItem).join('') || '<p class="hint">No wears logged yet.</p>'}
        </div>
        <div>
          <h3>Never worn</h3>
          ${stats.neglected.map(miniItem).join('') || '<p class="hint">Everything has been worn at least once.</p>'}
        </div>
      </div>
    </div>

    ${gaps.length ? `
    <div class="panel">
      <h2>Gaps worth filling</h2>
      <ul class="gap-list">${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
    </div>` : ''}
  `;
}

function miniItem(item) {
  return `
    <div class="mini-item">
      ${item.thumb ? `<img src="${item.thumb}" alt="${esc(item.name)}">` : `<span class="item-placeholder">${categoryIcon(item.category)}</span>`}
      <span class="mini-name">${esc(item.name)}</span>
      <span class="mini-count">${item.wearCount}×</span>
    </div>`;
}

/* ================= SETTINGS ================= */

function renderSettings() {
  const root = $('#view-settings');
  const stored = getApiKey();
  const remembered = Boolean(localStorage.getItem(KEY_STORAGE));
  const hosted = isHosted();

  root.innerHTML = `
    ${hosted ? `
    <div class="panel">
      <h2>Claude</h2>
      <p class="hint">This page uses your own Claude account — there is nothing to set up and no API key to manage. Finding clothes in a photo and asking for outfits both count against your usual Claude usage; the first one asks your permission.</p>
      <p class="status-line">${state.ai.ai ? '● Connected' : '○ Not available in this view'}${state.ai.ai && !state.ai.photos ? ' · photos unavailable here, hand-tagging still works' : ''}</p>
    </div>` : `
    <div class="panel">
      <h2>Anthropic API key</h2>
      <p class="hint">Needed for finding clothes in photos and for Claude styling. Everything else works without it. Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</p>
      <div class="key-row">
        <input type="password" id="api-key" placeholder="sk-ant-…" value="${esc(stored)}" autocomplete="off">
        <button class="btn primary" id="btn-save-key">Save</button>
      </div>
      <label class="switch"><input type="checkbox" id="remember-key" ${remembered ? 'checked' : ''}> Remember on this device</label>
      <p class="warning">⚠️ The key is used directly from your browser, so it is visible to anything running on this page. Fine for a personal app you run yourself — don't publish this page to the internet with a key in it.</p>
    </div>`}

    <div class="panel">
      <h2>Your data</h2>
      <p class="hint">${hosted
        ? 'Your pieces are saved to this artifact, so they are here on any device you open it from. Photos stay in this browser. Nothing else is sent anywhere unless you press a ✨ button.'
        : "Photos and items live in this browser's storage. Nothing is uploaded except the photo you explicitly send for detection."}</p>
      <div class="brief-actions">
        <button class="btn" id="btn-export">Export closet (JSON)</button>
        <label class="btn" for="import-input">Import closet</label>
        <input type="file" id="import-input" accept="application/json" hidden>
        <button class="btn ghost danger" id="btn-reset">Delete everything</button>
      </div>
    </div>
  `;

  $('#btn-save-key')?.addEventListener('click', () => {
    const key = $('#api-key').value.trim();
    const remember = $('#remember-key').checked;
    sessionStorage.removeItem(KEY_STORAGE);
    localStorage.removeItem(KEY_STORAGE);
    if (key) (remember ? localStorage : sessionStorage).setItem(KEY_STORAGE, key);
    toast(key ? 'Key saved.' : 'Key cleared.');
    aiStatus(getApiKey()).then((status) => { state.ai = status; render(); });
  });

  $('#btn-export').addEventListener('click', async () => {
    const payload = JSON.stringify(await store.exportAll(), null, 2);
    const filename = `closet-${new Date().toISOString().slice(0, 10)}.json`;
    const downloads = await getDownloads();
    if (downloads) {
      // A published page cannot start its own download; the viewer confirms this one.
      try {
        await downloads.save({ filename, data: payload });
      } catch (err) {
        if (err?.code !== 'declined') toast(err?.message || 'That download did not go through.', 'error');
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#import-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const count = await store.importAll(JSON.parse(await file.text()));
      state.items = (await store.allItems()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      state.savedOutfits = await store.allOutfits();
      toast(`Imported ${count} pieces.`);
      state.view = 'closet';
      render();
    } catch (err) {
      toast(err.message || 'That file could not be imported.', 'error');
    }
  });

  $('#btn-reset').addEventListener('click', async () => {
    if (!confirm('Delete every photo, item and saved look? This cannot be undone.')) return;
    await store.clearAll();
    imageCache.clear();
    Object.assign(state, { items: [], photos: [], savedOutfits: [], suggestions: [], pending: [], activePhotoId: null, view: 'studio' });
    toast('Closet cleared.');
    render();
  });
}

/* ---------------- shared bits ---------------- */

function emptyState(title, body, cta, view) {
  return `
    <div class="empty">
      <h2>${esc(title)}</h2>
      <p>${esc(body)}</p>
      <button class="btn primary" data-goto="${view}">${esc(cta)}</button>
    </div>`;
}

function wireEmptyState(root) {
  const button = $('[data-goto]', root);
  if (button) button.addEventListener('click', () => { state.view = button.dataset.goto; render(); });
}

function fillDatalists() {
  $('#subtype-options').innerHTML = [...new Set(Object.values(SUBTYPES).flat())].map((s) => `<option value="${esc(s)}">`).join('');
  $('#material-options').innerHTML = MATERIALS.map((m) => `<option value="${esc(m)}">`).join('');
}

fillDatalists();
boot().catch((err) => {
  console.error(err);
  toast(err.message || 'The closet failed to load.', 'error');
});
