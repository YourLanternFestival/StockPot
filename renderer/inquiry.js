// ===== Inquiry Management =====
let inquiryData = [];
let prevMonthData = {};

async function initInquiryPage() {
  await loadInquiryMonths();
  await loadInquiryItems();
}

async function loadInquiryMonths() {
  try {
    const months = await window.api.getInquiryMonths();
    const select = document.getElementById('inquiry-month');
    select.innerHTML = '<option value="">请选择月份</option>';

    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.month;
      opt.textContent = m.month;
      select.appendChild(opt);
    });

    // Select the latest month
    if (months.length > 0) {
      select.value = months[0].month;
    }
  } catch (err) {
    console.error('Load inquiry months error:', err);
  }
}

async function loadInquiryItems() {
  const month = document.getElementById('inquiry-month').value;
  const category = document.getElementById('inquiry-category').value;

  if (!month) {
    document.getElementById('inquiry-body').innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">请先导入鉴证表数据</td></tr>';
    document.getElementById('inquiry-count').textContent = '0 条';
    return;
  }

  try {
    inquiryData = await window.api.getInquiryItems(month, category);

    // Load previous month data for comparison (key: name + spec)
    const prevMonth = getPreviousMonth(month);
    if (prevMonth) {
      const prevItems = await window.api.getInquiryItems(prevMonth);
      prevMonthData = {};
      prevItems.forEach(item => {
        // Use name + spec as key for comparison
        const key = `${item.name}|${item.spec || ''}`;
        prevMonthData[key] = item.price;
      });
    } else {
      prevMonthData = {};
    }

    renderInquiryTable(inquiryData);
  } catch (err) {
    console.error('Load inquiry items error:', err);
  }
}

