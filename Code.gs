/**
 * Swapnali's Rangoli - Google Sheets Order Database API
 *
 * UPDATED ORDER SYSTEM
 * - Sequential order numbers: R-1, R-2, R-3...
 * - Separate actual OrderDate field
 * - 10-12 day dispatch window is calculated by the HTML from OrderDate
 * - Full order editing including items
 *
 * SETUP
 * 1. Create/open the Google Sheet used by the site.
 * 2. Extensions -> Apps Script.
 * 3. Replace Code.gs with this file.
 * 4. Run setup() once and authorize.
 * 5. Project Settings -> Script properties:
 *      API_KEY = your API key
 *      ADMIN_PIN = your admin PIN
 * 6. Deploy -> New deployment -> Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 7. Put the /exec URL and API_KEY in the HTML.
 */

const ORDERS_SHEET = 'Orders';
const SETTINGS_SHEET = 'Settings';
const STOCK_SHEET = 'Stock';
const DEFAULT_BUSINESS = "Swapnali's Rangoli";
const DEFAULT_FOOTER = 'Thank you for your order! 🌸';
const DEFAULT_PIN = '2468';

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let orders = ss.getSheetByName(ORDERS_SHEET);
  let settings = ss.getSheetByName(SETTINGS_SHEET);
  let stock = ss.getSheetByName(STOCK_SHEET);

  if (!orders) orders = ss.insertSheet(ORDERS_SHEET);
  if (!settings) settings = ss.insertSheet(SETTINGS_SHEET);
  if (!stock) stock = ss.insertSheet(STOCK_SHEET);

  const orderHeaders = [
    'ID','OrderNo','CreatedAt','UpdatedAt','CustomerName','Phone',
    'Address','Shipping','Status','Payment','AdvancePercent','AdvanceAmount',
    'Discount','Notes','ItemsJSON','Subtotal','Total','OrderDate'
  ];

  migrateOrdersSheet_(orders, orderHeaders);

  if (stock.getLastRow() === 0) {
    stock.getRange(1,1,1,6).setValues([['Design','Size','Image','Stock','NeedToPrepare','UpdatedAt']]);
    stock.getRange(1,1,1,6).setFontWeight('bold');
    stock.setFrozenRows(1);
  }

  if (settings.getLastRow() === 0) {
    settings.getRange(1,1,1,2).setValues([['Key','Value']]);
    settings.getRange(2,1,3,2).setValues([
      ['businessName', DEFAULT_BUSINESS],
      ['footer', DEFAULT_FOOTER],
      ['adminPin', getProperty_('ADMIN_PIN') || DEFAULT_PIN]
    ]);
    settings.setFrozenRows(1);
    settings.getRange(1,1,1,2).setFontWeight('bold');
  }

  if (!getProperty_('API_KEY')) {
    PropertiesService.getScriptProperties().setProperty(
      'API_KEY', Utilities.getUuid().replace(/-/g,'')
    );
  }
  if (!getProperty_('ADMIN_PIN')) {
    PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', DEFAULT_PIN);
  }

  orders.autoResizeColumns(1, orderHeaders.length);
  settings.autoResizeColumns(1,2);
  stock.autoResizeColumns(1,6);

  return 'Setup complete. Copy API_KEY from Project Settings > Script properties.';
}

