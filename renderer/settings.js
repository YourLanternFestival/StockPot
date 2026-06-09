// ===== Settings Page =====
const SETTING_KEYS = [
  'inbound_rows', 'outbound_rows', 'purchase_rows',
  'inbound_history', 'inbound_history_days',
  'outbound_history', 'outbound_history_days',
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
  'last_purchase_date',
  'theme',
  'theme_font',
  'theme_nav_size',
  'theme_body_size',
  'theme_color',
  'sidebar_collapsed',
];

const SETTING_DEFAULTS = {
  inbound_rows: '5', outbound_rows: '5', purchase_rows: '10',
  inbound_history: 'on', inbound_history_days: '20',
  outbound_history: 'on', outbound_history_days: '20',
  discount1_name: '盛销', discount1_rate: '0.92',
  discount2_name: '优宏', discount2_rate: '0.90',
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
  last_purchase_date: '',
  theme: 'default',
  theme_font: 'Cheese',
  theme_nav_size: '21',
  theme_body_size: '20',
  theme_color: '#3E4A32',
  sidebar_collapsed: 'off',
};

async function initSettingsPage() {
  try {
    const settings = await window.api.getAllSettings();
    document.getElementById('setting-inbound-rows').value = settings.inbound_rows || SETTING_DEFAULTS.inbound_rows;
    document.getElementById('setting-outbound-rows').value = settings.outbound_rows || SETTING_DEFAULTS.outbound_rows;
    document.getElementById('setting-purchase-rows').value = settings.purchase_rows || SETTING_DEFAULTS.purchase_rows;
    document.getElementById('setting-inbound-history').value = settings.inbound_history || SETTING_DEFAULTS.inbound_history;
    document.getElementById('setting-inbound-history-days').value = settings.inbound_history_days || SETTING_DEFAULTS.inbound_history_days;
    document.getElementById('setting-outbound-history').value = settings.outbound_history || SETTING_DEFAULTS.outbound_history;
    document.getElementById('setting-outbound-history-days').value = settings.outbound_history_days || SETTING_DEFAULTS.outbound_history_days;
    document.getElementById('setting-discount1-name').value = settings.discount1_name || SETTING_DEFAULTS.discount1_name;
    document.getElementById('setting-discount1-rate').value = settings.discount1_rate || SETTING_DEFAULTS.discount1_rate;
    document.getElementById('setting-discount2-name').value = settings.discount2_name || SETTING_DEFAULTS.discount2_name;
    document.getElementById('setting-discount2-rate').value = settings.discount2_rate || SETTING_DEFAULTS.discount2_rate;
    document.getElementById('setting-price-decimals').value = settings.price_decimals || SETTING_DEFAULTS.price_decimals;
    document.getElementById('setting-enter-mode').value = settings.enter_mode || SETTING_DEFAULTS.enter_mode;
    document.getElementById('setting-photo-folder').value = settings.photo_folder || SETTING_DEFAULTS.photo_folder;
    document.getElementById('setting-alert-short-days').value = settings.alert_short_days || SETTING_DEFAULTS.alert_short_days;
    document.getElementById('setting-alert-long-days').value = settings.alert_long_days || SETTING_DEFAULTS.alert_long_days;
    // 主题
    const themeEl = document.getElementById('setting-theme');
    if (themeEl) themeEl.value = settings.theme || SETTING_DEFAULTS.theme;
    const fontEl = document.getElementById('setting-theme-font');
    if (fontEl) fontEl.value = settings.theme_font || SETTING_DEFAULTS.theme_font;
    const navSizeEl = document.getElementById('setting-theme-nav-size');
    if (navSizeEl) navSizeEl.value = settings.theme_nav_size || SETTING_DEFAULTS.theme_nav_size;
    const bodySizeEl = document.getElementById('setting-theme-body-size');
    if (bodySizeEl) bodySizeEl.value = settings.theme_body_size || SETTING_DEFAULTS.theme_body_size;
    const colorEl = document.getElementById('setting-theme-color');
    if (colorEl) {
      const c = settings.theme_color || SETTING_DEFAULTS.theme_color;
      colorEl.value = c;
      previewThemeColor(c);
    }
    document.getElementById('setting-inv-inbound-limit').value = settings.inv_inbound_limit || SETTING_DEFAULTS.inv_inbound_limit;
    document.getElementById('setting-inv-outbound-limit').value = settings.inv_outbound_limit || SETTING_DEFAULTS.inv_outbound_limit;
    // 食堂模式：兼容旧格式
    const rawMode = settings.canteen_mode || SETTING_DEFAULTS.canteen_mode;
    const xiaosuoMode = settings.xiaosuo_mode || SETTING_DEFAULTS.xiaosuo_mode;
    let modeValue = 'default';
    if (xiaosuoMode === 'on' || ['下涯','制杆厂','白南山'].includes(rawMode)) {
      modeValue = 'multi';
    }
    document.getElementById('setting-canteen-mode').value = modeValue;
    // 小所配置
    renderSmallCanteenList(settings.small_canteens || SETTING_DEFAULTS.small_canteens);
    const styleEl = document.getElementById('setting-small-export-style');
    if (styleEl) styleEl.value = settings.small_export_style || SETTING_DEFAULTS.small_export_style;
    const displayStyleEl = document.getElementById('setting-small-display-style');
    if (displayStyleEl) displayStyleEl.value = settings.small_display_style || SETTING_DEFAULTS.small_display_style;
    toggleSmallCanteenConfig();
  } catch (err) {
    console.error('Load settings error:', err);
  }
}