function getPreviousMonth(month) {
  // month format: "2026-06"
  const [year, mon] = month.split('-').map(Number);
  if (mon === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(mon - 1).padStart(2, '0')}`;
}

function renderInquiryTable(items) {
  const tbody = document.getElementById('inquiry-body');
  const discountSX = parseFloat(document.getElementById('discount-shengxiao').value) || 0.9008;
  const discountYH = parseFloat(document.getElementById('discount-youhong').value) || 0.9058;
  const dec = APP_SETTINGS.price_decimals;
  const factor = Math.pow(10, dec);

  document.getElementById('inquiry-count').textContent = `${items.length} 条`;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-muted);">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const priceSX = item.price ? Math.round(item.price * discountSX * factor) / factor : null;
    const priceYH = item.price ? Math.round(item.price * discountYH * factor) / factor : null;

    // Calculate price change using discounted price (第一折扣价)
    const key = `${item.name}|${item.spec || ''}`;
    const prevPrice = prevMonthData[key];
    let changeHtml = '';
    if (prevPrice && item.price) {
      const currentDiscounted = Math.round(item.price * discountSX * factor) / factor;
      const prevDiscounted = Math.round(prevPrice * discountSX * factor) / factor;
      const diff = Math.round((currentDiscounted - prevDiscounted) * factor) / factor;
      if (diff > 0) {
        changeHtml = `<span class="price-up">↑${diff.toFixed(dec)}</span>`;
      } else if (diff < 0) {
        changeHtml = `<span class="price-down">↓${Math.abs(diff).toFixed(dec)}</span>`;
      } else {
        changeHtml = '<span class="price-same">-</span>';
      }
    } else if (!prevPrice && item.price) {
      changeHtml = '<span class="price-na">新增</span>';
    } else {
      changeHtml = '<span class="price-na">-</span>';
    }

    const imageCellId = `img-cell-${idx}`;

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.category}</td>
        <td style="text-align:left;">${item.name}</td>
        <td>${item.price ? Number(item.price).toFixed(dec) : '-'}</td>
        <td>${priceSX != null ? priceSX.toFixed(dec) : '-'}</td>
        <td>${priceYH != null ? priceYH.toFixed(dec) : '-'}</td>
        <td>${item.unit || ''}</td>
        <td>${item.spec || ''}</td>
        <td>${changeHtml}</td>
        <td>${item.remark || ''}</td>
        <td id="${imageCellId}" class="image-cell">
          <button class="btn btn-sm btn-image-add" onclick="addInquiryImage(this, '${item.name.replace(/'/g, "\\'")}', '${(item.spec || '').replace(/'/g, "\\'")}')" data-tooltip="为该询价项添加实物照片">📷</button>
        </td>
        <td>
          <button class="btn btn-sm" onclick='editInquiryItem(${JSON.stringify(item).replace(/'/g, "&#39;")})'>编辑</button>
          <button class="btn btn-sm" onclick='copyInquiryItem(${JSON.stringify(item).replace(/'/g, "&#39;")})' data-tooltip="复制该条询价记录">📋</button>
          <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteInquiryItem(${item.id})" data-tooltip="删除该条询价记录">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  // Load images asynchronously
  loadInquiryImages(items);
}

function editInquiryItem(item) {
  openModal('编辑询价记录', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group">
        <label>分类</label>
        <select class="form-control" id="edit-inquiry-category">
          <option value="米面粮油类" ${item.category === '米面粮油类' ? 'selected' : ''}>米面粮油类</option>
          <option value="肉禽蛋类" ${item.category === '肉禽蛋类' ? 'selected' : ''}>肉禽蛋类</option>
          <option value="水果蔬菜及豆制品类" ${item.category === '水果蔬菜及豆制品类' ? 'selected' : ''}>水果蔬菜及豆制品类</option>
          <option value="速冻食品类" ${item.category === '速冻食品类' ? 'selected' : ''}>速冻食品类</option>
          <option value="乳品饮料类" ${item.category === '乳品饮料类' ? 'selected' : ''}>乳品饮料类</option>
          <option value="海鲜水产类" ${item.category === '海鲜水产类' ? 'selected' : ''}>海鲜水产类</option>
          <option value="干货调料及腌制品类" ${item.category === '干货调料及腌制品类' ? 'selected' : ''}>干货调料及腌制品类</option>
        </select>
      </div>
      <div class="form-group">
        <label>品名</label>
        <input type="text" class="form-control" id="edit-inquiry-name" value="${item.name}">
      </div>
      <div class="form-group">
        <label>评估价格</label>
        <input type="number" class="form-control" id="edit-inquiry-price" value="${item.price || ''}" step="0.1">
      </div>
      <div class="form-group">
        <label>单位</label>
        <input type="text" class="form-control" id="edit-inquiry-unit" value="${item.unit || ''}">
      </div>
      <div class="form-group">
        <label>规格</label>
        <input type="text" class="form-control" id="edit-inquiry-spec" value="${item.spec || ''}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" class="form-control" id="edit-inquiry-remark" value="${item.remark || ''}">
      </div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditInquiryItem(${item.id})">保存</button>
  `);
}

async function doEditInquiryItem(id) {
  const data = {
    category: document.getElementById('edit-inquiry-category').value,
    name: document.getElementById('edit-inquiry-name').value.trim(),
    price: parseFloat(document.getElementById('edit-inquiry-price').value) || null,
    unit: document.getElementById('edit-inquiry-unit').value.trim(),
    spec: document.getElementById('edit-inquiry-spec').value.trim(),
    remark: document.getElementById('edit-inquiry-remark').value.trim()
  };

  if (!data.name) {
    showToast('请输入品名', 'error');
    return;
  }

  try {
    await window.api.updateInquiryItem(id, data);
    closeModal();
    showToast('已更新');
    await loadInquiryItems();
  } catch (err) {
    showToast('更新失败: ' + err.message, 'error');
  }
}

