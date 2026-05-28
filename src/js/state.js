// src/js/state.js
import { db, COLLECTIONS } from './firebase.js';
import {
  collection, onSnapshot, query,
  limit, where, doc
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

// Sort client-side — no composite index needed
const sortBy = (arr, key, desc = true) =>
  [...arr].sort((a, b) => {
    const av = a[key] || '', bv = b[key] || '';
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  });

export function startListeners(shopId, onChange) {
  if (!shopId) {
    console.error('[state] startListeners called without shopId');
    return;
  }
  console.log('[state] Starting listeners for shopId:', shopId);
  state.shopId = shopId;

  const listen = (colName, stateKey, sortKey = 'date', sortDesc = true) => {
    state.loading[stateKey] = true;
    const q = query(collection(db, colName), where('shopId', '==', shopId), limit(300));
    const unsub = onSnapshot(q,
      (snap) => {
        const raw = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        state[stateKey] = sortKey ? sortBy(raw, sortKey, sortDesc) : raw;
        state.loading[stateKey] = false;
        onChange(stateKey);
      },
      (err) => {
        console.error('[state] ' + stateKey + ':', err.code, err.message);
        state[stateKey] = [];
        state.loading[stateKey] = false;
        onChange(stateKey);
      }
    );
    _unsubs.push(unsub);
  };

  listen(COLLECTIONS.DEVICES,         'devices',           'date',  true);
  listen(COLLECTIONS.SALES,           'sales',             'date',  true);
  listen(COLLECTIONS.PRODUCTS,        'products',          'name',  false);
  listen(COLLECTIONS.STOCK_PURCHASES, 'stockPurchases',    'date',  true);
  listen(COLLECTIONS.OTHER_PURCHASES, 'otherPurchases',    'date',  true);
  listen(COLLECTIONS.WAREHOUSE,       'warehouse',         'name',  false);
  listen(COLLECTIONS.WH_MOVEMENTS,    'whMovements',       'date',  true);
  listen(COLLECTIONS.EMPLOYEES,       'employees',         'name',  false);
  listen(COLLECTIONS.ATTENDANCE,      'attendance',        'date',  true);
  listen(COLLECTIONS.ADVANCES,        'advances',          'date',  true);
  listen(COLLECTIONS.SALARY_RECORDS,  'salaryRecords',     'month', true);
  listen(COLLECTIONS.INSURANCE,       'insurancePayments', 'month', true);
  listen(COLLECTIONS.CUSTOMERS,       'customers',         'name',  false);

  // Settings — single doc
  const su = onSnapshot(
    doc(db, COLLECTIONS.SETTINGS, shopId),
    (snap) => {
      if (snap.exists()) state.settings = { _id: snap.id, ...snap.data() };
      onChange('settings');
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

export const empName      = (id)  => state.employees.find(e => e._id === id)?.name ?? '—';
export const today        = ()    => new Date().toISOString().slice(0, 10);
export const currentMonth = ()    => new Date().toISOString().slice(0, 7);
export const shopId       = ()    => state.shopId;