function migrateOrdersSheet_(sheet, orderHeaders) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (!lastRow || !lastColumn) {
    if (sheet.getMaxColumns() < orderHeaders.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), orderHeaders.length - sheet.getMaxColumns());
    }
    sheet.getRange(1,1,1,orderHeaders.length).setValues([orderHeaders]);
    sheet.getRange(1,1,1,orderHeaders.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  const oldHeaders = sheet.getRange(1,1,1,lastColumn).getValues()[0].map(v => String(v || '').trim());
  const oldData = lastRow >= 2 ? sheet.getRange(2,1,lastRow-1,lastColumn).getValues() : [];
  const headerIndex = {};

  oldHeaders.forEach((h,i) => {
    if (h && headerIndex[h] === undefined) headerIndex[h] = i;
  });

  let correct = oldHeaders.length === orderHeaders.length;
  if (correct) {
    for (let i=0;i<orderHeaders.length;i++) {
      if (oldHeaders[i] !== orderHeaders[i]) { correct = false; break; }
    }
  }

  if (correct) {
    sheet.getRange(1,1,1,orderHeaders.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  const migrated = oldData.map(oldRow => {
    const row = new Array(orderHeaders.length).fill('');
    orderHeaders.forEach((h,i) => {
      if (headerIndex[h] !== undefined) row[i] = oldRow[headerIndex[h]];
    });

    const orderDateIndex = orderHeaders.indexOf('OrderDate');
    const createdIndex = orderHeaders.indexOf('CreatedAt');
    const advancePercentIndex = orderHeaders.indexOf('AdvancePercent');
    const advanceAmountIndex = orderHeaders.indexOf('AdvanceAmount');
    const discountIndex = orderHeaders.indexOf('Discount');

    if (!row[orderDateIndex] && row[createdIndex]) row[orderDateIndex] = row[createdIndex];
    if (row[advancePercentIndex] === '') row[advancePercentIndex] = 0;
    if (row[advanceAmountIndex] === '') row[advanceAmountIndex] = 0;
    if (row[discountIndex] === '') row[discountIndex] = 0;
    return row;
  });

  if (sheet.getMaxColumns() < orderHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), orderHeaders.length - sheet.getMaxColumns());
  }

  sheet.clearContents();
  sheet.getRange(1,1,1,orderHeaders.length).setValues([orderHeaders]);
  if (migrated.length) sheet.getRange(2,1,migrated.length,orderHeaders.length).setValues(migrated);
  sheet.getRange(1,1,1,orderHeaders.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (migrated.length) sheet.getRange(2,18,migrated.length,1).setNumberFormat('yyyy-mm-dd');
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
      case 'listStocks':
        result = listStocks_();
        break;
      case 'updateStock':
        result = updateStock_(p.stock);
        break;
      case 'addStock':
        result = addStock_(p.items);
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
  if (!sheet || sheet.getLastColumn() < 18 || sheet.getRange(1,18).getValue() !== 'OrderDate') {
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
    const values = sheet.getRange(2,1,lastRow-1,18).getValues();
    values.forEach(row => {
      if (!row[0]) return;
      const created = toIso_(row[2]);
      let orderDate = normalizeOrderDate_(row[17]);
      if (!orderDate) orderDate = normalizeOrderDate_(row[2]);
      orders.push({
        id:String(row[0]), orderNo:String(row[1]||''), createdAt:created, updatedAt:toIso_(row[3]),
        customerName:String(row[4]||''), phone:String(row[5]||''), address:String(row[6]||''),
        shipping:Number(row[7]||0), status:String(row[8]||'New'), payment:String(row[9]||'Pending'),
        advancePercent:Number(row[10]||0), advanceAmount:Number(row[11]||0), discount:Number(row[12]||0),
        notes:String(row[13]||''), items:parseItems_(row[14]), subtotal:Number(row[15]||0), total:Number(row[16]||0),
        orderDate:orderDate
      });
    });
  }
  orders.sort((a,b)=>orderDateSortValue_(b.orderDate,b.createdAt)-orderDateSortValue_(a.orderDate,a.createdAt));
  return {ok:true,orders:orders,settings:getSettings_(),stocks:listStocks_().stocks};
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

function normalizeOrderDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  const d = new Date(value);
  if (isNaN(d)) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function orderDateSortValue_(orderDate, createdAt) {
  const d = orderDate ? new Date(orderDate + 'T12:00:00') : new Date(createdAt);
  return isNaN(d) ? 0 : d.getTime();
}

function nextOrderNumber_(sheet) {
  const lastRow = sheet.getLastRow();
  let max = 0;

  if (lastRow >= 2) {
    const nums = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    nums.forEach(row => {
      const m = String(row[0] || '').trim().match(/^R-(\d+)$/i);
      if (m) max = Math.max(max, Number(m[1]));
    });
  }

  return 'R-' + (max + 1);
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
    const id = String(order.id || ('o_'+now.getTime()+'_'+Utilities.getUuid().slice(0,6)));
    const orderNo = nextOrderNumber_(sheet);
    const createdAt = order.createdAt ? new Date(order.createdAt) : now;
    const orderDate = parseOrderDateForSheet_(order.orderDate,createdAt);
    const row = [id,orderNo,createdAt,now,String(order.customerName||''),String(order.phone||''),String(order.address||''),Number(order.shipping||0),String(order.status||'New'),String(order.payment||'Pending'),Number(order.advancePercent||0),Number(order.advanceAmount||0),Number(order.discount||0),String(order.notes||''),JSON.stringify(order.items||[]),Number(order.subtotal||0),Number(order.total||0),orderDate];
    if (row.length !== 18) throw new Error('Internal error: order row must contain exactly 18 columns.');
    const stockResult = String(order.status||'New') === 'Cancelled' ? {shortages:[]} : reserveStockForItems_(order.items||[]);
    sheet.getRange(sheet.getLastRow()+1,1,1,18).setValues([row]);
    sheet.getRange(sheet.getLastRow(),18).setNumberFormat('yyyy-mm-dd');
    const out=listOrders_();
    out.stockShortages=stockResult.shortages||[];
    return out;
  } finally { lock.releaseLock(); }
}

function updateOrder_(raw) {
  if (!raw) throw new Error('Order data is missing.');
  const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
  validateOrder_(order);
  const sheet = getSheet_();
  const id = String(order.id||'');
  if (!id) throw new Error('Order ID is missing.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('Order not found.');
    const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
    for (let i=0;i<ids.length;i++) {
      if (String(ids[i][0]) === id) {
        const rowNumber=i+2;
        const oldOrderNo=String(sheet.getRange(rowNumber,2).getValue()||'');
        const createdAt=sheet.getRange(rowNumber,3).getValue()||new Date();
        const oldStatus=String(sheet.getRange(rowNumber,9).getValue()||'New');
        const oldItems=parseItems_(sheet.getRange(rowNumber,15).getValue());
        const orderDate=parseOrderDateForSheet_(order.orderDate,createdAt);
        if(oldStatus !== 'Cancelled') releaseStockForItems_(oldItems);
        const stockResult = String(order.status||'New') === 'Cancelled' ? {shortages:[]} : reserveStockForItems_(order.items||[]);
        const row=[id,oldOrderNo||nextOrderNumber_(sheet),createdAt,new Date(),String(order.customerName||''),String(order.phone||''),String(order.address||''),Number(order.shipping||0),String(order.status||'New'),String(order.payment||'Pending'),Number(order.advancePercent||0),Number(order.advanceAmount||0),Number(order.discount||0),String(order.notes||''),JSON.stringify(order.items||[]),Number(order.subtotal||0),Number(order.total||0),orderDate];
        sheet.getRange(rowNumber,1,1,18).setValues([row]);
        sheet.getRange(rowNumber,18).setNumberFormat('yyyy-mm-dd');
        const out=listOrders_(); out.stockShortages=stockResult.shortages||[]; return out;
      }
    }
    throw new Error('Order not found.');
  } finally { lock.releaseLock(); }
}

function parseOrderDateForSheet_(value, fallback) {
  const s = String(value || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    // Noon prevents a date-only value from shifting because of timezone conversion.
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  return fallback instanceof Date && !isNaN(fallback) ? fallback : new Date();
}

function validateOrder_(order) {
  if (!order || typeof order !== 'object') throw new Error('Invalid order.');
  if (!Array.isArray(order.items) || order.items.length === 0) throw new Error('Order must contain at least one item.');

  const allowedStatuses=['New','Confirmed','Packed','Dispatched','Delivered','Cancelled'];
  const allowedPayments=['Pending','Advanced Received','Paid','Partially Paid','COD'];
  if (order.status && allowedStatuses.indexOf(String(order.status))===-1) throw new Error('Invalid order status.');
  if (order.payment && allowedPayments.indexOf(String(order.payment))===-1) throw new Error('Invalid payment status.');

  const orderTotal=Number(order.total||0);
  const discount=Number(order.discount||0);
  const advancePercent=Number(order.advancePercent||0);
  const advanceAmount=Number(order.advanceAmount||0);

  if (!Number.isFinite(orderTotal)||orderTotal<0) throw new Error('Invalid order total.');
  if (!Number.isFinite(discount)||discount<0) throw new Error('Invalid discount.');
  if (!Number.isFinite(advancePercent)||advancePercent<0||advancePercent>100) throw new Error('Invalid advance percentage.');
  if (!Number.isFinite(advanceAmount)||advanceAmount<0||advanceAmount>orderTotal+0.01) throw new Error('Advance amount cannot exceed order total.');

  if (String(order.payment||'')==='Advanced Received') {
    const expectedAmount=orderTotal*advancePercent/100;
    if (Math.abs(expectedAmount-advanceAmount)>0.02) throw new Error('Advance percentage and amount do not match.');
  }

  if (order.orderDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(order.orderDate))) throw new Error('Invalid order date.');

  order.items.forEach(item=>{
    if (!String(item.design||'').trim()) throw new Error('Every item needs a design.');
    if (!String(item.size||'').trim()) throw new Error('Every item needs a size.');
    if (!Number.isFinite(Number(item.price))||Number(item.price)<0) throw new Error('Invalid item price.');
    if (!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0) throw new Error('Invalid item quantity.');
  });
}

function updateStatus_(id, status) {
  if (!id) throw new Error('Order ID is missing.');
  const allowed = ['New','Confirmed','Dispatched','Delivered','Cancelled'];
  if (allowed.indexOf(status) === -1) throw new Error('Invalid status.');
  const sheet = getSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('Order not found.');
    const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
    for (let i=0;i<ids.length;i++) {
      if (String(ids[i][0]) === id) {
        const rowNumber=i+2;
        const oldStatus=String(sheet.getRange(rowNumber,9).getValue()||'New');
        const items=parseItems_(sheet.getRange(rowNumber,15).getValue());
        let stockResult={shortages:[]};
        if(oldStatus !== 'Cancelled' && status === 'Cancelled') releaseStockForItems_(items);
        if(oldStatus === 'Cancelled' && status !== 'Cancelled') stockResult=reserveStockForItems_(items);
        sheet.getRange(rowNumber,4).setValue(new Date());
        sheet.getRange(rowNumber,9).setValue(status);
        const out=listOrders_(); out.stockShortages=stockResult.shortages||[]; return out;
      }
    }
    throw new Error('Order not found.');
  } finally { lock.releaseLock(); }
}

