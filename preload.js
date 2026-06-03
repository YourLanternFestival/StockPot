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

  // Dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (name) => ipcRenderer.invoke('dialog:saveFile', name),
});
