/**
 * Swapnali's Rangoli - Google Sheets Order Database API
 *
 * UPDATED ORDER SYSTEM
 * - Sequential order numbers: R-1, R-2, R-3...
 * - Separate actual OrderDate field
 * - 10-12 day dispatch window is calculated by the HTML from OrderDate
 * - Full order editing including items
 * - Advance payment percentage and amount
 * - Discount
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

const DEFAULT_BUSINESS = "Swapnali's Rangoli";
const DEFAULT_FOOTER = 'Thank you for your order! 🌸';
const DEFAULT_PIN = '2468';

/**
 * Canonical Orders sheet structure.
 *
 * IMPORTANT:
 * All functions in this file use this exact 18-column structure.
 */
const ORDER_HEADERS = [
  'ID',
  'OrderNo',
  'CreatedAt',
  'UpdatedAt',
  'CustomerName',
  'Phone',
  'Address',
  'Shipping',
  'Status',
  'Payment',
  'AdvancePercent',
  'AdvanceAmount',
  'Discount',
  'Notes',
  'ItemsJSON',
  'Subtotal',
  'Total',
  'OrderDate'
];


/**
 * ============================================================
 * SETUP / MIGRATION
 * ============================================================
 */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let orders = ss.getSheetByName(ORDERS_SHEET);
  let settings = ss.getSheetByName(SETTINGS_SHEET);

  if (!orders) {
    orders = ss.insertSheet(ORDERS_SHEET);
  }

  if (!settings) {
    settings = ss.insertSheet(SETTINGS_SHEET);
  }

  /*
   * Make sure the Orders sheet always has the correct
   * 18-column structure.
   *
   * This safely migrates older versions of the sheet by
   * matching existing columns by header name rather than
   * assuming their old positions.
   */
  migrateOrdersSheet_(orders);

  /*
   * Create Settings sheet if it is empty.
   */
  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, 1, 2).setValues([
      ['Key', 'Value']
    ]);

    settings.getRange(2, 1, 3, 2).setValues([
      ['businessName', DEFAULT_BUSINESS],
      ['footer', DEFAULT_FOOTER],
      ['adminPin', getProperty_('ADMIN_PIN') || DEFAULT_PIN]
    ]);

    settings.setFrozenRows(1);
    settings.getRange(1, 1, 1, 2).setFontWeight('bold');
  } else {
    /*
     * Make sure the essential settings exist.
     */
    if (!getSettingValue_(settings, 'businessName')) {
      setSettingRow_(settings, 'businessName', DEFAULT_BUSINESS);
    }

    if (!getSettingValue_(settings, 'footer')) {
      setSettingRow_(settings, 'footer', DEFAULT_FOOTER);
    }

    if (!getSettingValue_(settings, 'adminPin')) {
      setSettingRow_(
        settings,
        'adminPin',
        getProperty_('ADMIN_PIN') || DEFAULT_PIN
      );
    }
  }

  /*
   * Create API key if missing.
   */
  if (!getProperty_('API_KEY')) {
    PropertiesService.getScriptProperties().setProperty(
      'API_KEY',
      Utilities.getUuid().replace(/-/g, '')
    );
  }

  /*
   * Create admin PIN if missing.
   */
  if (!getProperty_('ADMIN_PIN')) {
    PropertiesService.getScriptProperties().setProperty(
      'ADMIN_PIN',
      DEFAULT_PIN
    );
  }

  /*
   * Keep Settings sheet synchronized with Script Properties.
   */
  setSettingRow_(
    settings,
    'adminPin',
    getProperty_('ADMIN_PIN') || DEFAULT_PIN
  );

  orders.autoResizeColumns(1, ORDER_HEADERS.length);
  settings.autoResizeColumns(1, 2);

  orders.setFrozenRows(1);

  return 'Setup complete. Copy API_KEY from Project Settings > Script properties.';
}


/**
 * Migrates any existing Orders sheet to the canonical
 * 18-column structure.
 *
 * Existing data is matched by column header name.
 */
function migrateOrdersSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  /*
   * Completely empty sheet.
   */
  if (lastRow === 0 || lastColumn === 0) {
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length)
      .setValues([ORDER_HEADERS]);

    sheet.getRange(1, 1, 1, ORDER_HEADERS.length)
      .setFontWeight('bold');

    sheet.setFrozenRows(1);
    return;
  }

  /*
   * Read existing headers.
   */
  const existingHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function(value) {
      return String(value || '').trim();
    });

  /*
   * Check if the sheet already has exactly the correct
   * header structure.
   */
  let alreadyCorrect = existingHeaders.length === ORDER_HEADERS.length;

  if (alreadyCorrect) {
    for (let i = 0; i < ORDER_HEADERS.length; i++) {
      if (existingHeaders[i] !== ORDER_HEADERS[i]) {
        alreadyCorrect = false;
        break;
      }
    }
  }

  if (alreadyCorrect) {
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length)
      .setFontWeight('bold');

    sheet.setFrozenRows(1);
    return;
  }

  /*
   * Read existing data before changing the sheet.
   */
  let oldData = [];

  if (lastRow >= 2) {
    oldData = sheet
      .getRange(2, 1, lastRow - 1, lastColumn)
      .getValues();
  }

  /*
   * Build a map of existing header -> old column index.
   *
   * If duplicate headers exist, the first one is used.
   */
  const headerMap = {};

  existingHeaders.forEach(function(header, index) {
    if (header && headerMap[header] === undefined) {
      headerMap[header] = index;
    }
  });

  /*
   * Create new data according to the canonical structure.
   */
  const newData = oldData.map(function(oldRow) {
    const newRow = new Array(ORDER_HEADERS.length).fill('');

    ORDER_HEADERS.forEach(function(header, newIndex) {
      if (headerMap[header] !== undefined) {
        newRow[newIndex] = oldRow[headerMap[header]];
      }
    });

    /*
     * Older versions may not have OrderDate.
     *
     * In that case use CreatedAt as the OrderDate.
     */
    const orderDateIndex = ORDER_HEADERS.indexOf('OrderDate');
    const createdAtIndex = ORDER_HEADERS.indexOf('CreatedAt');

    if (
      !newRow[orderDateIndex] &&
      newRow[createdAtIndex]
    ) {
      newRow[orderDateIndex] = newRow[createdAtIndex];
    }

    /*
     * Older versions may have had Discount but no
     * AdvancePercent / AdvanceAmount.
     *
     * Those remain blank/zero.
     */
    if (newRow[ORDER_HEADERS.indexOf('AdvancePercent')] === '') {
      newRow[ORDER_HEADERS.indexOf('AdvancePercent')] = 0;
    }

    if (newRow[ORDER_HEADERS.indexOf('AdvanceAmount')] === '') {
      newRow[ORDER_HEADERS.indexOf('AdvanceAmount')] = 0;
    }

    if (newRow[ORDER_HEADERS.indexOf('Discount')] === '') {
      newRow[ORDER_HEADERS.indexOf('Discount')] = 0;
    }

    return newRow;
  });

  /*
   * Clear existing sheet content.
   *
   * This does NOT delete the sheet itself.
   */
  sheet.clearContents();

  /*
   * Make sure the sheet has enough columns.
   */
  const maxColumns = sheet.getMaxColumns();

  if (maxColumns < ORDER_HEADERS.length) {
    sheet.insertColumnsAfter(
      maxColumns,
      ORDER_HEADERS.length - maxColumns
    );
  }

  /*
   * Write canonical headers.
   */
  sheet
    .getRange(1, 1, 1, ORDER_HEADERS.length)
    .setValues([ORDER_HEADERS]);

  /*
   * Write migrated data.
   */
  if (newData.length > 0) {
    sheet
      .getRange(2, 1, newData.length, ORDER_HEADERS.length)
      .setValues(newData);
  }

  /*
   * Formatting.
   */
  sheet
    .getRange(1, 1, 1, ORDER_HEADERS.length)
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  /*
   * Date formatting.
   */
  if (newData.length > 0) {
    sheet
      .getRange(2, ORDER_HEADERS.indexOf('OrderDate') + 1, newData.length, 1)
      .setNumberFormat('yyyy-mm-dd');
  }
}