function deleteOrder_(id) {
  if (!id) throw new Error('Order ID is missing.');
  const sheet = getSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('Order not found.');
    const ids = sheet.getRange(2,1,lastRow-1,1).getValues();
    for (let i=ids.length-1;i>=0;i--) {
      if (String(ids[i][0]) === id) {
        const rowNumber=i+2;
        const status=String(sheet.getRange(rowNumber,9).getValue()||'New');
        const items=parseItems_(sheet.getRange(rowNumber,15).getValue());
        if(status !== 'Cancelled') releaseStockForItems_(items);
        sheet.deleteRow(rowNumber);
        return listOrders_();
      }
    }
    throw new Error('Order not found.');
  } finally { lock.releaseLock(); }
}

function clearOrders_() {
  const sheet = getSheet_();
  const stockSheet = getStockSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const lastRow=sheet.getLastRow();
    if(lastRow>=2){
      const values=sheet.getRange(2,1,lastRow-1,18).getValues();
      values.forEach(row=>{ if(String(row[8]||'New')!=='Cancelled') releaseStockForItems_(parseItems_(row[14])); });
      sheet.deleteRows(2,lastRow-1);
    }
    return listOrders_();
  } finally { lock.releaseLock(); }
}

function saveSettings_(raw) {
  if (!raw) throw new Error('Settings are missing.');

  const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  if (!sheet) {
    setup();
    return saveSettings_(raw);
  }

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


function getStockSheet_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=ss.getSheetByName(STOCK_SHEET);
  if(!sheet){ setup(); sheet=ss.getSheetByName(STOCK_SHEET); }
  if(!sheet)throw new Error('Stock sheet could not be created.');
  if(sheet.getLastRow()===0){
    sheet.getRange(1,1,1,6).setValues([['Design','Size','Image','Stock','NeedToPrepare','UpdatedAt']]);
    sheet.getRange(1,1,1,6).setFontWeight('bold'); sheet.setFrozenRows(1);
  }else{
    const headers=sheet.getRange(1,1,1,Math.max(6,sheet.getLastColumn())).getValues()[0].map(String);
    if(headers[0]==='Design' && headers[1]==='Image' && headers[2]==='Stock'){
      sheet.insertColumnBefore(2);
      sheet.getRange(1,1,1,6).setValues([['Design','Size','Image','Stock','NeedToPrepare','UpdatedAt']]);
      sheet.getRange(1,1,1,6).setFontWeight('bold');
    }else if(headers[0]!=='Design' || headers[1]!=='Size'){
      sheet.getRange(1,1,1,6).setValues([['Design','Size','Image','Stock','NeedToPrepare','UpdatedAt']]);
      sheet.getRange(1,1,1,6).setFontWeight('bold');
    }
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function listStocks_(){
  const sheet=getStockSheet_(),lastRow=sheet.getLastRow(),stocks=[];
  if(lastRow>=2)sheet.getRange(2,1,lastRow-1,6).getValues().forEach(row=>{
    const design=String(row[0]||'').trim(); if(!design)return;
    stocks.push({design,size:String(row[1]||'').trim(),image:String(row[2]||''),stock:Math.max(0,Number(row[3]||0)),needToPrepare:Math.max(0,Number(row[4]||0)),updatedAt:toIso_(row[5])});
  });
  return {ok:true,stocks};
}
function findStockRow_(sheet,design,size){
  const lastRow=sheet.getLastRow();if(lastRow<2)return 0;
  const values=sheet.getRange(2,1,lastRow-1,2).getValues();
  const dk=String(design||'').trim().toLowerCase(),sk=String(size||'').trim().toLowerCase();
  for(let i=0;i<values.length;i++)if(String(values[i][0]||'').trim().toLowerCase()===dk&&String(values[i][1]||'').trim().toLowerCase()===sk)return i+2;
  return 0;
}
function ensureStockRow_(sheet,design,size,image){
  let row=findStockRow_(sheet,design,size);if(row)return row;
  row=sheet.getLastRow()+1;
  sheet.getRange(row,1,1,6).setValues([[String(design||''),String(size||''),String(image||''),0,0,new Date()]]);
  return row;
}
function updateStock_(raw){
  if(!raw)throw new Error('Stock data is missing.');
  const stock=typeof raw==='string'?JSON.parse(raw):raw;
  const design=String(stock.design||'').trim(),size=String(stock.size||'').trim();
  const value=Math.max(0,Math.floor(Number(stock.stock)||0));
  if(!design||!size)throw new Error('Design and Size are required.');
  const sheet=getStockSheet_(),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const row=ensureStockRow_(sheet,design,size,String(stock.image||''));
    const oldStock=Math.max(0,Number(sheet.getRange(row,4).getValue()||0)),oldNeed=Math.max(0,Number(sheet.getRange(row,5).getValue()||0));
    const added=Math.max(0,value-oldStock),newNeed=Math.max(0,oldNeed-added);
    sheet.getRange(row,4,1,3).setValues([[value,newNeed,new Date()]]);
    return listStocks_();
  }finally{lock.releaseLock();}
}
function addStock_(rawItems){
  const items=typeof rawItems==='string'?JSON.parse(rawItems):rawItems;
  if(!Array.isArray(items)||!items.length)throw new Error('Select at least one stock item.');
  const sheet=getStockSheet_(),lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const added=[];
    items.forEach(item=>{
      const design=String(item.design||'').trim(),size=String(item.size||'').trim(),qty=Math.max(0,Math.floor(Number(item.quantity)||0));
      if(!design||!size||qty<=0)return;
      const row=ensureStockRow_(sheet,design,size,String(item.image||''));
      const stock=Math.max(0,Number(sheet.getRange(row,4).getValue()||0)),need=Math.max(0,Number(sheet.getRange(row,5).getValue()||0));
      const consume=Math.min(need,qty),newNeed=need-consume,newStock=stock+(qty-consume);
      sheet.getRange(row,3,1,4).setValues([[String(item.image||sheet.getRange(row,3).getValue()||''),newStock,newNeed,new Date()]]);
      added.push({design,size,quantity:qty,clearedNeed:consume});
    });
    return {ok:true,added,stocks:listStocks_().stocks};
  }finally{lock.releaseLock();}
}