async function selectPhotoFolder() {
  const folder = await window.api.selectFolder();
  if (folder) {
    document.getElementById('setting-photo-folder').value = folder;
  }
}

async function saveSettings() {
  try {
    for (const key of SETTING_KEYS) {
      const el = document.getElementById(`setting-${key.replace(/_/g, '-')}`);
      if (el) await window.api.setSetting(key, el.value);
    }

    // 食堂模式：将新模式映射到旧的 canteen_mode / xiaosuo_mode / show_pastry
    const mode = document.getElementById('setting-canteen-mode').value;
    if (mode === 'multi') {
      await window.api.setSetting('canteen_mode', '下涯');
      await window.api.setSetting('xiaosuo_mode', 'on');
      await window.api.setSetting('show_pastry', 'off');
    } else if (mode === 'small') {
      await window.api.setSetting('xiaosuo_mode', 'small');
      await window.api.setSetting('show_pastry', 'off');
      // 保存小所配置
      const canteens = collectSmallCanteens();
      await window.api.setSetting('small_canteens', JSON.stringify(canteens));
    } else {
      await window.api.setSetting('xiaosuo_mode', 'off');
      await window.api.setSetting('show_pastry', 'on');
      // current_canteen 由采购单页的切换按钮控制，这里不覆盖
    }

    await loadAppSettings();
    if (document.getElementById('page-purchase').classList.contains('active')) {
      applyCanteenMode();
    }
    showToast('设置已保存');
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

async function loadAppSettings() {
  try {
    const s = await window.api.getAllSettings();
    const g = (k) => s[k] || SETTING_DEFAULTS[k];
    APP_SETTINGS = {
      inbound_rows: parseInt(g('inbound_rows')) || 5,
      outbound_rows: parseInt(g('outbound_rows')) || 5,
      purchase_rows: parseInt(g('purchase_rows')) || 10,
      inbound_history: g('inbound_history'),
      inbound_history_days: parseInt(g('inbound_history_days')) || 20,
      outbound_history: g('outbound_history'),
      outbound_history_days: parseInt(g('outbound_history_days')) || 20,
      discount1_name: g('discount1_name'),
      discount1_rate: g('discount1_rate'),
      discount2_name: g('discount2_name'),
      discount2_rate: g('discount2_rate'),
      price_decimals: parseInt(g('price_decimals')) || 2,
      photo_folder: g('photo_folder'),
      inv_inbound_limit: parseInt(g('inv_inbound_limit')) || 5,
      inv_outbound_limit: parseInt(g('inv_outbound_limit')) || 10,
      canteen_mode: g('canteen_mode'),
      show_pastry: g('show_pastry'),
      xiaosuo_mode: g('xiaosuo_mode'),
      current_canteen: g('current_canteen') || g('canteen_mode') || '洋安',
      small_canteens: JSON.parse(g('small_canteens')),
      small_export_style: g('small_export_style'),
      small_display_style: g('small_display_style'),
      show_matrix_remarks: g('show_matrix_remarks'),
      alert_short_days: parseInt(g('alert_short_days')) || 30,
      alert_long_days: parseInt(g('alert_long_days')) || 60,
      last_purchase_date: g('last_purchase_date') || '',
    };
    ENTER_MODE = g('enter_mode');
    // 同步到询价页内联折扣输入框
    syncDiscountToInquiry();
    // 应用主题
    applyTheme(g('theme'), g('theme_font'), g('theme_nav_size'), g('theme_body_size'), g('theme_color'));
  } catch (err) {
    console.error('Load app settings error:', err);
  }
}

function applyTheme(theme, font, navSize, bodySize, color) {
  const css = document.getElementById('theme-biophilic-css');
  if (!css) return;
  if (theme === 'biophilic') {
    css.disabled = false;
    document.body.classList.add('theme-biophilic');
  } else {
    css.disabled = true;
    document.body.classList.remove('theme-biophilic');
  }
  // 应用字体
  if (font) document.documentElement.style.setProperty('--theme-font', font);
  // 应用字号
  if (navSize) document.documentElement.style.setProperty('--theme-nav-size', navSize + 'px');
  if (bodySize) document.documentElement.style.setProperty('--theme-body-size', bodySize + 'px');
  // 应用主色调
  if (color) applyThemeColor(color);
}

// ===== 主色调配色生成 =====
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

function applyThemeColor(hex) {
  const palette = generatePalette(hex);
  const root = document.documentElement;
  // 全局应用色板到所有 CSS 变量
  root.style.setProperty('--primary', palette.primary);
  root.style.setProperty('--primary-hover', palette.sage);
  root.style.setProperty('--primary-light', palette.leaf);
  root.style.setProperty('--sidebar-bg', palette.primary);
  root.style.setProperty('--sidebar-active', palette.moss + '30');
  root.style.setProperty('--text', palette.primary);
  root.style.setProperty('--text-secondary', palette.sage);
  root.style.setProperty('--border', palette.leaf);
  root.style.setProperty('--bg', palette.cream);
  root.style.setProperty('--card-bg', 'rgba(255,255,255,0.75)');
  // 更新预览色块
  const ids = { 'tc-primary': palette.primary, 'tc-sage': palette.sage, 'tc-moss': palette.moss, 'tc-leaf': palette.leaf, 'tc-cream': palette.cream };
  for (const [id, color] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.style.background = color;
  }
  const hexEl = document.getElementById('theme-color-hex');
  if (hexEl) hexEl.textContent = hex;
}

function previewThemeColor(hex) {
  applyThemeColor(hex);
}

function resetThemeColor() {
  const defaultColor = '#3E4A32';
  document.getElementById('setting-theme-color').value = defaultColor;
  applyThemeColor(defaultColor);
}

function syncDiscountToInquiry() {
  const sxEl = document.getElementById('discount-shengxiao');
  const yhEl = document.getElementById('discount-youhong');
  if (sxEl) sxEl.value = APP_SETTINGS.discount1_rate;
  if (yhEl) yhEl.value = APP_SETTINGS.discount2_rate;
  // 更新表头折扣名称
  const h1 = document.getElementById('header-discount1');
  const h2 = document.getElementById('header-discount2');
  if (h1) h1.textContent = APP_SETTINGS.discount1_name + '价';
  if (h2) h2.textContent = APP_SETTINGS.discount2_name + '价';
}

// ===== 小所配置 =====
function renderSmallCanteenList(jsonStr) {
  let canteens;
  try { canteens = JSON.parse(jsonStr); } catch { canteens = ['寿昌','梅城','大同','大洋','洋溪','三都','乾潭']; }
  const container = document.getElementById('small-canteen-list');
  if (!container) return;
  container.innerHTML = canteens.map((name, idx) => `
    <div class="small-canteen-item" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span style="color:var(--text-muted);min-width:20px;">${idx + 1}.</span>
      <input type="text" class="form-control" value="${name}" style="flex:1;" data-idx="${idx}">
      <button class="btn btn-sm" onclick="moveSmallCanteen(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn btn-sm" onclick="moveSmallCanteen(${idx}, 1)" ${idx === canteens.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="removeSmallCanteen(${idx})">✕</button>
    </div>
  `).join('');
}

function collectSmallCanteens() {
  const items = document.querySelectorAll('#small-canteen-list input[type="text"]');
  return Array.from(items).map(el => el.value.trim()).filter(Boolean);
}

function addSmallCanteen() {
  const container = document.getElementById('small-canteen-list');
  const items = container.querySelectorAll('input[type="text"]');
  const canteens = Array.from(items).map(el => el.value.trim());
  canteens.push('新小所');
  renderSmallCanteenList(JSON.stringify(canteens));
}

function removeSmallCanteen(idx) {
  const canteens = collectSmallCanteens();
  if (canteens.length <= 1) { showToast('至少保留一个小所', 'error'); return; }
  canteens.splice(idx, 1);
  renderSmallCanteenList(JSON.stringify(canteens));
}

function moveSmallCanteen(idx, dir) {
  const canteens = collectSmallCanteens();
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= canteens.length) return;
  [canteens[idx], canteens[newIdx]] = [canteens[newIdx], canteens[idx]];
  renderSmallCanteenList(JSON.stringify(canteens));
}

function toggleSmallCanteenConfig() {
  const mode = document.getElementById('setting-canteen-mode').value;
  const section = document.getElementById('small-canteen-config');
  if (section) section.style.display = mode === 'small' ? 'block' : 'none';
}

// 切换小所填写样式时提示数据丢失
function onSmallDisplayStyleChange(newStyle) {
  const currentStyle = APP_SETTINGS.small_display_style || 'groups';
  if (newStyle !== currentStyle) {
    if (!confirm('切换填写样式会清空当前未保存的采购单数据，确定继续？')) {
      document.getElementById('setting-small-display-style').value = currentStyle;
      return;
    }
  }
}
