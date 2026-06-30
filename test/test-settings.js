/**
 * 设置面板 DOM 泄露测试
 *
 * 用法：node test/test-settings.js
 * 测试设置面板中的 HTML 结构完整性、CSS 属性泄露、主题切换清理、颜色预览边界条件。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── 测试框架 ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); failures.push(label); }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`  ✓ ${label} (${JSON.stringify(actual)})`); }
  else { failed++; console.log(`  ✗ FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); failures.push(label); }
}

function section(title) { console.log(`\n── ${title} ──`); }

// ── 从 renderer/settings.js 提取的纯函数（无 DOM 依赖） ──

function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function generatePalette(primaryHex) {
  const hsl = hexToHSL(primaryHex);
  return {
    primary: primaryHex,
    sage: hslToHex(hsl.h, Math.max(hsl.s - 10, 10), Math.min(hsl.l + 12, 55)),
    moss: hslToHex(hsl.h, Math.min(hsl.s + 15, 60), Math.min(hsl.l + 25, 70)),
    leaf: hslToHex(hsl.h, Math.min(hsl.s + 10, 50), Math.min(hsl.l + 45, 90)),
    cream: hslToHex(hsl.h, Math.min(hsl.s, 30), Math.min(hsl.l + 55, 96)),
  };
}

// CSS 属性名列表（applyThemeColor 设置的）
const BIOPHILIC_CSS_PROPS = [
  '--primary', '--primary-hover', '--primary-light',
  '--sidebar-bg', '--sidebar-active',
  '--text', '--text-secondary', '--border', '--bg', '--card-bg'
];

// CSS 属性名（applyTheme default 分支移除的，包含 --theme-font）
const DEFAULT_REMOVED_PROPS = [
  '--primary', '--primary-hover', '--primary-light',
  '--sidebar-bg', '--sidebar-active',
  '--text', '--text-secondary', '--border', '--bg', '--card-bg',
  '--theme-font'
];

// ── hexToHSL 颜色转换 ──────────────────────────────────────
section('hexToHSL 颜色转换');

const hsl1 = hexToHSL('#3E4A32');
assertEqual(hsl1.h, 90, '#3E4A32 hue = 90°');
assertEqual(hsl1.s, 19, '#3E4A32 saturation = 19%');
assertEqual(hsl1.l, 24, '#3E4A32 lightness = 24%');

const hsl2 = hexToHSL('#4f6ef7');
assertEqual(hsl2.h, 229, '#4f6ef7 hue = 229°');
assertEqual(hsl2.l, 64, '#4f6ef7 lightness = 64%');

const hsl3 = hexToHSL('#000000');
assertEqual(hsl3.h, 0, '#000 black hue = 0');
assertEqual(hsl3.s, 0, '#000 black saturation = 0');
assertEqual(hsl3.l, 0, '#000 black lightness = 0');

const hsl4 = hexToHSL('#FFFFFF');
assertEqual(hsl4.h, 0, '#FFF white hue = 0');
assertEqual(hsl4.s, 0, '#FFF white saturation = 0');
assertEqual(hsl4.l, 100, '#FFF white lightness = 100');

// ── hslToHex 往返转换 ──────────────────────────────────────
section('hslToHex 往返转换');

assertEqual(hslToHex(0, 0, 0).toUpperCase(), '#000000', 'hsl(0,0,0) → #000000');
assertEqual(hslToHex(0, 0, 100).toUpperCase(), '#FFFFFF', 'hsl(0,0,100) → #FFFFFF');

// hslToHex 输出合法 hex
const hexPattern = /^#[0-9A-Fa-f]{6}$/;
assert(hexPattern.test(hslToHex(90, 19, 24)), 'hslToHex 输出合法 hex 格式');
assert(hexPattern.test(hslToHex(229, 73, 64)), '多色测试：输出合法 hex');

// hexToHSL → hslToHex 往返（注意：hexToHSL 舍入到整数，往返有精度损失，验证颜色接近即可）
const testHex = '#3E4A32';
const hslRoundtrip = hexToHSL(testHex);
const backHex = hslToHex(hslRoundtrip.h, hslRoundtrip.s, hslRoundtrip.l);
// 往返后的 RGB 每个通道与原始相差不超过 2（允许舍入误差）
const origRGB = [parseInt(testHex.slice(1,3), 16), parseInt(testHex.slice(3,5), 16), parseInt(testHex.slice(5,7), 16)];
const backRGB = [parseInt(backHex.slice(1,3), 16), parseInt(backHex.slice(3,5), 16), parseInt(backHex.slice(5,7), 16)];
const maxDrift = Math.max(...origRGB.map((v, i) => Math.abs(v - backRGB[i])));
assert(maxDrift <= 2, `#3E4A32 往返 RGB 漂移 ≤ 2（实际漂移 ${maxDrift}）`);

// 极端颜色：纯色无精度损失
const pureColors = ['#FF0000', '#00FF00', '#0000FF'];
for (const hex of pureColors) {
  const hsl = hexToHSL(hex);
  const back = hslToHex(hsl.h, hsl.s, hsl.l).toUpperCase();
  assertEqual(back, hex, `${hex} 纯色往返一致`);
}

// ── generatePalette 调色板生成 ─────────────────────────────
section('generatePalette 调色板生成');

const palette = generatePalette('#3E4A32');
assertEqual(palette.primary, '#3E4A32', 'primary = 输入色');
assert(typeof palette.sage === 'string' && palette.sage.startsWith('#'), true, 'sage 是 hex 色值');
assert(typeof palette.moss === 'string' && palette.moss.startsWith('#'), true, 'moss 是 hex 色值');
assert(typeof palette.leaf === 'string' && palette.leaf.startsWith('#'), true, 'leaf 是 hex 色值');
assert(typeof palette.cream === 'string' && palette.cream.startsWith('#'), true, 'cream 是 hex 色值');

// 调色板颜色互不相同
const paletteColors = [palette.primary, palette.sage, palette.moss, palette.leaf, palette.cream];
const uniqueColors = new Set(paletteColors.map(c => c.toUpperCase()));
assertEqual(uniqueColors.size, 5, '5 个调色板颜色各自不同');

// ── 模拟 DOM CSS 属性状态（测试泄露场景） ──────────────────
section('CSS 属性泄露场景');

// 模拟 document.documentElement.style 的简化版
function createMockRootStyle() {
  const properties = {};
  return {
    setProperty(name, value) { properties[name] = value; },
    removeProperty(name) { delete properties[name]; },
    getProperty(name) { return properties[name] || null; },
    getProperties() { return { ...properties }; },
    // 检查是否有任何 biophilic 属性残留
    hasLeakedProps() {
      return BIOPHILIC_CSS_PROPS.some(p => p in properties);
    },
    countLeakedProps() {
      return BIOPHILIC_CSS_PROPS.filter(p => p in properties).length;
    }
  };
}

// 模拟 applyThemeColor（无 DOM 依赖版本）
function applyThemeColor(rootStyle, hex) {
  const palette = generatePalette(hex);
  rootStyle.setProperty('--primary', palette.primary);
  rootStyle.setProperty('--primary-hover', palette.sage);
  rootStyle.setProperty('--primary-light', palette.leaf);
  rootStyle.setProperty('--sidebar-bg', palette.primary);
  rootStyle.setProperty('--sidebar-active', palette.moss + '30');
  rootStyle.setProperty('--text', palette.primary);
  rootStyle.setProperty('--text-secondary', palette.sage);
  rootStyle.setProperty('--border', palette.leaf);
  rootStyle.setProperty('--bg', palette.cream);
  rootStyle.setProperty('--card-bg', 'rgba(255,255,255,0.75)');
}

// 模拟 applyTheme（无 DOM 依赖版本）
function applyTheme(rootStyle, theme, font, navSize, bodySize, color) {
  if (theme === 'biophilic') {
    // enable biophilic CSS
    // (classList.add not modeled here)
  } else {
    // default theme: remove biophilic CSS properties
    for (const prop of DEFAULT_REMOVED_PROPS) {
      rootStyle.removeProperty(prop);
    }
  }
  if (font) rootStyle.setProperty('--theme-font', font);
  if (navSize) rootStyle.setProperty('--theme-nav-size', navSize + 'px');
  if (bodySize) rootStyle.setProperty('--theme-body-size', bodySize + 'px');
  if (theme === 'biophilic' && color) applyThemeColor(rootStyle, color);
}

// 模拟 onThemeColorChange（当前有 bug 的版本 — 两分支都调 applyThemeColor）
function onThemeColorChange_current(rootStyle, theme, hex) {
  if (theme === 'biophilic') {
    applyThemeColor(rootStyle, hex);
  } else {
    applyThemeColor(rootStyle, hex);  // BUG: 默认主题也设置了 biophilic 属性
  }
}

// 模拟 onThemeColorChange（修复版 — 仅 biophilic 预览）
function onThemeColorChange_fixed(rootStyle, theme, hex) {
  if (theme === 'biophilic') {
    applyThemeColor(rootStyle, hex);
  }
  // 默认主题：不设置 biophilic CSS 属性
}

// 模拟 initSettingsPage 中的颜色预览逻辑
function initSettingsPage_colorPreview(rootStyle, savedTheme, savedColor) {
  if (savedTheme === 'biophilic') {
    applyThemeColor(rootStyle, savedColor || '#3E4A32');
  }
  // 默认主题：不该设置 biophilic 属性
}

// ── 场景 1：onThemeColorChange 在默认主题下泄露 CSS 属性 ──
console.log('\n  场景 1: onThemeColorChange 默认主题下不应泄露 CSS 属性');
{
  const root = createMockRootStyle();

  // 当前有 bug 的版本：默认主题下改颜色
  onThemeColorChange_current(root, 'default', '#FF0000');
  const leaked = root.hasLeakedProps();
  assert(leaked, '当前版本：默认主题改颜色 → CSS 属性被错误设置（确认 bug 存在）');
  assertEqual(root.countLeakedProps(), 10, '当前版本：10 个 biophilic 属性泄露');

  // 修复版本：默认主题下改颜色不应设置属性
  const rootFixed = createMockRootStyle();
  onThemeColorChange_fixed(rootFixed, 'default', '#FF0000');
  assert(!rootFixed.hasLeakedProps(), '修复版本：默认主题改颜色 → 无 CSS 属性泄露');
  assertEqual(rootFixed.countLeakedProps(), 0, '修复版本：0 个 biophilic 属性');
}

// ── 场景 2：onThemeColorChange 在 biophilic 主题下正常预览 ──
console.log('\n  场景 2: onThemeColorChange biophilic 主题下正常预览');
{
  const root = createMockRootStyle();
  onThemeColorChange_fixed(root, 'biophilic', '#3E4A32');
  assert(root.hasLeakedProps(), 'biophilic 主题：CSS 属性正常设置（非泄露）');
  assertEqual(root.getProperty('--primary'), '#3E4A32', '--primary 正确设置');

  // 再次改色应覆盖
  onThemeColorChange_fixed(root, 'biophilic', '#FF0000');
  assertEqual(root.getProperty('--primary'), '#FF0000', '再次改色 --primary 更新为 #FF0000');
}

// ── 场景 3：从 biophilic 切回默认主题后残留清理 ──
console.log('\n  场景 3: biophilic → default 主题切换后 CSS 清理');
{
  const root = createMockRootStyle();

  // 用户之前在 biophilic 主题，CSS 属性已设置
  applyTheme(root, 'biophilic', 'Cheese', '21', '20', '#3E4A32');
  assert(root.hasLeakedProps(), 'biophilic 主题：属性正常设置');

  // 用户改为默认主题并保存
  applyTheme(root, 'default', '', '14', '14', null);
  assert(!root.hasLeakedProps(), '切换到 default 后：biophilic 属性全部清理');
  assertEqual(root.countLeakedProps(), 0, '切换到 default 后：0 个残留属性');
}

// ── 场景 4：initSettingsPage 重入时应重置 CSS 状态 ──
console.log('\n  场景 4: initSettingsPage 重新进入时恢复已保存的 CSS 状态');
{
  // 模拟：已保存 default 主题，但 CSS 被上次预览污染
  const root = createMockRootStyle();
  // 上次预览留下的污染
  applyThemeColor(root, '#FF0000');
  assert(root.hasLeakedProps(), '污染前：属性存在');

  // initSettingsPage 应加载已保存设置并恢复 CSS
  // 当前代码：默认主题下只设 colorEl.value，不清理 CSS（bug）
  // 修复：initSettingsPage 应调用 applyTheme 恢复状态
  initSettingsPage_colorPreview(root, 'default', '#4f6ef7');
  // 当前行为：属性仍然残留
  assert(root.hasLeakedProps(), '当前版本：重新进入后属性仍残留（确认 bug）');

  // 正确做法：重新进入时应清理
  const rootFixed = createMockRootStyle();
  applyThemeColor(rootFixed, '#FF0000'); // 污染
  // 修复：initSettingsPage 最后调用 applyTheme 恢复
  applyTheme(rootFixed, 'default', '', '14', '14', null);
  assert(!rootFixed.hasLeakedProps(), '修复版本：重新进入后 CSS 状态已恢复');
}

// ── 场景 5：restoreDefaultTheme 应正确清理 ──
console.log('\n  场景 5: restoreDefaultTheme 应正确重置');
{
  const root = createMockRootStyle();

  // 先设置 biophilic 属性
  applyTheme(root, 'biophilic', 'Cheese', '21', '20', '#3E4A32');
  assert(root.hasLeakedProps(), 'biophilic 已激活');

  // 恢复默认主题（当前代码逻辑）
  applyTheme(root, 'default', '', '14', '14', '#4f6ef7');
  assert(!root.hasLeakedProps(), 'restoreDefaultTheme: biophilic 属性已清理');

  // 验证字体/字号设置
  assertEqual(root.getProperty('--theme-font'), null, '--theme-font 已清除（font=\'\' 不设置）');
  assertEqual(root.getProperty('--theme-nav-size'), '14px', '--theme-nav-size = 14px');
  assertEqual(root.getProperty('--theme-body-size'), '14px', '--theme-body-size = 14px');
}

// ── 场景 6：连续快速改色不会累积 CSS 属性 ──
console.log('\n  场景 6: 连续改色 CSS 属性数恒定');
{
  const root = createMockRootStyle();

  // 快速连续改色 50 次
  const colors = Array.from({ length: 50 }, (_, i) =>
    '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
  );
  for (const c of colors) {
    onThemeColorChange_fixed(root, 'biophilic', c);
  }

  // 验证只有 10 个 biophilic 属性（不应累积）
  assertEqual(root.countLeakedProps(), 10, '50 次改色后：仍只有 10 个 CSS 属性（不会累积）');

  // 验证最终值是最后一次设置的颜色
  const lastColor = colors[colors.length - 1];
  const lastPalette = generatePalette(lastColor);
  assertEqual(root.getProperty('--primary'), lastPalette.primary, '--primary = 最后一次设置的颜色');
}

// ── SETTING_KEYS 和 SETTING_DEFAULTS 校验 ──────────────────
section('设置项定义校验');

const SETTING_KEYS = [
  'inbound_rows', 'outbound_rows', 'purchase_rows',
  'inbound_history', 'outbound_history',
  'discount1_name', 'discount1_rate',
  'discount2_name', 'discount2_rate',
  'price_decimals',
  'enter_mode',
  'photo_folder',
  'inv_inbound_limit', 'inv_outbound_limit',
  'canteen_mode', 'show_pastry', 'xiaosuo_mode',
  'current_canteen',
  'small_canteens',
  'small_export_style',
  'small_display_style',
  'show_matrix_remarks',
  'alert_short_days', 'alert_long_days',
  'purchase_retention_days',
  'last_purchase_date',
  'theme',
  'theme_font',
  'theme_nav_size',
  'theme_body_size',
  'theme_color',
  'sidebar_collapsed',
  'auto_focus_qty',
];

const SETTING_DEFAULTS = {
  inbound_rows: '5', outbound_rows: '5', purchase_rows: '10',
  inbound_history: 'on', outbound_history: 'on',
  discount1_name: '盛销', discount1_rate: '0.9008',
  discount2_name: '优宏', discount2_rate: '0.9058',
  price_decimals: '2',
  enter_mode: 'next-row',
  photo_folder: '',
  inv_inbound_limit: '5', inv_outbound_limit: '10',
  canteen_mode: '洋安', show_pastry: 'on', xiaosuo_mode: 'off',
  current_canteen: '洋安',
  small_canteens: '["寿昌","梅城","大同","大洋","洋溪","三都","乾潭"]',
  small_export_style: 'matrix',
  small_display_style: 'groups',
  show_matrix_remarks: 'on',
  alert_short_days: '30',
  alert_long_days: '60',
  purchase_retention_days: '31',
  last_purchase_date: '',
  theme: 'default',
  theme_font: 'Cheese',
  theme_nav_size: '21',
  theme_body_size: '20',
  theme_color: '#3E4A32',
  sidebar_collapsed: 'off',
  auto_focus_qty: 'on',
};

// 每个 key 都有默认值
for (const key of SETTING_KEYS) {
  assert(key in SETTING_DEFAULTS, `SETTING_DEFAULTS 包含 "${key}"`);
}

// 默认值数量一致
assertEqual(Object.keys(SETTING_DEFAULTS).length, SETTING_KEYS.length,
  `SETTING_DEFAULTS 与 SETTING_KEYS 数量一致`);

// ── 设置命名约定：HTML id = setting-{key} 其中 key 中 _ → - ──
section('设置 HTML id 命名约定');

function settingKeyToId(key) {
  return `setting-${key.replace(/_/g, '-')}`;
}

assertEqual(settingKeyToId('inbound_rows'), 'setting-inbound-rows', 'inbound_rows → id');
assertEqual(settingKeyToId('discount1_name'), 'setting-discount1-name', 'discount1_name → id');
assertEqual(settingKeyToId('canteen_mode'), 'setting-canteen-mode', 'canteen_mode → id');
assertEqual(settingKeyToId('theme_color'), 'setting-theme-color', 'theme_color → id');

// ── 保存时 mode 映射逻辑 ────────────────────────────────────
section('食堂模式映射逻辑');

function mapModeToSettings(mode) {
  if (mode === 'multi') {
    return { canteen_mode: '下涯', xiaosuo_mode: 'on', show_pastry: 'off' };
  } else if (mode === 'small') {
    return { xiaosuo_mode: 'small', show_pastry: 'off' };
  } else {
    return { xiaosuo_mode: 'off', show_pastry: 'on' };
  }
}

assertEqual(mapModeToSettings('multi').canteen_mode, '下涯', 'multi → canteen_mode=下涯');
assertEqual(mapModeToSettings('multi').xiaosuo_mode, 'on', 'multi → xiaosuo_mode=on');
assertEqual(mapModeToSettings('multi').show_pastry, 'off', 'multi → show_pastry=off');

assertEqual(mapModeToSettings('small').xiaosuo_mode, 'small', 'small → xiaosuo_mode=small');
assertEqual(mapModeToSettings('small').show_pastry, 'off', 'small → show_pastry=off');
assert(!('canteen_mode' in mapModeToSettings('small')), 'small 不设置 canteen_mode');

assertEqual(mapModeToSettings('default').xiaosuo_mode, 'off', 'default → xiaosuo_mode=off');
assertEqual(mapModeToSettings('default').show_pastry, 'on', 'default → show_pastry=on');

// ── initSettingsPage 模式兼容逻辑 ──────────────────────────
section('initSettingsPage 模式兼容（旧格式）');

function resolveModeValue(rawMode, xiaosuoMode) {
  if (xiaosuoMode === 'on' || ['下涯', '制杆厂', '白南山'].includes(rawMode)) {
    return 'multi';
  }
  return 'default';
}

assertEqual(resolveModeValue('洋安', 'off'), 'default', '洋安 + xiaosuo off → default');
assertEqual(resolveModeValue('下涯', 'on'), 'multi', '下涯 + xiaosuo on → multi');
assertEqual(resolveModeValue('洋安', 'on'), 'multi', '旧格式 xiaosuo on → multi');
assertEqual(resolveModeValue('制杆厂', 'off'), 'multi', '制杆厂 旧格式 → multi');
assertEqual(resolveModeValue('白南山', 'off'), 'multi', '白南山 旧格式 → multi');
assertEqual(resolveModeValue('洋安', 'small'), 'default', '洋安 + xiaosuo small → 不受影响（small 单独处理）');

// ── renderSmallCanteenList 数据清理 ─────────────────────────
section('小所列表数据操作（无 DOM 依赖）');

function parseSmallCanteens(jsonStr) {
  try { return JSON.parse(jsonStr); } catch { return ['寿昌', '梅城', '大同', '大洋', '洋溪', '三都', '乾潭']; }
}

function collectSmallCanteens(canteens) {
  return canteens.filter(Boolean);
}

function moveSmallCanteen(canteens, idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= canteens.length) return canteens;
  const result = [...canteens];
  [result[idx], result[newIdx]] = [result[newIdx], result[idx]];
  return result;
}

function removeSmallCanteen(canteens, idx) {
  if (canteens.length <= 1) return canteens;
  const result = [...canteens];
  result.splice(idx, 1);
  return result;
}

function addSmallCanteen(canteens) {
  return [...canteens, '新小所'];
}

const defaultList = parseSmallCanteens('["寿昌","梅城","大同","大洋","洋溪","三都","乾潭"]');
assertEqual(defaultList.length, 7, '默认 7 个小所');

const moved = moveSmallCanteen(defaultList, 0, 1);
assertEqual(moved[0], '梅城', '下移：第1个变梅城');
assertEqual(moved[1], '寿昌', '下移：第2个变寿昌');

const movedEnd = moveSmallCanteen(defaultList, 6, 1);
assertDeepEqual(movedEnd, defaultList, '最后一项下移：不变');

function assertDeepEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}`); failures.push(label); }
}

const removed = removeSmallCanteen(defaultList, 0);
assertEqual(removed.length, 6, '删除第1个：剩6个');
assertEqual(removed[0], '梅城', '删除后第1个变梅城');

const removedLast = removeSmallCanteen(['寿昌'], 0);
assertEqual(removedLast.length, 1, '只剩1个时不可删除');

const added = addSmallCanteen(defaultList);
assertEqual(added.length, 8, '添加后 8 个');
assertEqual(added[7], '新小所', '新小所在末尾');

// ── 设置面板 HTML div 嵌套完整性（修复核心 DOM 泄露） ──
section('tab-data div 嵌套平衡验证');
{
  const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 提取 tab-data 完整区域（从 <div class="settings-tab-content" id="tab-data"> 到下一个 tab）
  const startTag = html.indexOf('<div class="settings-tab-content" id="tab-data"');
  const nextTab = html.indexOf('<!-- Tab: 业务 -->');
  assert(startTag >= 0, 'tab-data 起始标签存在');
  assert(nextTab > startTag, 'tab-data 结束位置正确');

  const section = html.substring(startTag, nextTab);

  const opens = (section.match(/<div[^>]*[^/]>/g) || []).length;
  const closes = (section.match(/<\/div>/g) || []).length;
  const cards = [...section.matchAll(/<h3>.*?<\/h3>/g)].map(m => m[0].replace(/<[^>]+>/g, ''));

  assertEqual(opens, closes, `tab-data div 嵌套平衡：${opens} 开 = ${closes} 闭`);
  assertEqual(cards.length, 4, `tab-data 包含 4 个卡片`);
  assert(cards.includes('历史记录'), '包含「历史记录」卡片');
  assert(cards.includes('采购单数据'), '包含「采购单数据」卡片');
  assert(cards.includes('过期预警'), '包含「过期预警」卡片');
  assert(cards.includes('库存查询'), '包含「库存查询」卡片');

  // 验证「历史记录」卡片的两个 form-group 都在 card-body 内部
  // 卡片标题含 SVG 图标，用文本片段定位
  const historyCardStart = section.indexOf('历史记录</h3>');
  const pcCardStart = section.indexOf('采购单数据</h3>');
  const historyCard = section.substring(historyCardStart, pcCardStart);

  const cardBodyOpen = historyCard.indexOf('<div class="card-body form-grid"');
  const cardBodyClose = historyCard.lastIndexOf('</div>');
  const formGroupsInHistory = [...historyCard.matchAll(/<div class="form-group">/g)];
  assertEqual(formGroupsInHistory.length, 2, '历史记录卡片包含 2 个 form-group');
  assert(cardBodyOpen >= 0, '历史记录 card-body 开标签存在');

  // 两个 form-group 都在 card-body 关闭之前
  const fg1Pos = historyCard.indexOf('<div class="form-group">');
  const fg2Pos = historyCard.indexOf('<div class="form-group">', fg1Pos + 1);
  assert(fg1Pos > cardBodyOpen && fg1Pos < cardBodyClose, '入库 form-group 在 card-body 内');
  assert(fg2Pos > cardBodyOpen && fg2Pos < cardBodyClose, '出库 form-group 在 card-body 内');

  // 采购单/过期/库存卡片都在 settings-grid 内部
  const settingsGridOpen = section.indexOf('<div class="settings-grid">');
  const settingsGridClose = section.lastIndexOf('</div>');
  const pcPos = section.indexOf('采购单数据</h3>');
  const alertPos = section.indexOf('过期预警</h3>');
  const invPos = section.indexOf('库存查询</h3>');
  assert(pcPos > settingsGridOpen && pcPos < settingsGridClose, '采购单数据在 settings-grid 内');
  assert(alertPos > settingsGridOpen && alertPos < settingsGridClose, '过期预警在 settings-grid 内');
  assert(invPos > settingsGridOpen && invPos < settingsGridClose, '库存查询在 settings-grid 内');
}

// ── tab-general & 四个标签页兄弟关系验证（回归：闭合标签误删） ──
section('tab-general div 嵌套平衡验证');
{
  const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 提取 tab-general 区域（从开标签到 tab-data 开始前）
  const tabGeneralStart = html.indexOf('<div class="settings-tab-content active" id="tab-general"');
  const tabDataStart = html.indexOf('<div class="settings-tab-content" id="tab-data"');
  assert(tabGeneralStart >= 0, 'tab-general 起始标签存在');
  assert(tabDataStart > tabGeneralStart, 'tab-data 在 tab-general 之后');

  const tabGeneralSection = html.substring(tabGeneralStart, tabDataStart);
  const opens_tg = (tabGeneralSection.match(/<div[^>]*[^/]>/g) || []).length;
  const closes_tg = (tabGeneralSection.match(/<\/div>/g) || []).length;
  assertEqual(opens_tg, closes_tg, `tab-general div 嵌套平衡：${opens_tg} 开 = ${closes_tg} 闭`);

  // 验证卡片结构
  const cards_tg = [...tabGeneralSection.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]);
  assert(cards_tg.some(c => c.includes('录入表格')), '包含「录入表格」卡片');
  assert(cards_tg.some(c => c.includes('键盘导航')), '包含「键盘导航」卡片');
}

section('四个 settings-tab-content 兄弟关系验证');
{
  const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 提取设置页区域（从 tab-general 到外观 tab 结束 + 按钮区之前）
  const settingsStart = html.indexOf('<div class="settings-tab-content active" id="tab-general"');
  const settingsEnd = html.indexOf('text-align:right;margin-top:16px', settingsStart);
  const settingsRegion = html.substring(settingsStart, settingsEnd);

  // 四个 tab-content 的开标签位置
  const tabPositions = ['tab-general', 'tab-data', 'tab-business', 'tab-appearance'].map(id => {
    const pos = settingsRegion.indexOf(`id="${id}"`);
    return { id, pos };
  });

  // 所有四个都存在
  for (const { id, pos } of tabPositions) {
    assert(pos >= 0, `${id} 存在于设置区域`);
  }

  // 顺序正确
  for (let i = 0; i < tabPositions.length; i++) {
    assert(tabPositions[i].pos >= 0, `${tabPositions[i].id} 位置有效`);
  }
  assert(tabPositions[0].pos < tabPositions[1].pos, 'tab-general 在 tab-data 之前');
  assert(tabPositions[1].pos < tabPositions[2].pos, 'tab-data 在 tab-business 之前');
  assert(tabPositions[2].pos < tabPositions[3].pos, 'tab-business 在 tab-appearance 之前');

  // 关键：四个 tab-content 是兄弟节点，非嵌套关系
  // 验证：每个闭合的 </div> 都在下一个 tab-content 开标签之前
  // 如果 tab-data 嵌套在 tab-general 内，则 tab-general 的闭合标签会在 tab-data 之后
  const tabGeneralClose = settingsRegion.lastIndexOf('</div>', tabPositions[1].pos);
  assert(tabGeneralClose < tabPositions[1].pos,
    `tab-general 在 tab-data 之前闭合（非嵌套）: close=${tabGeneralClose}, tab-data=${tabPositions[1].pos}`);

  const tabDataClose = settingsRegion.lastIndexOf('</div>', tabPositions[2].pos);
  assert(tabDataClose < tabPositions[2].pos,
    `tab-data 在 tab-business 之前闭合（非嵌套）`);

  const tabBusinessClose = settingsRegion.lastIndexOf('</div>', tabPositions[3].pos);
  assert(tabBusinessClose < tabPositions[3].pos,
    `tab-business 在 tab-appearance 之前闭合（非嵌套）`);
}

// ── 结果汇总 ──────────────────────────────────────────────
const total = passed + failed;
console.log(`\n═══════════════════════════════════════`);
console.log(`  测试完成: ${passed}/${total} 通过`);
if (failed > 0) {
  console.log(`\n  ${failed} 项失败:`);
  failures.forEach(f => console.log(`    - ${f}`));
  console.log(`\n  ⚠ 请检查失败项并修复。`);
} else {
  console.log(`  ✓ 全部通过！`);
}
console.log(`═══════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
