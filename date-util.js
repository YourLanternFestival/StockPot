// Excel serial number <-> JS Date conversion
// Excel epoch: 1899-12-30 (accounting for the 1900 leap year bug)

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

function dateToExcelSerial(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const epoch = new Date(1899, 11, 30);
  return Math.floor((d - epoch) / 86400000);
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr; // Already YYYY-MM-DD
}

module.exports = { excelSerialToDate, dateToExcelSerial, formatDate };
