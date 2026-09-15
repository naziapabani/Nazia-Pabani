// Colour naming, harmony and the outfit engine — the logic the recommendations
// rest on. No dependencies and no browser: `node test/logic.test.mjs` from closet/.

import assert from 'node:assert/strict';
import { describeColor, pairHarmony, contrastInk } from '../js/color.js';
import { buildOutfits, closetGaps, closetStats } from '../js/stylist.js';

let pass = 0;
const check = (label, fn) => { fn(); pass += 1; console.log('  ok  ' + label); };

console.log('color naming');
const cases = [
  ['#000000', 'black', true], ['#ffffff', 'white', true], ['#808080', 'grey', true],
  ['#1b2a4a', 'navy', true], ['#d9c6ac', 'beige', true], ['#7c5434', 'brown', true],
  ['#c0392b', 'red', false], ['#2f7d3a', 'green', false], ['#3a6fd8', 'blue', false],
  ['#e88fb0', 'pink', false], ['#6b7031', 'olive', false], ['#7a4fb0', 'purple', false],
];
for (const [hex, family, neutral] of cases) {
  check(`${hex} -> ${family}`, () => {
    const d = describeColor(hex);
    assert.equal(d.family, family, `${hex} gave ${d.family} (${d.name})`);
    assert.equal(d.isNeutral, neutral, `${hex} neutrality`);
  });
}
check('bad input is survivable', () => {
  const d = describeColor('not-a-color');
  assert.ok(d.name && d.family);
});

console.log('harmony');
check('neutral + colour scores high', () => {
  assert.ok(pairHarmony('#000000', '#c0392b').score >= 0.7);
});
check('red vs green-yellow clashes', () => {
  assert.ok(pairHarmony('#e01b1b', '#9ccf1f').score < 0, JSON.stringify(pairHarmony('#e01b1b', '#9ccf1f')));
});
check('every pair yields a reason string', () => {
  for (const [a] of cases) for (const [b] of cases) {
    const h = pairHarmony(a, b);
    assert.ok(typeof h.reason === 'string' && h.reason.length > 4);
    assert.ok(h.score >= -1 && h.score <= 1);
  }
});
check('contrast ink flips', () => {
  assert.equal(contrastInk('#ffffff'), '#1a1a1a');
  assert.equal(contrastInk('#000000'), '#ffffff');
});

console.log('outfit engine');
const item = (id, category, hex, extra = {}) => ({
  id, name: id, category, subtype: category, pattern: 'solid', material: '',
  formality: 2, seasons: ['spring', 'summer', 'fall'], fit: '', tags: [], notes: '',
  colors: [{ hex, ...describeColor(hex) }], wearCount: 0, lastWorn: null, favorite: false,
  createdAt: new Date().toISOString(), ...extra,
});

const closet = [
  item('top1', 'top', '#ffffff'), item('top2', 'top', '#c0392b'),
  item('top3', 'top', '#1b2a4a', { formality: 4 }),
  item('bot1', 'bottom', '#1b2a4a'), item('bot2', 'bottom', '#000000', { formality: 4 }),
  item('shoe1', 'shoes', '#000000'), item('shoe2', 'shoes', '#ffffff'),
  item('coat1', 'outerwear', '#7c5434', { seasons: ['fall', 'winter'] }),
  item('dress1', 'dress', '#2f7d3a', { formality: 4 }),
];

check('builds ranked outfits', () => {
  const out = buildOutfits(closet, { occasionId: 'everyday', weatherId: 'mild', limit: 6 });
  assert.ok(out.length > 0, 'expected outfits');
  assert.ok(out.every((o) => o.items.length >= 2));
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i - 1].score >= out[i].score, 'not sorted');
  assert.ok(out.every((o) => o.reasons.length > 0), 'every outfit explains itself');
});
check('every outfit is wearable (top+bottom or one-piece)', () => {
  for (const o of buildOutfits(closet, { occasionId: 'work', weatherId: 'cool', limit: 8 })) {
    const cats = o.items.map((i) => i.category);
    const wearable = cats.includes('dress') || (cats.includes('top') && cats.includes('bottom'));
    assert.ok(wearable, 'unwearable: ' + cats.join(','));
  }
});
check('mustInclude is honoured', () => {
  const out = buildOutfits(closet, { occasionId: 'everyday', weatherId: 'mild', mustIncludeId: 'shoe2' });
  assert.ok(out.length > 0);
  assert.ok(out.every((o) => o.items.some((i) => i.id === 'shoe2')));
});
check('hot weather leaves the winter coat out', () => {
  const out = buildOutfits(closet, { occasionId: 'everyday', weatherId: 'hot', limit: 8 });
  assert.ok(out.every((o) => !o.items.some((i) => i.id === 'coat1')), 'coat appeared in hot weather');
});
check('no piece dominates the results', () => {
  const out = buildOutfits(closet, { occasionId: 'everyday', weatherId: 'mild', limit: 8 });
  const counts = {};
  out.forEach((o) => o.items.forEach((i) => { counts[i.id] = (counts[i.id] || 0) + 1; }));
  assert.ok(Math.max(...Object.values(counts)) <= 2, JSON.stringify(counts));
});
check('empty and tiny closets do not throw', () => {
  assert.deepEqual(buildOutfits([], {}), []);
  assert.deepEqual(buildOutfits([item('t', 'top', '#fff')], {}), []);
});
check('gaps and stats read sensibly', () => {
  const gaps = closetGaps(closet.filter((i) => i.category !== 'shoes'));
  assert.ok(gaps.some((g) => /shoes/i.test(g)), JSON.stringify(gaps));
  const stats = closetStats(closet);
  assert.equal(stats.total, closet.length);
  assert.equal(stats.byCategory.top, 3);
  assert.equal(stats.totalWears, 0);
});
check('recently worn pieces rank lower', () => {
  const fresh = buildOutfits(closet, { occasionId: 'everyday', weatherId: 'mild', limit: 1 })[0];
  const wornToday = closet.map((i) => (fresh.items.some((f) => f.id === i.id)
    ? { ...i, lastWorn: new Date().toISOString(), wearCount: 3 } : i));
  const after = buildOutfits(wornToday, { occasionId: 'everyday', weatherId: 'mild', limit: 1 })[0];
  assert.ok(after.score <= fresh.score || after.items.map(i=>i.id).join() !== fresh.items.map(i=>i.id).join());
});

console.log(`\n${pass} checks passed`);