async function copyInquiryItem(item) {
  const month = document.getElementById('inquiry-month').value;
  if (!month) { showToast('请先选择月份', 'error'); return; }
  await showAddInquiryItem();
  const nameEl = document.getElementById('new-inquiry-name');
  const catEl = document.getElementById('new-inquiry-category');
  const unitEl = document.getElementById('new-inquiry-unit');
  const specEl = document.getElementById('new-inquiry-spec');
  const priceEl = document.getElementById('new-inquiry-price');
  if (nameEl) nameEl.value = item.name;
  if (catEl) catEl.value = item.category;
  if (unitEl) unitEl.value = item.unit || '';
  if (specEl) specEl.value = item.spec || '';
  if (priceEl && item.price) priceEl.value = item.price;
}

function deleteInquiryItem(id) {
  openModal('确认删除', '<p>确定要删除这条询价记录吗？</p>', `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteInquiryItem(${id})">确认删除</button>
  `);
}

async function doDeleteInquiryItem(id) {
  try {
    await window.api.deleteInquiryItem(id);
    closeModal();
    showToast('已删除');
    await loadInquiryItems();
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error');
  }
}

async function loadInquiryImages(items) {
  const photoFolder = APP_SETTINGS.photo_folder;
  if (!photoFolder) return;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const cell = document.getElementById(`img-cell-${idx}`);
    if (!cell) continue;

    try {
      const imagePath = await window.api.findImage(item.name, item.spec, photoFolder);
      if (imagePath) {
        const imgUrl = 'file:///' + imagePath.replace(/\\/g, '/');
        cell.innerHTML = `<img src="${imgUrl}" class="inquiry-thumb" onclick="viewImage(this.src)" data-tooltip="点击查看大图">`;
      }
    } catch (err) {
      console.error('Load image error:', err);
    }
  }
}

async function addInquiryImage(btn, name, spec) {
  const photoFolder = APP_SETTINGS.photo_folder;
  if (!photoFolder) {
    showToast('请先在设置中配置照片文件夹路径', 'error');
    return;
  }

  const result = await window.api.addImage(name, spec, photoFolder);
  if (result.success) {
    showToast('图片添加成功');
    const cell = btn.closest('td');
    if (cell) {
      const imgUrl = 'file:///' + result.path.replace(/\\/g, '/');
      cell.innerHTML = `<img src="${imgUrl}" class="inquiry-thumb" onclick="viewImage(this.src)" data-tooltip="点击查看大图">`;
    }
  } else if (result.error !== '已取消') {
    showToast('添加失败: ' + result.error, 'error');
  }
}

function viewImage(imageSrc) {
  openModal('实物图片查看', `
    <div style="text-align:center;">
      <img src="${imageSrc}" style="max-width:100%;max-height:70vh;object-fit:contain;">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">关闭</button>
  `);
}

async function searchInquiry() {
  const keyword = document.getElementById('inquiry-search').value.trim();
  const month = document.getElementById('inquiry-month').value;

  if (!keyword) {
    renderInquiryTable(inquiryData);
    return;
  }

  // Filter from current data
  const filtered = inquiryData.filter(item =>
    item.name.toLowerCase().includes(keyword.toLowerCase())
  );
  renderInquiryTable(filtered);
}

// Show import inquiry dialog
async function showImportInquiryDialog() {
  // 动态加载可用月份
  let monthOptions = '<option value="2026-06">2026年6月</option><option value="2026-05">2026年5月</option>';
  try {
    const months = await window.api.getInquiryMonths();
    if (months && months.length > 0) {
      monthOptions = months.map(m => {
        const [y, mo] = m.month.split('-');
        return `<option value="${m.month}">${y}年${parseInt(mo)}月</option>`;
      }).join('');
    }
  } catch (e) { /* fallback to defaults */ }

  openModal('导入鉴证表', `
    <div class="form-group" style="margin-bottom:16px;">
      <label>选择月份</label>
      <select class="form-control" id="import-month">
        ${monthOptions}
      </select>
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label>选择文件</label>
      <div class="import-dropzone" id="inquiry-dropzone" style="padding:20px;">
        <p>点击选择鉴证表文件（.xlsx）</p>
        <input type="file" id="inquiry-file-input" accept=".xlsx" style="display:none;" onchange="handleInquiryFileSelected(this)">
        <button class="btn btn-primary" onclick="document.getElementById('inquiry-file-input').click()">选择文件</button>
      </div>
      <div id="inquiry-file-name" style="margin-top:8px;color:var(--text-muted);font-size:13px;"></div>
    </div>
    <div id="inquiry-import-preview" style="display:none;">
      <h4 style="margin-bottom:8px;">预览导入数据</h4>
      <div id="inquiry-preview-stats"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" id="btn-start-import-inquiry" onclick="startImportInquiry()" disabled>开始导入</button>
  `);
}

