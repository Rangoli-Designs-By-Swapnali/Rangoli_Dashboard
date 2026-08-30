/**
 * Swapnali's Rangoli - Google Sheets Order Database API
 *
 * SETUP
 * 1. Create a Google Sheet for your orders.
 * 2. Extensions -> Apps Script.
 * 3. Replace the default Code.gs with this file.
 * 4. Run setup() once and authorize it.
 * 5. Project Settings -> Script properties:
 *      API_KEY = a long random string
 *      ADMIN_PIN = your admin PIN, e.g. 2468
 * 6. Deploy -> New deployment -> Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 7. Copy the /exec URL into ADMIN_API_URL in the HTML.
 * 8. Put the same API_KEY into ADMIN_API_KEY in the HTML.
 */

const ORDERS_SHEET = 'Orders';
const SETTINGS_SHEET = 'Settings';
const DEFAULT_BUSINESS = "Swapnali's Rangoli";
const DEFAULT_FOOTER = 'Thank you for your order! 🌸';
const DEFAULT_PIN = '2468';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let orders = ss.getSheetByName(ORDERS_SHEET);
  let settings = ss.getSheetByName(SETTINGS_SHEET);

  if (!orders) orders = ss.insertSheet(ORDERS_SHEET);
  if (!settings) settings = ss.insertSheet(SETTINGS_SHEET);

  const orderHeaders = [
    'ID', 'OrderNo', 'CreatedAt', 'UpdatedAt', 'CustomerName', 'Phone',
    'Address', 'Shipping', 'Status', 'Payment', 'Notes', 'ItemsJSON',
    'Subtotal', 'Total'
  ];

  if (orders.getLastRow() === 0) {
    orders.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);
    orders.setFrozenRows(1);
    orders.getRange(1, 1, 1, orderHeaders.length).setFontWeight('bold');
  }

  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
    settings.getRange(2, 1, 3, 2).setValues([
      ['businessName', DEFAULT_BUSINESS],
      ['footer', DEFAULT_FOOTER],
      ['adminPin', getProperty_('ADMIN_PIN') || DEFAULT_PIN]
    ]);
    settings.setFrozenRows(1);
    settings.getRange(1, 1, 1, 2).setFontWeight('bold');
  }

  orders.autoResizeColumns(1, orderHeaders.length);
  settings.autoResizeColumns(1, 2);

  // If properties are empty, create usable defaults.
  if (!getProperty_('API_KEY')) {
    PropertiesService.getScriptProperties().setProperty(
      'API_KEY', Utilities.getUuid().replace(/-/g, '')
    );
  }
  if (!getProperty_('ADMIN_PIN')) {
    PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', DEFAULT_PIN);
  }

  return 'Setup complete. Copy the generated API_KEY from Project Settings > Script properties.';
}

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  const params = e && e.parameter ? Object.assign({}, e.parameter) : {};
  return handleRequest_(params);
}

function handleRequest_(p) {
  const callback = sanitizeCallback_(p.callback);
  let result;

  try {
    if (!isAuthorized_(p.key)) {
      result = { ok: false, error: 'Unauthorized request.' };
      return output_(result, callback);
    }

    const action = String(p.action || '').trim();

    switch (action) {
      case 'verifyPin':
        result = verifyPin_(String(p.pin || ''));
        break;
      case 'listOrders':
        result = listOrders_();
        break;
      case 'saveOrder':
        result = saveOrder_(p.order);
        break;
      case 'updateOrder':
        result = updateOrder_(p.order);
        break;
      case 'updateStatus':
        result = updateStatus_(String(p.id || ''), String(p.status || ''));
        break;
      case 'deleteOrder':
        result = deleteOrder_(String(p.id || ''));
        break;
      case 'clearOrders':
        result = clearOrders_();
        break;
      case 'saveSettings':
        result = saveSettings_(p.settings);
        break;
      default:
        result = { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : String(err) };
  }

  return output_(result, callback);
}

function output_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback_(name) {
  name = String(name || '');
  return /^[A-Za-z_$][A-Za-z0-9_$\.]*$/.test(name) ? name : '';
}

function getProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function isAuthorized_(key) {
  const expected = getProperty_('API_KEY');
  return !!expected && !!key && constantTimeEquals_(String(key), String(expected));
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function verifyPin_(pin) {
  const expected = getProperty_('ADMIN_PIN') || DEFAULT_PIN;
  return { ok: true, valid: constantTimeEquals_(pin, expected) };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ORDERS_SHEET);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(ORDERS_SHEET);
  }
  return sheet;
}

function getSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  const out = { businessName: DEFAULT_BUSINESS, footer: DEFAULT_FOOTER };
  if (!sheet || sheet.getLastRow() < 2) return out;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  values.forEach(row => {
    const key = String(row[0] || '').trim();
    if (key === 'businessName') out.businessName = String(row[1] || DEFAULT_BUSINESS);
    if (key === 'footer') out.footer = String(row[1] || DEFAULT_FOOTER);
  });
  return out;
}

