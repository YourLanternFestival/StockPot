const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./db');

let mainWindow;

async function createWindow() {
  // Initialize DB before creating window
  await db.init();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '洋安出入库管理系统',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ===== IPC Handlers =====

// Products
ipcMain.handle('products:get', () => db.getProducts());
ipcMain.handle('products:getAll', () => db.getAllProducts());
ipcMain.handle('products:add', (e, data) => db.addProduct(data));
ipcMain.handle('products:update', (e, id, data) => db.updateProduct(id, data));
ipcMain.handle('products:delete', (e, id) => db.deleteProduct(id));
ipcMain.handle('products:batchDelete', (e, ids) => db.batchDeleteProducts(ids));

// Inbound
ipcMain.handle('inbound:get', (e, filters) => db.getInboundRecords(filters || {}));
ipcMain.handle('inbound:add', (e, data) => db.addInbound(data));
ipcMain.handle('inbound:update', (e, id, data) => db.updateInbound(id, data));
ipcMain.handle('inbound:delete', (e, id) => db.deleteInbound(id));

// Outbound
ipcMain.handle('outbound:get', (e, filters) => db.getOutboundRecords(filters || {}));
ipcMain.handle('outbound:add', (e, data) => db.addOutbound(data));
ipcMain.handle('outbound:update', (e, id, data) => db.updateOutbound(id, data));
ipcMain.handle('outbound:delete', (e, id) => db.deleteOutbound(id));

// Recipients
ipcMain.handle('recipients:get', () => db.getRecipients());
ipcMain.handle('recipients:add', (e, name) => db.addRecipient(name));

// Inventory
ipcMain.handle('inventory:get', () => db.getInventory());
ipcMain.handle('inventory:byMonth', (e, year, month) => db.getInventoryByMonth(year, month));

// Alerts
ipcMain.handle('alerts:get', (e, days) => db.getExpiryAlerts(days || 60));

// Dashboard
ipcMain.handle('dashboard:stats', () => db.getDashboardStats());

// Import
ipcMain.handle('import:products', (e, products) => db.importProducts(products));
ipcMain.handle('import:inbound', (e, records) => db.importInbound(records));
ipcMain.handle('import:outbound', (e, records) => db.importOutbound(records));
ipcMain.handle('import:openingStock', (e, map) => db.importOpeningStock(map));
ipcMain.handle('import:clearAll', () => db.clearAllData());

// Purchase Orders
ipcMain.handle('purchaseOrders:get', (e, source) => db.getPurchaseOrders(source));
ipcMain.handle('purchaseOrders:add', (e, data) => db.addPurchaseOrder(data));
ipcMain.handle('purchaseOrders:update', (e, id, data) => db.updatePurchaseOrder(id, data));
ipcMain.handle('purchaseOrders:delete', (e, id) => db.deletePurchaseOrder(id));
ipcMain.handle('purchaseOrders:clear', (e, source) => db.clearPurchaseOrders(source));

// Inquiry Items
ipcMain.handle('inquiry:get', (e, { month, category } = {}) => db.getInquiryItems(month, category));
ipcMain.handle('inquiry:search', (e, { keyword, month }) => db.searchInquiryItems(keyword, month));
ipcMain.handle('inquiry:add', (e, data) => db.addInquiryItem(data));
ipcMain.handle('inquiry:import', (e, { month, items }) => db.importInquiryItems(month, items));
ipcMain.handle('inquiry:months', () => db.getInquiryMonths());

// Settings
ipcMain.handle('settings:get', (e, key) => db.getSetting(key));
ipcMain.handle('settings:set', (e, key, value) => db.setSetting(key, value));
ipcMain.handle('settings:getAll', () => db.getAllSettings());

// File dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 xlsx 文件',
    filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (e, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存文件',
    defaultPath: defaultName,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
  });
  return result.canceled ? null : result.filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
