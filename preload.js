const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Products
  getProducts: () => ipcRenderer.invoke('products:get'),
  getAllProducts: () => ipcRenderer.invoke('products:getAll'),
  addProduct: (data) => ipcRenderer.invoke('products:add', data),
  updateProduct: (id, data) => ipcRenderer.invoke('products:update', id, data),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  batchDeleteProducts: (ids) => ipcRenderer.invoke('products:batchDelete', ids),

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

  // Inventory
  getInventory: () => ipcRenderer.invoke('inventory:get'),
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

  // Inquiry Items
  getInquiryItems: (month, category) => ipcRenderer.invoke('inquiry:get', { month, category }),
  searchInquiryItems: (keyword, month) => ipcRenderer.invoke('inquiry:search', { keyword, month }),
  addInquiryItem: (data) => ipcRenderer.invoke('inquiry:add', data),
  importInquiryItems: (month, items) => ipcRenderer.invoke('inquiry:import', { month, items }),
  getInquiryMonths: () => ipcRenderer.invoke('inquiry:months'),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  // Dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (name) => ipcRenderer.invoke('dialog:saveFile', name),
});