function aggregateItemsByVariant_(items){
  const map={};
  (items||[]).forEach(item=>{
    const design=String(item.design||'').trim(),size=String(item.size||'').trim(),qty=Math.max(0,Number(item.quantity)||0);
    if(!design||!size||qty<=0)return;
    const key=(design+'||'+size).toLowerCase();
    if(!map[key])map[key]={design,size,image:String(item.image||''),quantity:0};
    map[key].quantity+=qty;if(!map[key].image)map[key].image=String(item.image||'');
  });
  return Object.values(map);
}
function reserveStockForItems_(items){
  const sheet=getStockSheet_(),shortages=[];
  aggregateItemsByVariant_(items).forEach(item=>{
    const row=ensureStockRow_(sheet,item.design,item.size,item.image);
    const available=Math.max(0,Number(sheet.getRange(row,4).getValue()||0)),need=Math.max(0,Number(sheet.getRange(row,5).getValue()||0));
    const use=Math.min(available,item.quantity),shortage=item.quantity-use;
    sheet.getRange(row,3,1,4).setValues([[item.image||String(sheet.getRange(row,3).getValue()||''),available-use,need+shortage,new Date()]]);
    if(shortage>0)shortages.push({design:item.design,size:item.size,quantity:shortage});
  });
  return {shortages};
}
function releaseStockForItems_(items){
  const sheet=getStockSheet_();
  aggregateItemsByVariant_(items).forEach(item=>{
    const row=ensureStockRow_(sheet,item.design,item.size,item.image);
    const stock=Math.max(0,Number(sheet.getRange(row,4).getValue()||0)),need=Math.max(0,Number(sheet.getRange(row,5).getValue()||0));
    const removeFromNeed=Math.min(need,item.quantity),remaining=item.quantity-removeFromNeed;
    sheet.getRange(row,3,1,4).setValues([[item.image||String(sheet.getRange(row,3).getValue()||''),stock+remaining,need-removeFromNeed,new Date()]]);
  });
}
