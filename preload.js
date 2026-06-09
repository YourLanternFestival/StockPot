const { contextBridge, ipcRenderer } = require('electron');

// Window control API
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  resizeWindow: (direction) => ipcRenderer.invoke('window:resize', direction),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window-state-changed', (event, state) => callback(state));
  },
  // Bidirectional close-check: renderer registers handler, main triggers it
  registerCloseCheck: (checkHandler, saveHandler) => {
    ipcRenderer.on('close-check', async () => {
      try {
        ipcRenderer.send('close-check-result', await checkHandler());
      } catch (err) {
        ipcRenderer.send('close-check-result', { hasUnsaved: false });
      }
    });
    ipcRenderer.on('save-before-close', async () => {
      try {
        await saveHandler();
      } catch (err) { /* save failed, still signal done */ }
      ipcRenderer.send('save-before-close-done');
    });
  },
});

contextBridge.exposeInMainWorld('api', {
  // App Version
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Products
  getProducts: () => ipcRenderer.invoke('products:get'),
  getAllProducts: () => ipcRenderer.invoke('products:getAll'),
  addProduct: (data) => ipcRenderer.invoke('products:add', data),
  updateProduct: (id, data) => ipcRenderer.invoke('products:update', id, data),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  batchDeleteProducts: (ids) => ipcRenderer.invoke('products:batchDelete', ids),
  restoreProduct: (id) => ipcRenderer.invoke('products:restore', id),

  // Inbound
  getInbound: (filters) => ipcRenderer.invoke('inbound:get', filters),
  addInbound: (data) => ipcRenderer.invoke('inbound:add', data),
  updateInbound: (id, data) => ipcRenderer.invoke('inbound:update', id, data),
  deleteInbound: (id) => ipcRenderer.invoke('inbound:delete', id),

  // Outbound
  getOutbound: (filters) => ipcRenderer.invoke('outbound:get', filters),
  addOutbound: (data) => ipcRenderer.invoke('outbound:add', data),
  updateOutbound: (id, data) => ipcRenderer.invoke('outbound:update', id, data),
  deleteOutbound: (id) => ipcRenderer.invoke('outbound:delete', id),

  // Recipients
  getRecipients: () => ipcRenderer.invoke('recipients:get'),
  addRecipient: (name) => ipcRenderer.invoke('recipients:add', name),
  updateRecipient: (id, name) => ipcRenderer.invoke('recipients:update', id, name),
  deleteRecipient: (id) => ipcRenderer.invoke('recipients:delete', id),
  updateRecipientOrder: (order) => ipcRenderer.invoke('recipients:updateOrder', order),

  // Inventory
  getInventory: () => ipcRenderer.invoke('inventory:get'),
  getProductStockDetail: (productId, inboundLimit, outboundLimit) => ipcRenderer.invoke('inventory:detail', productId, inboundLimit, outboundLimit),
  getInventoryByMonth: (year, month) => ipcRenderer.invoke('inventory:byMonth', year, month),

  // Alerts
  getAlerts: (days) => ipcRenderer.invoke('alerts:get', days),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),

  // Import
  importProducts: (products) => ipcRenderer.invoke('import:products', products),
  importInbound: (records) => ipcRenderer.invoke('import:inbound', records),
  importOutbound: (records) => ipcRenderer.invoke('import:outbound', records),
  importOpeningStock: (map) => ipcRenderer.invoke('import:openingStock', map),
  clearAllData: () => ipcRenderer.invoke('import:clearAll'),

  // Purchase Orders
  getPurchaseOrders: (source) => ipcRenderer.invoke('purchaseOrders:get', source),
  addPurchaseOrder: (data) => ipcRenderer.invoke('purchaseOrders:add', data),
  updatePurchaseOrder: (id, data) => ipcRenderer.invoke('purchaseOrders:update', id, data),
  deletePurchaseOrder: (id) => ipcRenderer.invoke('purchaseOrders:delete', id),
  clearPurchaseOrders: (source) => ipcRenderer.invoke('purchaseOrders:clear', source),
  savePurchaseOrdersBatch: (sources, orders) => ipcRenderer.invoke('purchaseOrders:saveBatch', { sources, orders }),
  getPurchaseOrdersByDate: (date) => ipcRenderer.invoke('purchaseOrders:getByDate', date),
  getPurchaseHistoryDates: () => ipcRenderer.invoke('purchaseOrders:historyDates'),
  cleanOldPurchaseOrders: (days) => ipcRenderer.invoke('purchaseOrders:cleanOld', days),

  // Inquiry Items
  getInquiryItems: (month, category) => ipcRenderer.invoke('inquiry:get', { month, category }),
  searchInquiryItems: (keyword, month) => ipcRenderer.invoke('inquiry:search', { keyword, month }),
  addInquiryItem: (data) => ipcRenderer.invoke('inquiry:add', data),
  updateInquiryItem: (id, data) => ipcRenderer.invoke('inquiry:update', id, data),
  importInquiryItems: (month, items) => ipcRenderer.invoke('inquiry:import', { month, items }),
  getInquiryMonths: () => ipcRenderer.invoke('inquiry:months'),
  getLatestCategoryForName: (name) => ipcRenderer.invoke('inquiry:latestCategory', name),
  deleteInquiryItem: (id) => ipcRenderer.invoke('inquiry:delete', id),

  // Lianhua Items
  getLianhuaItems: () => ipcRenderer.invoke('lianhua:items:get'),
  addLianhuaItem: (data) => ipcRenderer.invoke('lianhua:items:add', data),
  updateLianhuaItem: (id, data) => ipcRenderer.invoke('lianhua:items:update', id, data),
  deleteLianhuaItem: (id) => ipcRenderer.invoke('lianhua:items:delete', id),
  importLianhuaItems: (items) => ipcRenderer.invoke('lianhua:items:import', items),

  // Lianhua Orders
  getLianhuaOrders: (orderDate) => ipcRenderer.invoke('lianhua:orders:get', orderDate),
  addLianhuaOrder: (data) => ipcRenderer.invoke('lianhua:orders:add', data),
  updateLianhuaOrder: (id, data) => ipcRenderer.invoke('lianhua:orders:update', id, data),
  deleteLianhuaOrder: (id) => ipcRenderer.invoke('lianhua:orders:delete', id),
  clearLianhuaOrders: (orderDate) => ipcRenderer.invoke('lianhua:orders:clear', orderDate),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  // Remark Memory
  getRemarksByName: (productName) => ipcRenderer.invoke('remark:getByName', productName),
  addRemarkMemory: (productName, remark) => ipcRenderer.invoke('remark:add', { productName, remark }),

  // Dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (name) => ipcRenderer.invoke('dialog:saveFile', name),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Image
  findImage: (name, spec, photoFolder) => ipcRenderer.invoke('image:find', { name, spec, photoFolder }),
  addImage: (name, spec, photoFolder) => ipcRenderer.invoke('image:add', { name, spec, photoFolder }),

  // Export with images
  exportPurchaseOrder: (sheets, defaultName) => ipcRenderer.invoke('export:purchaseOrder', { sheets, defaultName }),
});
