// Clothing taxonomy shared by the detector, the closet views and the stylist.

export const CATEGORIES = {
  top:       { label: 'Tops',      slot: 'top',       icon: '👕' },
  bottom:    { label: 'Bottoms',   slot: 'bottom',    icon: '👖' },
  dress:     { label: 'One-piece', slot: 'onepiece',  icon: '👗' },
  outerwear: { label: 'Outerwear', slot: 'outerwear', icon: '🧥' },
  shoes:     { label: 'Shoes',     slot: 'shoes',     icon: '👟' },
  bag:       { label: 'Bags',      slot: 'bag',       icon: '👜' },
  accessory: { label: 'Accessories', slot: 'accessory', icon: '🧣' },
};

export const CATEGORY_ORDER = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'];

// Suggested subtypes per category. Free text is allowed too — these only drive
// the datalist in the editor and the default-crop heuristics.
export const SUBTYPES = {
  top: ['t-shirt', 'tank top', 'blouse', 'button-down', 'sweater', 'hoodie', 'sweatshirt', 'crop top', 'bodysuit', 'turtleneck', 'polo'],
  bottom: ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers', 'cargo pants'],
  dress: ['dress', 'maxi dress', 'mini dress', 'jumpsuit', 'romper', 'set'],
  outerwear: ['jacket', 'denim jacket', 'leather jacket', 'blazer', 'coat', 'trench coat', 'cardigan', 'puffer', 'vest'],
  shoes: ['sneakers', 'boots', 'ankle boots', 'heels', 'flats', 'loafers', 'sandals', 'mules'],
  bag: ['tote', 'shoulder bag', 'crossbody', 'clutch', 'backpack', 'mini bag'],
  accessory: ['scarf', 'belt', 'hat', 'beanie', 'sunglasses', 'necklace', 'earrings', 'watch', 'socks', 'tights'],
};

export const PATTERNS = ['solid', 'striped', 'plaid', 'floral', 'polka dot', 'animal print', 'graphic', 'colorblock', 'textured', 'denim wash'];

export const MATERIALS = ['cotton', 'denim', 'linen', 'wool', 'knit', 'silk', 'satin', 'leather', 'faux leather', 'suede', 'polyester', 'fleece', 'corduroy', 'velvet', 'mesh'];

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// 1 = loungewear, 5 = black tie. The stylist keeps an outfit's spread tight.
export const FORMALITY = [
  { value: 1, label: 'Loungewear' },
  { value: 2, label: 'Casual' },
  { value: 3, label: 'Smart casual' },
  { value: 4, label: 'Dressy' },
  { value: 5, label: 'Formal' },
];

export const OCCASIONS = [
  { id: 'everyday',   label: 'Everyday',        formality: 2, tags: ['casual', 'errands'] },
  { id: 'work',       label: 'Work / office',   formality: 4, tags: ['work', 'professional'] },
  { id: 'class',      label: 'Class / campus',  formality: 2, tags: ['casual', 'comfort'] },
  { id: 'dinner',     label: 'Dinner out',      formality: 4, tags: ['evening', 'dressy'] },
  { id: 'date',       label: 'Date night',      formality: 4, tags: ['evening', 'statement'] },
  { id: 'party',      label: 'Party / event',   formality: 5, tags: ['evening', 'statement'] },
  { id: 'travel',     label: 'Travel',          formality: 2, tags: ['comfort', 'layers'] },
  { id: 'workout',    label: 'Active',          formality: 1, tags: ['athletic'] },
];

export const WEATHER = [
  { id: 'hot',   label: 'Hot (25°C+)',    seasons: ['summer'],          maxLayers: 0 },
  { id: 'warm',  label: 'Warm (18–25°C)', seasons: ['summer', 'spring'], maxLayers: 1 },
  { id: 'mild',  label: 'Mild (10–18°C)', seasons: ['spring', 'fall'],   maxLayers: 1 },
  { id: 'cool',  label: 'Cool (3–10°C)',  seasons: ['fall', 'winter'],   maxLayers: 2 },
  { id: 'cold',  label: 'Cold (under 3°C)', seasons: ['winter'],         maxLayers: 2 },
];

/** Where a garment usually sits in a full-body photo — the fallback crop when
 *  the detector doesn't return a usable region. Values are fractions of the image. */
export const DEFAULT_REGIONS = {
  top:       { x: 0.22, y: 0.16, width: 0.56, height: 0.30 },
  bottom:    { x: 0.24, y: 0.44, width: 0.52, height: 0.34 },
  dress:     { x: 0.20, y: 0.18, width: 0.60, height: 0.52 },
  outerwear: { x: 0.16, y: 0.14, width: 0.68, height: 0.38 },
  shoes:     { x: 0.26, y: 0.80, width: 0.48, height: 0.19 },
  bag:       { x: 0.10, y: 0.38, width: 0.34, height: 0.26 },
  accessory: { x: 0.28, y: 0.04, width: 0.44, height: 0.22 },
};

export function categoryLabel(id) {
  return CATEGORIES[id]?.label ?? 'Other';
}

export function categoryIcon(id) {
  return CATEGORIES[id]?.icon ?? '🧺';
}

export function formalityLabel(value) {
  return FORMALITY.find((f) => f.value === Number(value))?.label ?? 'Casual';
}

export function occasion(id) {
  return OCCASIONS.find((o) => o.id === id) ?? OCCASIONS[0];
}

export function weather(id) {
  return WEATHER.find((w) => w.id === id) ?? WEATHER[2];
}