function listOrders_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const orders = [];

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
    values.forEach(row => {
      if (!row[0]) return;
      orders.push({
        id: String(row[0]),
        orderNo: String(row[1] || ''),
        createdAt: toIso_(row[2]),
        updatedAt: toIso_(row[3]),
        customerName: String(row[4] || ''),
        phone: String(row[5] || ''),
        address: String(row[6] || ''),
        shipping: Number(row[7] || 0),
        status: String(row[8] || 'New'),
        payment: String(row[9] || 'Pending'),
        notes: String(row[10] || ''),
        items: parseItems_(row[11]),
        subtotal: Number(row[12] || 0),
        total: Number(row[13] || 0)
      });
    });
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { ok: true, orders: orders, settings: getSettings_() };
}

function parseItems_(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function toIso_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return value.toISOString();
  }
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toISOString();
}

function saveOrder_(raw) {
  if (!raw) throw new Error('Order data is missing.');

  const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
  validateOrder_(order);

  const sheet = getSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const now = new Date();
    const id = String(order.id || ('o_' + now.getTime() + '_' + Utilities.getUuid().slice(0, 6)));
    const orderNo = String(order.orderNo || makeOrderNo_());
    const createdAt = order.createdAt ? new Date(order.createdAt) : now;
    const updatedAt = now;

    const row = [
      id,
      orderNo,
      createdAt,
      updatedAt,
      String(order.customerName || ''),
      String(order.phone || ''),
      String(order.address || ''),
      Number(order.shipping || 0),
      String(order.status || 'New'),
      String(order.payment || 'Pending'),
      String(order.notes || ''),
      JSON.stringify(order.items || []),
      Number(order.subtotal || 0),
      Number(order.total || 0)
    ];

    sheet.appendRow(row);
    return listOrders_();
  } finally {
    lock.releaseLock();
  }
}

function updateOrder_(raw) {
  if (!raw) throw new Error('Order data is missing.');
  const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
  validateOrder_(order);

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Order not found.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(order.id)) {
      const rowNumber = i + 2;
      const existingCreatedAt = sheet.getRange(rowNumber, 3).getValue();
      const createdAt = existingCreatedAt || (order.createdAt ? new Date(order.createdAt) : new Date());
      const updatedAt = new Date();
      const row = [
        String(order.id),
        String(order.orderNo || ''),
        createdAt,
        updatedAt,
        String(order.customerName || ''),
        String(order.phone || ''),
        String(order.address || ''),
        Number(order.shipping || 0),
        String(order.status || 'New'),
        String(order.payment || 'Pending'),
        String(order.notes || ''),
        JSON.stringify(order.items || []),
        Number(order.subtotal || 0),
        Number(order.total || 0)
      ];
      sheet.getRange(rowNumber, 1, 1, 14).setValues([row]);
      return listOrders_();
    }
  }
  throw new Error('Order not found.');
}

function validateOrder_(order) {
  if (!order || typeof order !== 'object') throw new Error('Invalid order.');
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error('Order must contain at least one item.');

  const allowedStatuses = ['New','Confirmed','Packed','Dispatched','Delivered','Cancelled'];
  const allowedPayments = ['Pending','Paid','Partially Paid','COD'];
  if (order.status && allowedStatuses.indexOf(String(order.status)) === -1) throw new Error('Invalid order status.');
  if (order.payment && allowedPayments.indexOf(String(order.payment)) === -1) throw new Error('Invalid payment status.');

  order.items.forEach(item => {
    if (!String(item.design || '').trim()) throw new Error('Every item needs a design.');
    if (!String(item.size || '').trim()) throw new Error('Every item needs a size.');
    if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) throw new Error('Invalid item price.');
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) throw new Error('Invalid item quantity.');
  });
}

function updateStatus_(id, status) {
  if (!id) throw new Error('Order ID is missing.');
  const allowed = ['New','Confirmed','Packed','Dispatched','Delivered','Cancelled'];
  if (allowed.indexOf(status) === -1) throw new Error('Invalid status.');

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Order not found.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      const rowNumber = i + 2;
      sheet.getRange(rowNumber, 4).setValue(new Date());
      sheet.getRange(rowNumber, 9).setValue(status);
      return listOrders_();
    }
  }
  throw new Error('Order not found.');
}

function deleteOrder_(id) {
  if (!id) throw new Error('Order ID is missing.');
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Order not found.');

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === id) {
      sheet.deleteRow(i + 2);
      return listOrders_();
    }
  }
  throw new Error('Order not found.');
}

function clearOrders_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) sheet.deleteRows(2, lastRow - 1);
  return listOrders_();
}

function saveSettings_(raw) {
  if (!raw) throw new Error('Settings are missing.');
  const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  if (!sheet) { setup(); return saveSettings_(raw); }

  setSettingRow_(sheet, 'businessName', String(settings.businessName || DEFAULT_BUSINESS));
  setSettingRow_(sheet, 'footer', String(settings.footer || DEFAULT_FOOTER));

  if (settings.pin) {
    const pin = String(settings.pin).trim();
    if (pin.length < 4) throw new Error('Admin PIN must be at least 4 characters.');
    PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', pin);
    setSettingRow_(sheet, 'adminPin', pin);
  }

  return { ok: true, settings: getSettings_() };
}

function setSettingRow_(sheet, key, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        sheet.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sheet.appendRow([key, value]);
}

function makeOrderNo_() {
  const d = new Date();
  return 'RB-' + Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
}
