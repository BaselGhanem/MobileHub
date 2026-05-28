// src/js/state.js
// Multi-tenant: كل query مفلترة بـ shopId تلقائياً

import { db, COLLECTIONS }    from './firebase.js';
import { getShopId }          from './auth.js';
import {
  collection, onSnapshot, query,
  orderBy, limit, where, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const state = {
  shopId:            null,   // ← المفتاح الأساسي للـ multi-tenant
  devices:           [],
  sales:             [],
  products:          [],
  stockPurchases:    [],
  otherPurchases:    [],
  warehouse:         [],
  whMovements:       [],
  employees:         [],
  attendance:        [],
  advances:          [],
  salaryRecords:     [],
  insurancePayments: [],
  settings:          {},
  customers:         [],
  activeModule:      'overview',
  sidebarOpen:       false,
  loading:           {},
};

const _unsubs = [];

export function startListeners(onChange) {
  const shopId = getShopId();
  if (!shopId) { console.error('[state] No shopId — cannot start listeners'); return; }
  state.shopId = shopId;

  // ── Helper: listener مع فلتر shopId تلقائي ──
  const listenShop = (colName, stateKey, extraOrders = []) => {
    state.loading[stateKey] = true;

    let q = query(
      collection(db, colName),
      where('shopId', '==', shopId),
      ...extraOrders,
      limit(300)
    );

    const unsub = onSnapshot(q,
      (snap) => {
        state[stateKey] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        state.loading[stateKey] = false;
        onChange(stateKey);
      },
      (err) => {
        // index errors are normal on empty collections — silent
        if (err.code !== 'failed-precondition') {
          console.error(`[state] ${stateKey}:`, err.code);
        }
        state[stateKey] = [];
        state.loading[stateKey] = false;
        onChange(stateKey);
      }
    );
    _unsubs.push(unsub);
  };

  listenShop(COLLECTIONS.DEVICES,         'devices',          [orderBy('date','desc')]);
  listenShop(COLLECTIONS.SALES,           'sales',            [orderBy('date','desc')]);
  listenShop(COLLECTIONS.PRODUCTS,        'products',         [orderBy('name')]);
  listenShop(COLLECTIONS.STOCK_PURCHASES, 'stockPurchases',   [orderBy('date','desc')]);
  listenShop(COLLECTIONS.OTHER_PURCHASES, 'otherPurchases',   [orderBy('date','desc')]);
  listenShop(COLLECTIONS.WAREHOUSE,       'warehouse',        [orderBy('name')]);
  listenShop(COLLECTIONS.WH_MOVEMENTS,    'whMovements',      [orderBy('date','desc')]);
  listenShop(COLLECTIONS.EMPLOYEES,       'employees',        [orderBy('name')]);
  listenShop(COLLECTIONS.ATTENDANCE,      'attendance',       [orderBy('date','desc')]);
  listenShop(COLLECTIONS.ADVANCES,        'advances',         [orderBy('date','desc')]);
  listenShop(COLLECTIONS.SALARY_RECORDS,  'salaryRecords',    [orderBy('month','desc')]);
  listenShop(COLLECTIONS.INSURANCE,       'insurancePayments',[orderBy('month','desc')]);
  listenShop(COLLECTIONS.CUSTOMERS,       'customers',        [orderBy('name')]);

  // ── Settings — doc واحد لكل محل ──
  const settingsUnsub = onSnapshot(
    collection(db, COLLECTIONS.SETTINGS),
    (snap) => {
      // فلتر يدوي لأن settings doc ID = shopId
      const myDoc = snap.docs.find(d => d.id === shopId);
      if (myDoc) {
        state.settings = { _id: myDoc.id, ...myDoc.data() };
        onChange('settings');
      }
    },
    (err) => { console.error('[state] settings:', err.code); }
  );
  _unsubs.push(settingsUnsub);
}

export function stopListeners() {
  _unsubs.forEach(u => u());
  _unsubs.length = 0;
  state.shopId = null;
}

// ── Helpers ──
export const empName      = (id) => state.employees.find(e => e._id === id)?.name ?? '—';
export const today        = ()   => new Date().toISOString().slice(0, 10);
export const currentMonth = ()   => new Date().toISOString().slice(0, 7);

// ── Shortcut: shopId for writes ──
export const shopId = () => state.shopId;