/**
 * ============================================================
 * WEB APP
 * ============================================================
 */

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}


function doPost(e) {
  const params = e && e.parameter
    ? Object.assign({}, e.parameter)
    : {};

  return handleRequest_(params);
}


function handleRequest_(p) {
  const callback = sanitizeCallback_(p.callback);
  let result;

  try {
    if (!isAuthorized_(p.key)) {
      result = {
        ok: false,
        error: 'Unauthorized request.'
      };

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
        result = updateStatus_(
          String(p.id || ''),
          String(p.status || '')
        );
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
        result = {
          ok: false,
          error: 'Unknown action.'
        };
    }

  } catch (err) {
    result = {
      ok: false,
      error: err && err.message
        ? err.message
        : String(err)
    };
  }

  return output_(result, callback);
}


function output_(obj, callback) {
  const json = JSON.stringify(obj);

  if (callback) {
    return ContentService
      .createTextOutput(
        callback + '(' + json + ');'
      )
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


function sanitizeCallback_(name) {
  name = String(name || '');

  return /^[A-Za-z_$][A-Za-z0-9_$\.]*$/.test(name)
    ? name
    : '';
}


/**
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 */

function getProperty_(key) {
  return PropertiesService
    .getScriptProperties()
    .getProperty(key) || '';
}


function isAuthorized_(key) {
  const expected = getProperty_('API_KEY');

  return !!expected &&
    !!key &&
    constantTimeEquals_(
      String(key),
      String(expected)
    );
}


function constantTimeEquals_(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}


function verifyPin_(pin) {
  const expected =
    getProperty_('ADMIN_PIN') || DEFAULT_PIN;

  return {
    ok: true,
    valid: constantTimeEquals_(pin, expected)
  };
}


/**
 * ============================================================
 * SHEET HELPERS
 * ============================================================
 */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(ORDERS_SHEET);

  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(ORDERS_SHEET);
  }

  /*
   * Make sure an old sheet is migrated.
   */
  if (!isCanonicalOrdersSheet_(sheet)) {
    migrateOrdersSheet_(sheet);
  }

  return sheet;
}


function isCanonicalOrdersSheet_(sheet) {
  if (!sheet) {
    return false;
  }

  if (sheet.getLastColumn() < ORDER_HEADERS.length) {
    return false;
  }

  const headers = sheet
    .getRange(1, 1, 1, ORDER_HEADERS.length)
    .getValues()[0]
    .map(function(value) {
      return String(value || '').trim();
    });

  for (let i = 0; i < ORDER_HEADERS.length; i++) {
    if (headers[i] !== ORDER_HEADERS[i]) {
      return false;
    }
  }

  return true;
}


/**
 * ============================================================
 * SETTINGS
 * ============================================================
 */

function getSettings_() {
  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SETTINGS_SHEET);

  const out = {
    businessName: DEFAULT_BUSINESS,
    footer: DEFAULT_FOOTER
  };

  if (!sheet || sheet.getLastRow() < 2) {
    return out;
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 2)
    .getValues();

  values.forEach(function(row) {
    const key = String(row[0] || '').trim();

    if (key === 'businessName') {
      out.businessName =
        String(row[1] || DEFAULT_BUSINESS);
    }

    if (key === 'footer') {
      out.footer =
        String(row[1] || DEFAULT_FOOTER);
    }
  });

  return out;
}


function getSettingValue_(sheet, key) {
  if (!sheet || sheet.getLastRow() < 2) {
    return '';
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 2)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === key) {
      return values[i][1];
    }
  }

  return '';
}


