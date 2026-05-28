// src/js/firebase.js
import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore,
         initializeFirestore,
         persistentLocalCache,
         persistentMultipleTabManager }
                           from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDmkPioDg5ZewsX2ANM1hAqgVWyzLeezeU',
  authDomain:        'mobilehub-4eb1d.firebaseapp.com',
  projectId:         'mobilehub-4eb1d',
  storageBucket:     'mobilehub-4eb1d.firebasestorage.app',
  messagingSenderId: '13420871425',
  appId:             '1:13420871425:web:76fb7e44e6f23e0e25a500',
  measurementId:     'G-71V9496Z17'
};

const app = initializeApp(firebaseConfig);

// ── Modern offline persistence (multi-tab safe, no deprecation warning) ──
export const db = initializeFirestore(app, {
  cache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);

// ── Collection name constants ──
export const COLLECTIONS = {
  USERS:            'users',
  DEVICES:          'devices',
  SALES:            'sales',
  PRODUCTS:         'products',
  STOCK_PURCHASES:  'stockPurchases',
  OTHER_PURCHASES:  'otherPurchases',
  WAREHOUSE:        'warehouse',
  WH_MOVEMENTS:     'whMovements',
  EMPLOYEES:        'employees',
  ATTENDANCE:       'attendance',
  ADVANCES:         'advances',
  SALARY_RECORDS:   'salaryRecords',
  INSURANCE:        'insurancePayments',
  SETTINGS:         'settings',
  CUSTOMERS:        'customers',
};
