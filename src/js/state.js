// src/js/state.js
import { db, COLLECTIONS } from './firebase.js';
import {
  collection, onSnapshot, query,
  orderBy, limit, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const state = {
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

  // ── Generic collection listener ──
  const listenCol = (colName, stateKey, q) => {
    state.loading[stateKey] = true;
    const ref = q ?? query(collection(db, colName), orderBy('date', 'desc'), limit(200));
    const unsub = onSnapshot(ref,
      (snap) => {
        state[stateKey] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        state.loading[stateKey] = false;
        onChange(stateKey);
      },
      (err) => {
        // Suppress index-missing noise in console for empty collections
        if (!err.message.includes('requires an index')) {
          console.error(`[state] ${stateKey}:`, err.code);
        }
        state[stateKey] = [];
        state.loading[stateKey] = false;
        onChange(stateKey);
      }
    );
    _unsubs.push(unsub);
  };

  listenCol(COLLECTIONS.DEVICES,         'devices');
  listenCol(COLLECTIONS.SALES,           'sales');
  listenCol(COLLECTIONS.PRODUCTS,        'products',
    query(collection(db, COLLECTIONS.PRODUCTS), orderBy('name'), limit(500)));
  listenCol(COLLECTIONS.STOCK_PURCHASES, 'stockPurchases');
  listenCol(COLLECTIONS.OTHER_PURCHASES, 'otherPurchases');
  listenCol(COLLECTIONS.WAREHOUSE,       'warehouse',
    query(collection(db, COLLECTIONS.WAREHOUSE), orderBy('name'), limit(500)));
  listenCol(COLLECTIONS.WH_MOVEMENTS,    'whMovements');
  listenCol(COLLECTIONS.EMPLOYEES,       'employees',
    query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name'), limit(100)));
  listenCol(COLLECTIONS.ATTENDANCE,      'attendance');
  listenCol(COLLECTIONS.ADVANCES,        'advances');
  listenCol(COLLECTIONS.SALARY_RECORDS,  'salaryRecords');
  listenCol(COLLECTIONS.INSURANCE,       'insurancePayments',
    query(collection(db, COLLECTIONS.INSURANCE), orderBy('month', 'desc'), limit(24)));
  listenCol(COLLECTIONS.CUSTOMERS,       'customers');

  // ── Settings — single doc listener ──
  const settingsUnsub = onSnapshot(
    collection(db, COLLECTIONS.SETTINGS),
    (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        state.settings = { _id: d.id, ...d.data() };
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
}

export const empName     = (id)  => state.employees.find(e => e._id === id)?.name ?? '—';
export const today       = ()    => new Date().toISOString().slice(0, 10);
export const currentMonth= ()    => new Date().toISOString().slice(0, 7);