function saveSettings_(raw) {
  if (!raw) {
    throw new Error('Settings are missing.');
  }

  const settings =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : raw;

  let sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SETTINGS_SHEET);

  if (!sheet) {
    setup();

    sheet =
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getSheetByName(SETTINGS_SHEET);
  }

  setSettingRow_(
    sheet,
    'businessName',
    String(
      settings.businessName || DEFAULT_BUSINESS
    )
  );

  setSettingRow_(
    sheet,
    'footer',
    String(
      settings.footer || DEFAULT_FOOTER
    )
  );

  if (settings.pin) {
    const pin = String(settings.pin).trim();

    if (pin.length < 4) {
      throw new Error(
        'Admin PIN must be at least 4 characters.'
      );
    }

    PropertiesService
      .getScriptProperties()
      .setProperty('ADMIN_PIN', pin);

    setSettingRow_(
      sheet,
      'adminPin',
      pin
    );
  }

  return {
    ok: true,
    settings: getSettings_()
  };
}


function setSettingRow_(sheet, key, value) {
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const keys = sheet
      .getRange(2, 1, lastRow - 1, 1)
      .getValues();

    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        sheet
          .getRange(i + 2, 2)
          .setValue(value);

        return;
      }
    }
  }

  sheet.appendRow([key, value]);
}


/**
 * ============================================================
 * ORDER LIST
 * ============================================================
 */

function listOrders_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const orders = [];

  if (lastRow >= 2) {

    /*
     * IMPORTANT:
     * Read all 18 columns.
     */
    const values = sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        ORDER_HEADERS.length
      )
      .getValues();

    values.forEach(function(row) {

      if (!row[0]) {
        return;
      }

      const created = toIso_(row[2]);

      /*
       * Column indexes in the canonical structure:
       *
       * 0  ID
       * 1  OrderNo
       * 2  CreatedAt
       * 3  UpdatedAt
       * 4  CustomerName
       * 5  Phone
       * 6  Address
       * 7  Shipping
       * 8  Status
       * 9  Payment
       * 10 AdvancePercent
       * 11 AdvanceAmount
       * 12 Discount
       * 13 Notes
       * 14 ItemsJSON
       * 15 Subtotal
       * 16 Total
       * 17 OrderDate
       */

      let orderDate =
        normalizeOrderDate_(row[17]);

      /*
       * Fallback for older records.
       */
      if (!orderDate) {
        orderDate =
          normalizeOrderDate_(row[2]);
      }

      orders.push({
        id: String(row[0]),
        orderNo: String(row[1] || ''),
        createdAt: created,
        updatedAt: toIso_(row[3]),

        customerName:
          String(row[4] || ''),

        phone:
          String(row[5] || ''),

        address:
          String(row[6] || ''),

        shipping:
          Number(row[7] || 0),

        status:
          (String(row[8] || 'New') === 'Packed' ? 'Confirmed' : String(row[8] || 'New')),

        payment:
          String(row[9] || 'Pending'),

        advancePercent:
          Number(row[10] || 0),

        advanceAmount:
          Number(row[11] || 0),

        discount:
          Number(row[12] || 0),

        notes:
          String(row[13] || ''),

        items:
          parseItems_(row[14]),

        subtotal:
          Number(row[15] || 0),

        total:
          Number(row[16] || 0),

        orderDate:
          orderDate
      });
    });
  }

  /*
   * Newest OrderDate first.
   */
  orders.sort(function(a, b) {
    const da =
      orderDateSortValue_(
        a.orderDate,
        a.createdAt
      );

    const db =
      orderDateSortValue_(
        b.orderDate,
        b.createdAt
      );

    return db - da;
  });

  return {
    ok: true,
    orders: orders,
    settings: getSettings_()
  };
}


/**
 * ============================================================
 * DATA HELPERS
 * ============================================================
 */

function parseItems_(value) {
  try {
    const parsed =
      JSON.parse(String(value || '[]'));

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (err) {
    return [];
  }
}


function toIso_(value) {
  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value)
  ) {
    return value.toISOString();
  }

  const d = new Date(value);

  return isNaN(d)
    ? String(value)
    : d.toISOString();
}


