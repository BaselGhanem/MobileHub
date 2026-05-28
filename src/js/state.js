// src/js/state.js
// Centralised reactive state — all modules read from here.
// Firestore listeners keep everything in sync automatically.

import { db, COLLECTIONS }    from './firebase.js';
import {
  collection, onSnapshot, query,
  orderBy, limit, where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── State containers ──
export const state = {
  devices:          [],
  sales:            [],
  products:         [],
  stockPurchases:   [],
  otherPurchases:   [],
  warehouse:        [],
  whMovements:      [],
  employees:        [],
  attendance:       [],
  advances:         [],
  salaryRecords:    [],
  insurancePayments:[],
  settings:         {},
  customers:        [],
  // UI
  activeModule:     'overview',
  sidebarOpen:      false,
  loading:          {},   // { collectionName: true|false }
};

// ── Listeners registry (so we can unsubscribe on logout) ──
const _unsubs = [];

// ── Start all listeners ──
export function startListeners(onChange) {
  const listen = (colName, stateKey, q = null) => {
    state.loading[stateKey] = true;
    const ref = q ?? query(collection(db, colName), orderBy('date', 'desc'), limit(200));
    const unsub = onSnapshot(ref, (snap) => {
      state[stateKey] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      state.loading[stateKey] = false;
      onChange(stateKey);
    }, (err) => {
      console.error(`[state] ${stateKey} error:`, err);
      state.loading[stateKey] = false;
    });
    _unsubs.push(unsub);
  };

  listen(COLLECTIONS.DEVICES,          'devices');
  listen(COLLECTIONS.SALES,            'sales');
  listen(COLLECTIONS.PRODUCTS,         'products',       query(collection(db, COLLECTIONS.PRODUCTS), orderBy('name')));
  listen(COLLECTIONS.STOCK_PURCHASES,  'stockPurchases');
  listen(COLLECTIONS.OTHER_PURCHASES,  'otherPurchases');
  listen(COLLECTIONS.WAREHOUSE,        'warehouse',      query(collection(db, COLLECTIONS.WAREHOUSE), orderBy('name')));
  listen(COLLECTIONS.WH_MOVEMENTS,     'whMovements');
  listen(COLLECTIONS.EMPLOYEES,        'employees',      query(collection(db, COLLECTIONS.EMPLOYEES), orderBy('name')));
  listen(COLLECTIONS.ATTENDANCE,       'attendance');
  listen(COLLECTIONS.ADVANCES,         'advances');
  listen(COLLECTIONS.SALARY_RECORDS,   'salaryRecords');
  listen(COLLECTIONS.INSURANCE,        'insurancePayments', query(collection(db, COLLECTIONS.INSURANCE), orderBy('month','desc')));
  listen(COLLECTIONS.CUSTOMERS,        'customers');

  // Settings (single doc)
  const settingsUnsub = onSnapshot(doc => {}, () => {}); // placeholder
  const settingsRef = collection(db, COLLECTIONS.SETTINGS);
  const su = onSnapshot(settingsRef, snap => {
    snap.docs.forEach(d => { state.settings = { _id: d.id, ...d.data() }; });
    onChange('settings');
  });
  _unsubs.push(su);
}

// ── Stop all listeners (on logout) ──
export function stopListeners() {
  _unsubs.forEach(u => u());
  _unsubs.length = 0;
}

// ── Helper: get employee name by id ──
export function empName(empId) {
  return state.employees.find(e => e._id === empId)?.name ?? '—';
}

// ── Helper: today's string ──
export function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Helper: current month ──
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
