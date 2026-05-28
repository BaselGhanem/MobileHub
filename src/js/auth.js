// src/js/auth.js
import { auth, db, COLLECTIONS } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc,
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export let currentUser = null;

export const ROLES = {
  admin:   { label: '👑 مدير',  modules: ['overview','maintenance','pos','stock-purchases','other-purchases','warehouse','hr','reports','settings','manage-techs','technicians'] },
  tech:    { label: '🔧 فني',   modules: ['mywork'] },
  cashier: { label: '🛒 كاشير', modules: ['overview','pos','maintenance'] },
};

export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) { currentUser = null; onLogout(); return; }

    try {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, fbUser.uid));
      if (!snap.exists()) {
        console.error('[auth] User doc missing for uid:', fbUser.uid);
        await signOut(auth); onLogout(); return;
      }

      const data = snap.data();

      // ── shopId fallback: if missing, try to find settings doc ──
      let shopId = data.shopId;
      if (!shopId) {
        console.warn('[auth] shopId missing from user doc — attempting recovery');
        // For admin: shopId = their own uid (set during setup)
        // Try to find a settings doc where this uid is referenced
        const settingsSnap = await getDocs(collection(db, COLLECTIONS.SETTINGS));
        if (!settingsSnap.empty) {
          // If only one shop exists, assign it
          shopId = settingsSnap.docs[0].id;
          // Fix the user doc
          await setDoc(doc(db, COLLECTIONS.USERS, fbUser.uid), { ...data, shopId }, { merge: true });
          console.warn('[auth] shopId recovered and saved:', shopId);
        }
      }

      if (!shopId) {
        console.error('[auth] Could not determine shopId — cannot continue');
        await signOut(auth); onLogout(); return;
      }

      currentUser = {
        uid:    fbUser.uid,
        email:  fbUser.email,
        shopId,
        ...data,
        shopId, // ensure override
      };

      onLogin(currentUser);
    } catch (err) {
      console.error('[auth] initAuth error:', err.code, err.message);
      onLogout();
    }
  });
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, cred.user.uid));
  if (!snap.exists()) throw new Error('بيانات المستخدم غير موجودة في النظام');
  const data = snap.data();

  let shopId = data.shopId;
  if (!shopId) {
    const settingsSnap = await getDocs(collection(db, COLLECTIONS.SETTINGS));
    if (!settingsSnap.empty) {
      shopId = settingsSnap.docs[0].id;
      await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), { ...data, shopId }, { merge: true });
    }
  }

  currentUser = { uid: cred.user.uid, email: cred.user.email, shopId, ...data, shopId };
  return currentUser;
}

export async function logout() {
  await signOut(auth);
  currentUser = null;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function createUser({ email, password, name, role, avatar, shopId }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), {
    name,
    role,
    avatar: avatar || name.charAt(0),
    shopId,
  });
  return cred.user.uid;
}

export function canAccess(moduleId) {
  if (!currentUser) return false;
  return ROLES[currentUser.role]?.modules.includes(moduleId) ?? false;
}

export function getShopId() {
  return currentUser?.shopId ?? null;
}