function normalizeOrderDate_(value) {
  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value)
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  const s = String(value).trim();

  const m = s.match(
    /^(\d{4}-\d{2}-\d{2})/
  );

  if (m) {
    return m[1];
  }

  const d = new Date(value);

  if (isNaN(d)) {
    return '';
  }

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


function orderDateSortValue_(orderDate, createdAt) {
  const d = orderDate
    ? new Date(orderDate + 'T12:00:00')
    : new Date(createdAt);

  return isNaN(d)
    ? 0
    : d.getTime();
}


/**
 * ============================================================
 * ORDER NUMBER
 * ============================================================
 */

function nextOrderNumber_(sheet) {
  const lastRow = sheet.getLastRow();
  let max = 0;

  if (lastRow >= 2) {

    const nums = sheet
      .getRange(2, 2, lastRow - 1, 1)
      .getValues();

    nums.forEach(function(row) {

      const m =
        String(row[0] || '')
          .trim()
          .match(/^R-(\d+)$/i);

      if (m) {
        max = Math.max(
          max,
          Number(m[1])
        );
      }
    });
  }

  return 'R-' + (max + 1);
}


/**
 * ============================================================
 * SAVE ORDER
 * ============================================================
 */

function saveOrder_(raw) {
  if (!raw) {
    throw new Error(
      'Order data is missing.'
    );
  }

  const order =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : raw;

  validateOrder_(order);

  const sheet = getSheet_();

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {

    const now = new Date();

    const id =
      String(
        order.id ||
        (
          'o_' +
          now.getTime() +
          '_' +
          Utilities.getUuid().slice(0, 6)
        )
      );

    const orderNo =
      nextOrderNumber_(sheet);

    const createdAt =
      order.createdAt
        ? new Date(order.createdAt)
        : now;

    const updatedAt = now;

    const orderDate =
      parseOrderDateForSheet_(
        order.orderDate,
        createdAt
      );

    /*
     * EXACTLY 18 values.
     *
     * Must always match ORDER_HEADERS.
     */
    const row = [

      id,                                      // 1 ID

      orderNo,                                 // 2 OrderNo

      createdAt,                               // 3 CreatedAt

      updatedAt,                               // 4 UpdatedAt

      String(order.customerName || ''),       // 5 CustomerName

      String(order.phone || ''),               // 6 Phone

      String(order.address || ''),             // 7 Address

      Number(order.shipping || 0),             // 8 Shipping

      String(order.status || 'New'),           // 9 Status

      String(order.payment || 'Pending'),      // 10 Payment

      Number(order.advancePercent || 0),       // 11 AdvancePercent

      Number(order.advanceAmount || 0),        // 12 AdvanceAmount

      Number(order.discount || 0),             // 13 Discount

      String(order.notes || ''),               // 14 Notes

      JSON.stringify(order.items || []),       // 15 ItemsJSON

      Number(order.subtotal || 0),              // 16 Subtotal

      Number(order.total || 0),                // 17 Total

      orderDate                                  // 18 OrderDate
    ];

    /*
     * Safety check.
     */
    if (row.length !== ORDER_HEADERS.length) {
      throw new Error(
        'Internal error: order data has ' +
        row.length +
        ' columns but the sheet requires ' +
        ORDER_HEADERS.length +
        '.'
      );
    }

    sheet.appendRow(row);

    const newRow =
      sheet.getLastRow();

    /*
     * OrderDate is column 18.
     */
    sheet
      .getRange(
        newRow,
        18
      )
      .setNumberFormat('yyyy-mm-dd');

    return listOrders_();

  } finally {
    lock.releaseLock();
  }
}


/**
 * ============================================================
 * UPDATE ORDER
 * ============================================================
 */

