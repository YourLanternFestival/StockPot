// Excel serial number <-> JS Date conversion
// Excel epoch: 1899-12-30 (accounting for the 1900 leap year bug)

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const epochUtc = Date.UTC(1899, 11, 30); // UTC epoch
  const utcTime = epochUtc + serial * 86400000;
  const d = new Date(utcTime);
  return d.toISOString().split('T')[0]; // UTC 日期，与时区无关
}

function dateToExcelSerial(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z'); // 解析为 UTC
  const epochUtc = Date.UTC(1899, 11, 30);
  return Math.floor((d.getTime() - epochUtc) / 86400000);
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr; // Already YYYY-MM-DD
}

// 将 Date 对象格式化为本地日期 YYYY-MM-DD（避免 toISOString 的 UTC 时区偏移）
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { excelSerialToDate, dateToExcelSerial, formatDate, toLocalDateStr };