let pendingInquiryData = null;

function handleInquiryFileSelected(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  document.getElementById('inquiry-file-name').textContent = `已选择: ${file.name}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      const items = [];
      const categories = {
        '米面粮油类': '米面粮油类',
        '肉禽蛋类': '肉禽蛋类',
        '水果蔬菜及豆制品类': '水果蔬菜及豆制品类',
        '速冻食品类': '速冻食品类',
        '乳品饮料类': '乳品饮料类',
        '海鲜水产类': '海鲜水产类',
        '干货调料及腌制品类': '干货调料及腌制品类'
      };

      // Parse each sheet
      wb.SheetNames.forEach(sheetName => {
        const category = categories[sheetName];
        if (!category) return;

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Data starts at row 4 (index 3), columns: 序号, 名称, 评估价格, 单位, 规格, 备注
        for (let i = 3; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[1] || '').trim();
          if (!name) continue;
          // 跳过表头残留行
          if (name === '单位' || name === '规格' || name === '名称' || name === '品名') continue;

          items.push({
            category: category,
            name: name,
            price: parseFloat(row[2]) || null,
            unit: String(row[3] || '').trim(),
            spec: String(row[4] || '').trim(),
            remark: String(row[5] || '').trim()
          });
        }
      });

      pendingInquiryData = items;

      // Show preview
      document.getElementById('inquiry-import-preview').style.display = 'block';
      document.getElementById('inquiry-preview-stats').innerHTML =
        `<span class="tag tag-success">共 ${items.length} 条数据</span>`;
      document.getElementById('btn-start-import-inquiry').disabled = false;

    } catch (err) {
      showToast('文件解析失败: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function startImportInquiry() {
  if (!pendingInquiryData) return;

  const month = document.getElementById('import-month').value;

  try {
    const result = await window.api.importInquiryItems(month, pendingInquiryData);
    showToast(`导入成功！共 ${result.imported} 条数据`);
    closeModal();
    pendingInquiryData = null;

    // Refresh
    await loadInquiryMonths();
    document.getElementById('inquiry-month').value = month;
    await loadInquiryItems();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
  }
}

// Show add inquiry item dialog
async function showAddInquiryItem() {
  const month = document.getElementById('inquiry-month').value;
  if (!month) {
    showToast('请先选择月份', 'error');
    return;
  }

  openModal('新增询价单品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group">
        <label>月份</label>
        <input type="text" class="form-control" value="${month}" readonly>
      </div>
      <div class="form-group">
        <label>分类</label>
        <select class="form-control" id="new-inquiry-category">
          <option value="米面粮油类">米面粮油类</option>
          <option value="肉禽蛋类">肉禽蛋类</option>
          <option value="水果蔬菜及豆制品类">水果蔬菜及豆制品类</option>
          <option value="速冻食品类">速冻食品类</option>
          <option value="乳品饮料类">乳品饮料类</option>
          <option value="海鲜水产类">海鲜水产类</option>
          <option value="干货调料及腌制品类">干货调料及腌制品类</option>
        </select>
      </div>
      <div class="form-group" style="position:relative;">
        <label>品名 <span class="required">*</span></label>
        <input type="text" class="form-control" id="new-inquiry-name" placeholder="输入检索或手动输入" autocomplete="off">
        <div class="autocomplete-dropdown" id="new-inquiry-name-dropdown" style="display:none;"></div>
      </div>
      <div class="form-group">
        <label>评估价格</label>
        <input type="number" class="form-control" id="new-inquiry-price" placeholder="可选" step="0.1">
      </div>
      <div class="form-group">
        <label>单位</label>
        <input type="text" class="form-control" id="new-inquiry-unit" placeholder="如: 斤、个、箱">
      </div>
      <div class="form-group">
        <label>规格</label>
        <input type="text" class="form-control" id="new-inquiry-spec" placeholder="如: 10千克/袋">
      </div>
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>备注</label>
        <input type="text" class="form-control" id="new-inquiry-remark" placeholder="可选">
      </div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddInquiryItem('${month}')">保存</button>
  `);

  // 品名自动补全 + 分类/单位/规格联动
  const nameInput = document.getElementById('new-inquiry-name');
  const dropdown = document.getElementById('new-inquiry-name-dropdown');
  const catSelect = document.getElementById('new-inquiry-category');
  let categoryManuallyChanged = false;
  if (catSelect) {
    catSelect.addEventListener('change', () => { categoryManuallyChanged = true; });
  }

  // 确保 PRODUCTS 已加载
  if (PRODUCTS.length === 0) {
    try { PRODUCTS = await window.api.getProducts(); } catch (e) { /* ignore */ }
  }

  if (nameInput && dropdown) {
    nameInput.addEventListener('input', () => {
      const keyword = nameInput.value.trim();
      if (keyword.length < 1) { dropdown.style.display = 'none'; return; }
      const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(keyword.toLowerCase()));
      if (results.length === 0) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = results.map(item => `
        <div class="autocomplete-item" data-name="${item.name}" data-spec="${item.spec || ''}" data-unit="${item.unit || ''}">
          <span class="item-name">${item.name}</span>
          <span class="item-spec">${item.spec || ''} | ${item.unit || ''}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          nameInput.value = el.dataset.name;
          document.getElementById('new-inquiry-unit').value = el.dataset.unit;
          document.getElementById('new-inquiry-spec').value = el.dataset.spec;
          dropdown.style.display = 'none';
          // 自动识别分类
          if (!categoryManuallyChanged) {
            window.api.getLatestCategoryForName(el.dataset.name).then(category => {
              if (category && catSelect) catSelect.value = category;
            }).catch(() => {});
          }
        });
      });
    });

    nameInput.addEventListener('blur', () => {
      setTimeout(() => dropdown.style.display = 'none', 200);
      // 手动输入时也尝试识别分类
      if (categoryManuallyChanged) return;
      const val = nameInput.value.trim();
      if (!val) return;
      window.api.getLatestCategoryForName(val).then(category => {
        if (category && catSelect) catSelect.value = category;
      }).catch(() => {});
    });
  }
}

async function doAddInquiryItem(month) {
  const name = document.getElementById('new-inquiry-name').value.trim();
  if (!name) {
    showToast('请输入品名', 'error');
    return;
  }

  const data = {
    month: month,
    category: document.getElementById('new-inquiry-category').value,
    name: name,
    price: parseFloat(document.getElementById('new-inquiry-price').value) || null,
    unit: document.getElementById('new-inquiry-unit').value.trim(),
    spec: document.getElementById('new-inquiry-spec').value.trim(),
    remark: document.getElementById('new-inquiry-remark').value.trim()
  };

  try {
    await window.api.addInquiryItem(data);
    closeModal();
    showToast('已添加');
    await loadInquiryItems();
  } catch (err) {
    showToast('添加失败: ' + err.message, 'error');
  }
}

async function saveDiscount() {
  const sx = document.getElementById('discount-shengxiao').value;
  const yh = document.getElementById('discount-youhong').value;

  try {
    await window.api.setSetting('discount1_rate', sx);
    await window.api.setSetting('discount2_rate', yh);
    await loadAppSettings();
    showToast('折扣率已保存');

    // Refresh table if data exists
    if (inquiryData.length > 0) {
      renderInquiryTable(inquiryData);
    }
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}