function updateOrder_(raw) {
  if (!raw) {
    throw new Error(
      'Order data is missing.'
    );
  }

  const order =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : raw;

  validateOrder_(order);

  const sheet = getSheet_();

  const id =
    String(order.id || '');

  if (!id) {
    throw new Error(
      'Order ID is missing.'
    );
  }

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error(
      'Order not found.'
    );
  }

  const ids =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();

  for (let i = 0; i < ids.length; i++) {

    if (String(ids[i][0]) === id) {

      const rowNumber = i + 2;

      const oldOrderNo =
        String(
          sheet
            .getRange(rowNumber, 2)
            .getValue() || ''
        );

      const oldCreated =
        sheet
          .getRange(rowNumber, 3)
          .getValue();

      const createdAt =
        oldCreated || new Date();

      const orderDate =
        parseOrderDateForSheet_(
          order.orderDate,
          createdAt
        );

      /*
       * EXACTLY 18 values.
       */
      const row = [

        id,

        oldOrderNo ||
          nextOrderNumber_(sheet),

        createdAt,

        new Date(),

        String(order.customerName || ''),

        String(order.phone || ''),

        String(order.address || ''),

        Number(order.shipping || 0),

        (String(order.status || 'New') === 'Packed' ? 'Confirmed' : String(order.status || 'New')),

        String(order.payment || 'Pending'),

        Number(order.advancePercent || 0),

        Number(order.advanceAmount || 0),

        Number(order.discount || 0),

        String(order.notes || ''),

        JSON.stringify(order.items || []),

        Number(order.subtotal || 0),

        Number(order.total || 0),

        orderDate
      ];

      /*
       * Safety check.
       */
      if (row.length !== ORDER_HEADERS.length) {
        throw new Error(
          'Internal error: updated order data has ' +
          row.length +
          ' columns but the sheet requires ' +
          ORDER_HEADERS.length +
          '.'
        );
      }

      /*
       * Write all 18 columns.
       */
      sheet
        .getRange(
          rowNumber,
          1,
          1,
          ORDER_HEADERS.length
        )
        .setValues([row]);

      /*
       * OrderDate = column 18.
       */
      sheet
        .getRange(
          rowNumber,
          18
        )
        .setNumberFormat('yyyy-mm-dd');

      return listOrders_();
    }
  }

  throw new Error(
    'Order not found.'
  );
}


/**
 * ============================================================
 * ORDER DATE
 * ============================================================
 */

function parseOrderDateForSheet_(value, fallback) {

  const s =
    String(value || '').trim();

  const m =
    s.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (m) {

    /*
     * Noon prevents a date-only value from
     * shifting because of timezone conversion.
     */
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      12,
      0,
      0
    );
  }

  return (
    fallback instanceof Date &&
    !isNaN(fallback)
  )
    ? fallback
    : new Date();
}


