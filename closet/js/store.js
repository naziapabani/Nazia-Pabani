// IndexedDB persistence. Photos are kept as blobs, items keep a small thumbnail
// data URL so the closet grid renders without touching the original photos.

const DB_NAME = 'closet-db';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('category', 'category', { unique: false });
        items.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('outfits')) {
        db.createObjectStore('outfits', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the closet database.'));
  });
  return dbPromise;
}

function tx(storeName, mode, run) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try {
      result = run(store);
    } catch (err) {
      reject(err);
      return;
    }
    transaction.oncomplete = () => resolve(result && result.__request ? result.__request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Database write was aborted.'));
  }));
}

function reqValue(request) {
  return { __request: request };
}

export function newId(prefix) {
  const rand = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12);
  return `${prefix}_${rand}`;
}

/* ---------- photos ---------- */

export async function savePhoto(photo) {
  await tx('photos', 'readwrite', (store) => store.put(photo));
  return photo;
}

export function getPhoto(id) {
  return tx('photos', 'readonly', (store) => reqValue(store.get(id)));
}

export function allPhotos() {
  return tx('photos', 'readonly', (store) => reqValue(store.getAll()));
}

export function deletePhoto(id) {
  return tx('photos', 'readwrite', (store) => store.delete(id));
}

/* ---------- items ---------- */

export async function saveItem(item) {
  await tx('items', 'readwrite', (store) => store.put(item));
  return item;
}

export async function saveItems(items) {
  await tx('items', 'readwrite', (store) => { items.forEach((item) => store.put(item)); });
  return items;
}

export function allItems() {
  return tx('items', 'readonly', (store) => reqValue(store.getAll()));
}

export function deleteItem(id) {
  return tx('items', 'readwrite', (store) => store.delete(id));
}

/* ---------- outfits ---------- */

export async function saveOutfit(outfit) {
  await tx('outfits', 'readwrite', (store) => store.put(outfit));
  return outfit;
}

export function allOutfits() {
  return tx('outfits', 'readonly', (store) => reqValue(store.getAll()));
}

export function deleteOutfit(id) {
  return tx('outfits', 'readwrite', (store) => store.delete(id));
}

/* ---------- settings ---------- */

export async function getSetting(key, fallback = null) {
  const row = await tx('settings', 'readonly', (store) => reqValue(store.get(key)));
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return tx('settings', 'readwrite', (store) => store.put({ key, value }));
}

/* ---------- item shape ---------- */

/** Fill in every field the rest of the app expects, so partial input is safe. */
export function makeItem(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || newId('item'),
    photoId: partial.photoId || null,
    name: partial.name || 'Untitled piece',
    category: partial.category || 'top',
    subtype: partial.subtype || '',
    colors: Array.isArray(partial.colors) && partial.colors.length
      ? partial.colors.map((c) => ({ hex: c.hex, name: c.name || '', family: c.family || '' }))
      : [{ hex: '#8a8a8a', name: 'grey', family: 'grey' }],
    pattern: partial.pattern || 'solid',
    material: partial.material || '',
    formality: Number(partial.formality) || 2,
    seasons: Array.isArray(partial.seasons) && partial.seasons.length ? partial.seasons : ['spring', 'summer', 'fall'],
    fit: partial.fit || '',
    tags: Array.isArray(partial.tags) ? partial.tags : [],
    notes: partial.notes || '',
    thumb: partial.thumb || '',
    region: partial.region || null,
    source: partial.source || 'manual',
    confidence: typeof partial.confidence === 'number' ? partial.confidence : null,
    favorite: Boolean(partial.favorite),
    wearCount: Number(partial.wearCount) || 0,
    lastWorn: partial.lastWorn || null,
    createdAt: partial.createdAt || now,
    updatedAt: now,
  };
}

/** Wipe everything — used by the "reset closet" button in Settings. */
export async function clearAll() {
  const db = await openDb();
  await Promise.all(['photos', 'items', 'outfits'].map((name) => new Promise((resolve, reject) => {
    const transaction = db.transaction(name, 'readwrite');
    transaction.objectStore(name).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  })));
}

/** Everything in one JSON blob, for backup or moving devices. */
export async function exportAll() {
  const [items, outfits] = await Promise.all([allItems(), allOutfits()]);
  return { version: 1, exportedAt: new Date().toISOString(), items, outfits };
}

export async function importAll(payload) {
  if (!payload || !Array.isArray(payload.items)) throw new Error('That file is not a closet export.');
  await saveItems(payload.items.map((item) => makeItem(item)));
  if (Array.isArray(payload.outfits)) {
    for (const outfit of payload.outfits) await saveOutfit(outfit);
  }
  return payload.items.length;
}
