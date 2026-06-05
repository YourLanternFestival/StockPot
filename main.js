const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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
  setupCloseHandler();
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
ipcMain.handle('inventory:detail', (e, productId, inboundLimit, outboundLimit) => db.getProductStockDetail(productId, inboundLimit, outboundLimit));
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
ipcMain.handle('inquiry:latestCategory', (e, name) => db.getLatestCategoryForName(name));
ipcMain.handle('inquiry:delete', (e, id) => db.deleteInquiryItem(id));

// Lianhua Items
ipcMain.handle('lianhua:items:get', () => db.getLianhuaItems());
ipcMain.handle('lianhua:items:add', (e, data) => db.addLianhuaItem(data));
ipcMain.handle('lianhua:items:update', (e, id, data) => db.updateLianhuaItem(id, data));
ipcMain.handle('lianhua:items:delete', (e, id) => db.deleteLianhuaItem(id));
ipcMain.handle('lianhua:items:import', (e, items) => db.importLianhuaItems(items));

// Lianhua Orders
ipcMain.handle('lianhua:orders:get', (e, orderDate) => db.getLianhuaOrders(orderDate));
ipcMain.handle('lianhua:orders:add', (e, data) => db.addLianhuaOrder(data));
ipcMain.handle('lianhua:orders:update', (e, id, data) => db.updateLianhuaOrder(id, data));
ipcMain.handle('lianhua:orders:delete', (e, id) => db.deleteLianhuaOrder(id));
ipcMain.handle('lianhua:orders:clear', (e, orderDate) => db.clearLianhuaOrders(orderDate));

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

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择照片文件夹',
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Image handlers
ipcMain.handle('image:find', async (e, { name, spec, photoFolder }) => {
  if (!photoFolder) return null;

  const safeName = name.replace(/[\/\\:*?"<>|]/g, '_');
  const safeSpec = (spec || '').replace(/[\/\\:*?"<>|]/g, '_');
  const baseName = `${safeName}_${safeSpec}`;

  const extensions = ['jpg', 'jpeg', 'png', 'bmp', 'webp'];
  for (const ext of extensions) {
    const filePath = path.join(photoFolder, `${baseName}.${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
});

ipcMain.handle('image:add', async (e, { name, spec, photoFolder }) => {
  if (!photoFolder) return { success: false, error: '未配置照片文件夹' };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] }
    ],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths[0]) {
    return { success: false, error: '已取消' };
  }

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase().replace('.', '');

  const safeName = name.replace(/[\/\\:*?"<>|]/g, '_');
  const safeSpec = (spec || '').replace(/[\/\\:*?"<>|]/g, '_');
  const baseName = `${safeName}_${safeSpec}`;
  const targetPath = path.join(photoFolder, `${baseName}.${ext}`);

  try {
    // Ensure photo folder exists
    if (!fs.existsSync(photoFolder)) {
      fs.mkdirSync(photoFolder, { recursive: true });
    }

    // Remove existing images for this item
    const extensions = ['jpg', 'jpeg', 'png', 'bmp', 'webp'];
    for (const oldExt of extensions) {
      const oldPath = path.join(photoFolder, `${baseName}.${oldExt}`);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Move (rename) the file; fall back to copy+delete if cross-device
    try {
      fs.renameSync(sourcePath, targetPath);
    } catch (renameErr) {
      if (renameErr.code === 'EXDEV') {
        fs.copyFileSync(sourcePath, targetPath);
        fs.unlinkSync(sourcePath);
      } else {
        throw renameErr;
      }
    }
    return { success: true, path: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Export purchase order with embedded images
ipcMain.handle('export:purchaseOrder', async (e, { sheets, defaultName }) => {
  const ExcelJS = require('exceljs');

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存采购单',
    defaultPath: defaultName || '采购单.xlsx',
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, error: '已取消' };

  try {
    const wb = new ExcelJS.Workbook();
    const imgWidth = 80, imgHeight = 60;

    for (const sheet of sheets) {
      const ws = wb.addWorksheet(sheet.name);
      const colCount = sheet.headers.length;

      // Row 1: Title (跨列居中, 宋体 15号)
      const titleRow = ws.addRow([sheet.title]);
      titleRow.font = { name: '宋体', bold: true, size: 15 };
      titleRow.height = 30;
      titleRow.getCell(1).alignment = { horizontal: 'centerContinuous', vertical: 'middle' };

      // Row 2: Headers (宋体 15号)
      const headerRow = ws.addRow(sheet.headers);
      headerRow.font = { name: '宋体', bold: true, size: 15 };
      headerRow.height = 50;
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      // Data rows
      for (const row of sheet.rows) {
        const dataRow = ws.addRow(row.data);
        const rowNum = dataRow.number;

        if (row.isHeader) {
          // Canteen name header in merged sheet
          dataRow.height = 30;
          if (row.mergeRanges) {
            // 支持多个合并范围，如 [{range: 'A:F', text: '寿昌'}, {range: 'H:M', text: '梅城'}]
            for (const mr of row.mergeRanges) {
              const match = mr.range.match(/^([A-Z]+):([A-Z]+)$/);
              if (match) {
                const colStart = match[1].charCodeAt(0) - 64;
                const colEnd = match[2].charCodeAt(0) - 64;
                ws.mergeCells(rowNum, colStart, rowNum, colEnd);
                const cell = dataRow.getCell(colStart);
                cell.value = mr.text;
                cell.font = { name: '宋体', bold: true, size: 15 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              }
            }
          } else if (row.mergeRange) {
            const match = row.mergeRange.match(/^([A-Z]+):([A-Z]+)$/);
            if (match) {
              const colStart = match[1].charCodeAt(0) - 64;
              const colEnd = match[2].charCodeAt(0) - 64;
              ws.mergeCells(rowNum, colStart, rowNum, colEnd);
              dataRow.getCell(colStart).font = { name: '宋体', bold: true, size: 15 };
              dataRow.getCell(colStart).alignment = { vertical: 'middle', horizontal: 'center' };
            }
          } else {
            dataRow.getCell(1).font = { name: '宋体', bold: true, size: 15 };
            ws.mergeCells(rowNum, 1, rowNum, colCount);
            dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
          }
          continue;
        }

        // Check if this is an empty separator row
        const isEmpty = row.data.every(v => v === '' || v === null || v === undefined);
        if (isEmpty) {
          dataRow.height = 10;
          continue;
        }

        dataRow.height = 50;
        dataRow.font = { name: '宋体', size: 15 };
        dataRow.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle' };
          cell.font = { name: '宋体', size: 15 };
        });
        // Right-align amount column (col 8)
        if (colCount >= 8) dataRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

        // Embed image in last column
        if (row.imagePath && fs.existsSync(row.imagePath)) {
          try {
            const ext = path.extname(row.imagePath).toLowerCase().replace('.', '');
            const imageId = wb.addImage({ filename: row.imagePath, extension: ext === 'jpg' ? 'jpeg' : ext });
            ws.addImage(imageId, {
              tl: { col: colCount - 1, row: rowNum - 1 },
              ext: { width: imgWidth, height: imgHeight },
            });
          } catch (imgErr) { console.error('Embed image error:', imgErr); }
        }
      }

      // Column widths: compact, just enough for text
      const colWidths = [6, 12, 18, 10, 8, 8, 6, 10, 16, 12]; // 序号~实物图
      for (let i = 1; i <= colCount; i++) {
        const maxLen = colWidths[i - 1] || 12;
        // Check actual data width
        let dataMax = maxLen;
        ws.getColumn(i).eachCell({ includeEmpty: false }, cell => {
          const len = String(cell.value || '').length;
          if (len > dataMax) dataMax = len;
        });
        ws.getColumn(i).width = Math.min(dataMax + 2, 24);
      }
      // Image column fixed width
      ws.getColumn(colCount).width = 14;
    }

    await wb.xlsx.writeFile(result.filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

function setupCloseHandler() {
  let forceQuit = false;

  mainWindow.on('close', async (e) => {
    if (forceQuit) return;
    e.preventDefault();
    try {
      const hasUnsaved = await mainWindow.webContents.executeJavaScript('hasUnsavedData()');
      if (hasUnsaved) {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['保存并退出', '直接退出', '取消'],
          defaultId: 0,
          cancelId: 2,
          title: '未保存的数据',
          message: '检测到有未保存的录入数据，是否保存后退出？',
        });
        if (response === 0) {
          await mainWindow.webContents.executeJavaScript('submitCurrentPage()');
          forceQuit = true;
          mainWindow.close();
        } else if (response === 1) {
          forceQuit = true;
          mainWindow.close();
        }
      } else {
        forceQuit = true;
        mainWindow.close();
      }
    } catch (err) {
      forceQuit = true;
      mainWindow.close();
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