/**
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateOrder_(order) {

  if (!order || typeof order !== 'object') {
    throw new Error(
      'Invalid order.'
    );
  }

  if (
    !Array.isArray(order.items) ||
    order.items.length === 0
  ) {
    throw new Error(
      'Order must contain at least one item.'
    );
  }

  const allowedStatuses = [
    'New',
    'Confirmed',
    'Dispatched',
    'Delivered',
    'Cancelled'
  ];

  const allowedPayments = [
    'Pending',
    'Advanced Received',
    'Paid',
    'Partially Paid',
    'COD'
  ];

  /*
   * Status validation.
   */
  if (
    order.status &&
    allowedStatuses.indexOf(
      String(order.status)
    ) === -1
  ) {
    throw new Error(
      'Invalid order status.'
    );
  }

  /*
   * Payment validation.
   */
  if (
    order.payment &&
    allowedPayments.indexOf(
      String(order.payment)
    ) === -1
  ) {
    throw new Error(
      'Invalid payment status.'
    );
  }

  /*
   * Basic numeric validation.
   */
  const orderTotal =
    Number(order.total || 0);

  const discount =
    Number(order.discount || 0);

  const advancePercent =
    Number(order.advancePercent || 0);

  const advanceAmount =
    Number(order.advanceAmount || 0);

  if (
    !Number.isFinite(orderTotal) ||
    orderTotal < 0
  ) {
    throw new Error(
      'Invalid order total.'
    );
  }

  if (
    !Number.isFinite(discount) ||
    discount < 0
  ) {
    throw new Error(
      'Invalid discount.'
    );
  }

  if (
    !Number.isFinite(advancePercent) ||
    advancePercent < 0 ||
    advancePercent > 100
  ) {
    throw new Error(
      'Invalid advance percentage.'
    );
  }

  if (
    !Number.isFinite(advanceAmount) ||
    advanceAmount < 0 ||
    advanceAmount > orderTotal + 0.01
  ) {
    throw new Error(
      'Advance amount cannot exceed order total.'
    );
  }

  /*
   * Advanced Received validation.
   *
   * The percentage and amount must match.
   */
  if (
    String(order.payment || '') ===
    'Advanced Received'
  ) {

    const expectedAmount =
      orderTotal *
      advancePercent /
      100;

    if (
      Math.abs(
        expectedAmount -
        advanceAmount
      ) > 0.02
    ) {
      throw new Error(
        'Advance percentage and amount do not match.'
      );
    }
  }

  /*
   * Order date validation.
   */
  if (
    order.orderDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(order.orderDate)
    )
  ) {
    throw new Error(
      'Invalid order date.'
    );
  }

  /*
   * Discount validation.
   */
  if (
    order.discount != null &&
    (
      !Number.isFinite(
        Number(order.discount)
      ) ||
      Number(order.discount) < 0
    )
  ) {
    throw new Error(
      'Invalid discount.'
    );
  }

  /*
   * Item validation.
   */
  order.items.forEach(function(item) {

    if (
      !String(item.design || '').trim()
    ) {
      throw new Error(
        'Every item needs a design.'
      );
    }

    if (
      !String(item.size || '').trim()
    ) {
      throw new Error(
        'Every item needs a size.'
      );
    }

    if (
      !Number.isFinite(
        Number(item.price)
      ) ||
      Number(item.price) < 0
    ) {
      throw new Error(
        'Invalid item price.'
      );
    }

    if (
      !Number.isFinite(
        Number(item.quantity)
      ) ||
      Number(item.quantity) <= 0
    ) {
      throw new Error(
        'Invalid item quantity.'
      );
    }
  });
}


/**
 * ============================================================
 * UPDATE STATUS
 * ============================================================
 */

function updateStatus_(id, status) {

  if (status === 'Packed') status = 'Confirmed';

  if (!id) {
    throw new Error(
      'Order ID is missing.'
    );
  }

  const allowed = [
    'New',
    'Confirmed',
    'Dispatched',
    'Delivered',
    'Cancelled'
  ];

  if (
    allowed.indexOf(status) === -1
  ) {
    throw new Error(
      'Invalid status.'
    );
  }

  const sheet = getSheet_();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error(
      'Order not found.'
    );
  }

  const ids =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();

  for (let i = 0; i < ids.length; i++) {

    if (String(ids[i][0]) === id) {

      const rowNumber = i + 2;


      /*
       * UpdatedAt = column 4.
       */
      sheet
        .getRange(rowNumber, 4)
        .setValue(new Date());

      /*
       * Status = column 9.
       */
      sheet
        .getRange(rowNumber, 9)
        .setValue(status);

      return listOrders_();
    }
  }

  throw new Error(
    'Order not found.'
  );
}


/**
 * ============================================================
 * DELETE ORDER
 * ============================================================
 */

function deleteOrder_(id) {

  if (!id) {
    throw new Error(
      'Order ID is missing.'
    );
  }

  const sheet = getSheet_();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error(
      'Order not found.'
    );
  }

  const ids =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();

  for (
    let i = ids.length - 1;
    i >= 0;
    i--
  ) {

    if (String(ids[i][0]) === id) {

      sheet.deleteRow(i + 2);

      return listOrders_();
    }
  }

  throw new Error(
    'Order not found.'
  );
}


/**
 * ============================================================
 * CLEAR ORDERS
 * ============================================================
 */

function clearOrders_() {

  const sheet = getSheet_();

  const lastRow =
    sheet.getLastRow();

  if (lastRow >= 2) {
    sheet.deleteRows(
      2,
      lastRow - 1
    );
  }

  return listOrders_();
}
