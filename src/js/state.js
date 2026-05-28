// src/js/state.js
import { db, COLLECTIONS } from './firebase.js';
import {
  collection, onSnapshot, query,
  orderBy, limit, where, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const state = {
  shopId:            null,
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

// ── shopId passed explicitly — no circular import needed ──
export function startListeners(shopId, onChange) {
  if (!shopId) {
    console.error('[state] startListeners called without shopId');
    return;
  }

  state.shopId = shopId;

  const listenShop = (colName, stateKey, extraOrders = []) => {
    state.loading[stateKey] = true;

    const q = query(
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
        // Firestore index errors are normal on first run — user sees link in console to create index
        if (err.code === 'failed-precondition') {
          console.warn(`[state] ${stateKey} needs a Firestore index — click the link in the error above to create it.`);
        } else {
          console.error(`[state] ${stateKey}:`, err.code, err.message);
        }
        state[stateKey] = [];
        state.loading[stateKey] = false;
        onChange(stateKey);
      }
    );
    _unsubs.push(unsub);
  };

  listenShop(COLLECTIONS.DEVICES,         'devices',          [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.SALES,           'sales',            [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.PRODUCTS,        'products',         [orderBy('name')]);
  listenShop(COLLECTIONS.STOCK_PURCHASES, 'stockPurchases',   [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.OTHER_PURCHASES, 'otherPurchases',   [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.WAREHOUSE,       'warehouse',        [orderBy('name')]);
  listenShop(COLLECTIONS.WH_MOVEMENTS,    'whMovements',      [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.EMPLOYEES,       'employees',        [orderBy('name')]);
  listenShop(COLLECTIONS.ATTENDANCE,      'attendance',       [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.ADVANCES,        'advances',         [orderBy('date', 'desc')]);
  listenShop(COLLECTIONS.SALARY_RECORDS,  'salaryRecords',    [orderBy('month', 'desc')]);
  listenShop(COLLECTIONS.INSURANCE,       'insurancePayments',[orderBy('month', 'desc')]);
  listenShop(COLLECTIONS.CUSTOMERS,       'customers',        [orderBy('name')]);

  // Settings — doc ID = shopId
  const su = onSnapshot(
    doc(db, COLLECTIONS.SETTINGS, shopId),
    (snap) => {
      if (snap.exists()) {
        state.settings = { _id: snap.id, ...snap.data() };
        onChange('settings');
      }
    },
    (err) => console.error('[state] settings:', err.code)
  );
  _unsubs.push(su);
}

export function stopListeners() {
  _unsubs.forEach(u => u());
  _unsubs.length = 0;
  state.shopId = null;
}

// ── Helpers ──
export const empName      = (id)  => state.employees.find(e => e._id === id)?.name ?? '—';
export const today        = ()    => new Date().toISOString().slice(0, 10);
export const currentMonth = ()    => new Date().toISOString().slice(0, 7);
export const shopId       = ()    => state.shopId;
