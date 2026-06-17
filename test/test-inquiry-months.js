// test/test-inquiry-months.js
// Unit tests for inquiry import month generation logic.
// Extract from renderer/inquiry.js showImportInquiryDialog().
// Run: node test/test-inquiry-months.js
// Exit code 0 on pass, 1 on failure.

'use strict';

const assert = require('assert');

// --- Function under test ---
// Identical logic to the month generation in showImportInquiryDialog(),
// parameterised so we can inject currentYear, currentMonth, and existingMonths.

function getImportMonths(currentYear, currentMonth, existingMonths = []) {
  const candidateMonths = new Set();
  // Previous month, current month, next month
  for (let offset = -1; offset <= 1; offset++) {
    let m = currentMonth + offset;
    let y = currentYear;
    if (m > 12) { m -= 12; y++; }
    if (m < 1) { m += 12; y--; }
    candidateMonths.add(`${y}-${String(m).padStart(2, '0')}`);
  }
  // Add existing months from DB
  existingMonths.forEach(m => candidateMonths.add(m));
  // Sort descending (newest first)
  return [...candidateMonths].sort().reverse();
}

// --- Test runner ---
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
    console.log(`        ${err.message}`);
  }
}

function assertDeepEqual(actual, expected, label) {
  assert.deepStrictEqual(actual, expected, label);
}

// ============================================================
// Test scenarios
// ============================================================

console.log('Scenario 1: June 2026 — 3 months, descending');
test('returns 2026-07, 2026-06, 2026-05', () => {
  const result = getImportMonths(2026, 6);
  assertDeepEqual(result, ['2026-07', '2026-06', '2026-05']);
});

console.log('');
console.log('Scenario 2: January 2026 — cross-year backward');
test('returns 2026-02, 2026-01, 2025-12', () => {
  const result = getImportMonths(2026, 1);
  assertDeepEqual(result, ['2026-02', '2026-01', '2025-12']);
});

console.log('');
console.log('Scenario 3: December 2025 — cross-year forward');
test('returns 2026-01, 2025-12, 2025-11', () => {
  const result = getImportMonths(2025, 12);
  assertDeepEqual(result, ['2026-01', '2025-12', '2025-11']);
});

console.log('');
console.log('Scenario 4: June 2026 with existing months from DB');
test('existing "2025-03" and "2025-08" appear alongside generated months', () => {
  const result = getImportMonths(2026, 6, ['2025-03', '2025-08']);
  // Generated: 2026-07, 2026-06, 2026-05 + existing: 2025-03, 2025-08
  // Sorted descending => 2026-07, 2026-06, 2026-05, 2025-08, 2025-03
  assertDeepEqual(result, [
    '2026-07', '2026-06', '2026-05',
    '2025-08', '2025-03'
  ]);
});

console.log('');
console.log('Scenario 5: Set ensures no duplicates');
test('existing month that overlaps with generated months does not duplicate', () => {
  // 2026-06 is already generated; should appear only once
  const result = getImportMonths(2026, 6, ['2026-06', '2025-03']);
  assertDeepEqual(result, [
    '2026-07', '2026-06', '2026-05',
    '2025-03'
  ]);
});

console.log('');
console.log('Scenario 6: Result is always sorted descending (boundary test)');
test('months from different years sort correctly', () => {
  const result = getImportMonths(2025, 12, [
    '2024-01', '2025-01', '2025-06', '2026-12', '2023-11'
  ]);
  // Generated: 2026-01, 2025-12, 2025-11
  // All: 2026-12, 2026-01, 2025-12, 2025-11, 2025-06, 2025-01, 2024-01, 2023-11
  const expected = [
    '2026-12', '2026-01', '2025-12', '2025-11',
    '2025-06', '2025-01', '2024-01', '2023-11'
  ];
  assertDeepEqual(result, expected);
});

console.log('');
console.log('Scenario 7: Zero-padded single-digit months');
test('months 1-9 are formatted as 01, 02, ... 09', () => {
  // September — generates 2025-10, 2025-09, 2025-08
  const result = getImportMonths(2025, 9);
  assertDeepEqual(result, ['2025-10', '2025-09', '2025-08']);
});

console.log('');
console.log('Scenario 8: Empty existingMonths defaults to empty array');
test('no existingMonths argument works', () => {
  const result = getImportMonths(2026, 6);
  assert.strictEqual(result.length, 3);
  assertDeepEqual(result, ['2026-07', '2026-06', '2026-05']);
});

// ============================================================
// Summary
// ============================================================
console.log('');
console.log('========================================');
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}

process.exit(0);
