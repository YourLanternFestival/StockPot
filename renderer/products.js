// ===== Products =====
let selectedProductIds = new Set();

async function loadProducts(filter = '') {
  try {
    PRODUCTS = await window.api.getAllProducts();
    renderProductTable(filter);
  } catch (err) {
    console.error('Products load error:', err);
  }
}

function renderProductTable(filter = '') {
  const tbody = document.getElementById('products-body');
  const filtered = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  tbody.innerHTML = filtered.map((p, i) => `
    <tr>
      <td><input type="checkbox" class="prod-cb" data-id="${p.id}" ${selectedProductIds.has(p.id) ? 'checked' : ''} onchange="toggleProductSelect(${p.id}, this.checked)"></td>
      <td>${i + 1}</td><td>${p.name}</td><td>${p.spec}</td><td>${p.unit}</td>
      <td>${p.shelf_months}</td><td>${p.shelf_days}</td>
      <td>
        <button class="btn btn-sm" onclick="editProduct(${p.id})">编辑</button>
        <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="deleteProduct(${p.id})">删除</button>
      </td>
    </tr>
  `).join('');

  updateSelectAllCheckbox();
  updateProductActionButtons();
}

function toggleProductSelect(id, checked) {
  if (checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
  updateSelectAllCheckbox();
  updateProductActionButtons();
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.prod-cb').forEach(cb => {
    const id = parseInt(cb.dataset.id);
    cb.checked = checked;
    if (checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
  });
  updateProductActionButtons();
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById('select-all-products');
  if (!selectAll) return;
  const cbs = document.querySelectorAll('.prod-cb');
  const checked = document.querySelectorAll('.prod-cb:checked').length;
  selectAll.checked = cbs.length > 0 && checked === cbs.length;
  selectAll.indeterminate = checked > 0 && checked < cbs.length;
}

function updateProductActionButtons() {
  const btn = document.getElementById('btn-batch-delete');
  if (btn) {
    btn.style.display = selectedProductIds.size > 0 ? 'inline-flex' : 'none';
    btn.textContent = `🗑 删除选中 (${selectedProductIds.size})`;
  }
}

document.getElementById('prod-search').addEventListener('input', (e) => {
  renderProductTable(e.target.value);
});

function showAddProduct() {
  openModal('新增产品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料名称</label><input type="text" class="form-control" id="np-name" placeholder="请输入材料名称"></div>
      <div class="form-group"><label>规格</label><input type="text" class="form-control" id="np-spec" placeholder="如: 500克/瓶"></div>
      <div class="form-group"><label>单位</label><input type="text" class="form-control" id="np-unit" placeholder="如: 瓶、包、桶"></div>
      <div class="form-group"><label>保质期(月)</label><input type="number" class="form-control" id="np-months" min="0" value="0" onchange="document.getElementById('np-days').value=this.value*30"></div>
      <div class="form-group"><label>保质期(日)</label><input type="number" class="form-control" id="np-days" min="0" value="0" placeholder="填写月数自动换算"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doAddProduct()">保存</button>
  `);
}

async function doAddProduct() {
  const name = document.getElementById('np-name').value.trim();
  const unit = document.getElementById('np-unit').value.trim();
  if (!name || !unit) { showToast('名称和单位必填', 'error'); return; }
  await window.api.addProduct({
    name, spec: document.getElementById('np-spec').value.trim(), unit,
    shelf_months: parseInt(document.getElementById('np-months').value) || 0,
    shelf_days: parseInt(document.getElementById('np-days').value) || 0,
  });
  closeModal();
  showToast('产品已添加');
  loadProducts();
  refreshProductSelects();
}

function editProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  openModal('编辑产品', `
    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="form-group"><label>材料名称</label><input type="text" class="form-control" id="ep-name" value="${p.name}"></div>
      <div class="form-group"><label>规格</label><input type="text" class="form-control" id="ep-spec" value="${p.spec}"></div>
      <div class="form-group"><label>单位</label><input type="text" class="form-control" id="ep-unit" value="${p.unit}"></div>
      <div class="form-group"><label>保质期(月)</label><input type="number" class="form-control" id="ep-months" value="${p.shelf_months}" onchange="document.getElementById('ep-days').value=this.value*30"></div>
      <div class="form-group"><label>保质期(日)</label><input type="number" class="form-control" id="ep-days" value="${p.shelf_days}" placeholder="填写月数自动换算"></div>
    </div>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="doEditProduct(${id})">保存</button>
  `);
}

async function doEditProduct(id) {
  const name = document.getElementById('ep-name').value.trim();
  const unit = document.getElementById('ep-unit').value.trim();
  if (!name || !unit) { showToast('名称和单位必填', 'error'); return; }
  try {
    await window.api.updateProduct(id, {
      name, spec: document.getElementById('ep-spec').value.trim(), unit,
      shelf_months: parseInt(document.getElementById('ep-months').value) || 0,
      shelf_days: parseInt(document.getElementById('ep-days').value) || 0,
    });
    closeModal();
    showToast('已保存');
    loadProducts();
    refreshProductSelects();
  } catch (err) {
    console.error('Edit product error:', err);
    showToast('保存失败: ' + (err.message || err), 'error');
  }
}

function deleteProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  openModal('确认删除', `
    <p>确定要删除 <strong>${p.name}</strong> 吗？</p>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">历史入出库记录仍会保留。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doDeleteProduct(${id})">确认删除</button>
  `);
}

async function doDeleteProduct(id) {
  await window.api.deleteProduct(id);
  selectedProductIds.delete(id);
  closeModal();
  showToast('产品已删除');
  loadProducts();
  refreshProductSelects();
}

function batchDeleteProducts() {
  if (selectedProductIds.size === 0) return;
  openModal('批量删除', `
    <p>确定要删除选中的 <strong>${selectedProductIds.size}</strong> 个产品吗？</p>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">历史入出库记录仍会保留。</p>
  `, `
    <button class="btn" onclick="closeModal()">取消</button>
    <button class="btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" onclick="doBatchDelete()">确认删除</button>
  `);
}

async function doBatchDelete() {
  const ids = Array.from(selectedProductIds);
  await window.api.batchDeleteProducts(ids);
  const count = ids.length;
  selectedProductIds.clear();
  closeModal();
  showToast(`已删除 ${count} 个产品`);
  loadProducts();
  refreshProductSelects();
}

// ===== Product Select Helper =====
async function refreshProductSelects() {
  try {
    PRODUCTS = await window.api.getProducts();
    populateProductSelect('in-product');
    populateProductSelect('out-product');
  } catch (err) {
    console.error('Refresh selects error:', err);
  }
}

function populateProductSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">请选择材料...</option>' +
    PRODUCTS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}
