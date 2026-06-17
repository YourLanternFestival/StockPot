const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`         ${err.message}`);
  }
}

// ===== sortAutocompleteResults =====
function sortAutocompleteResults(results, keyword, nameField = 'name') {
  const kw = keyword.toLowerCase();
  return [...results].sort((a, b) => {
    const aName = String(a[nameField] || '').toLowerCase();
    const bName = String(b[nameField] || '').toLowerCase();
    const aExact = aName === kw ? 0 : aName.startsWith(kw) ? 1 : 2;
    const bExact = bName === kw ? 0 : bName.startsWith(kw) ? 1 : 2;
    return aExact - bExact;
  });
}

console.log('=== sortAutocompleteResults ===');

test('exact match appears first when keyword matches exactly', () => {
  const items = [
    { name: 'contains cabbage elsewhere' },
    { name: 'cabbage' },
    { name: 'cabbage soup' },
  ];
  const sorted = sortAutocompleteResults(items, 'cabbage');
  assert.strictEqual(sorted[0].name, 'cabbage', 'exact match should be first');
});

test('prefix matches come before contains-only matches', () => {
  const items = [
    { name: 'green cabbage' },
    { name: 'cabbage soup' },
  ];
  const sorted = sortAutocompleteResults(items, 'cabbage');
  assert.strictEqual(sorted[0].name, 'cabbage soup', 'prefix match should come before contains-only');
  assert.strictEqual(sorted[1].name, 'green cabbage', 'contains-only match should be last');
});

test('multiple exact matches keep relative order (stable sort)', () => {
  const items = [
    { name: 'apple', id: 1 },
    { name: 'apple', id: 2 },
    { name: 'apple', id: 3 },
  ];
  const sorted = sortAutocompleteResults(items, 'apple');
  assert.strictEqual(sorted[0].id, 1, 'first exact match should stay first');
  assert.strictEqual(sorted[1].id, 2, 'second exact match should stay second');
  assert.strictEqual(sorted[2].id, 3, 'third exact match should stay third');
});

test('empty results array returns empty', () => {
  const sorted = sortAutocompleteResults([], 'anything');
  assert.strictEqual(sorted.length, 0, 'empty input should produce empty output');
});

test('case insensitive matching', () => {
  const items = [
    { name: 'POTATO stew' },
    { name: 'Potato' },
    { name: 'sweet potato' },
  ];
  const sorted = sortAutocompleteResults(items, 'potato');
  assert.strictEqual(sorted[0].name, 'Potato', 'case-insensitive exact match should be first');
});

test('case insensitive matching with uppercase keyword', () => {
  const items = [
    { name: 'tomato sauce' },
    { name: 'tomato' },
  ];
  const sorted = sortAutocompleteResults(items, 'TOMATO');
  assert.strictEqual(sorted[0].name, 'tomato', 'uppercase keyword exact match should be first');
});

test('works with custom nameField', () => {
  const items = [
    { label: 'banana bread' },
    { label: 'banana' },
    { label: 'fresh banana' },
  ];
  const sorted = sortAutocompleteResults(items, 'banana', 'label');
  assert.strictEqual(sorted[0].label, 'banana', 'custom nameField exact match should be first');
  assert.strictEqual(sorted[1].label, 'banana bread', 'custom nameField prefix match should be second');
  assert.strictEqual(sorted[2].label, 'fresh banana', 'custom nameField contains-only should be third');
});

test('keyword not found in any item returns all items (all priority 2)', () => {
  const items = [
    { name: 'rice' },
    { name: 'noodles' },
    { name: 'bread' },
  ];
  const sorted = sortAutocompleteResults(items, 'xyz123');
  assert.strictEqual(sorted.length, 3, 'all items should be returned');
  // the sorted names should be the same set
  const names = sorted.map(i => i.name).sort();
  assert.deepStrictEqual(names, ['bread', 'noodles', 'rice'], 'all original items present');
});

test('mixed priorities: exact + prefix + contains + no match', () => {
  const items = [
    { name: 'xyz something' },
    { name: 'abc xyz' },
    { name: 'xyz' },
    { name: 'nothing here' },
  ];
  const sorted = sortAutocompleteResults(items, 'xyz');
  assert.strictEqual(sorted[0].name, 'xyz', 'exact match first');
  assert.strictEqual(sorted[1].name, 'xyz something', 'prefix match second');
  // last two are both priority 2, stable order preserved
  assert.ok(sorted[2].name === 'abc xyz' || sorted[2].name === 'nothing here', 'priority 2 items follow');
});

// ===== isPureNumber =====
function isPureNumber(qtyStr) {
  return qtyStr !== '' && !isNaN(Number(qtyStr));
}

console.log('\n=== isPureNumber ===');

test('"1.0" is a pure number', () => {
  assert.strictEqual(isPureNumber('1.0'), true);
});

test('"01" is a pure number', () => {
  assert.strictEqual(isPureNumber('01'), true);
});

test('".5" is a pure number', () => {
  assert.strictEqual(isPureNumber('.5'), true);
});

test('"0" is a pure number', () => {
  assert.strictEqual(isPureNumber('0'), true);
});

test('"123" is a pure number', () => {
  assert.strictEqual(isPureNumber('123'), true);
});

test('"11条" (text mixed in) is not a pure number', () => {
  assert.strictEqual(isPureNumber('11条'), false);
});

test('"" (empty string) is not a pure number', () => {
  assert.strictEqual(isPureNumber(''), false);
});

test('"abc" is not a pure number', () => {
  assert.strictEqual(isPureNumber('abc'), false);
});

test('"1.5.3" (multiple dots) is not a pure number', () => {
  assert.strictEqual(isPureNumber('1.5.3'), false);
});

// ===== Summary =====
console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All util tests passed');
}
