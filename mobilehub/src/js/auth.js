// src/js/auth.js
import { auth, db, COLLECTIONS } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Current session ──
export let currentUser = null;
// { uid, email, name, role, avatar, shopId }

// ── Role permissions ──
export const ROLES = {
  admin:   { label: '👑 مدير',  modules: ['overview','maintenance','pos','stock-purchases','other-purchases','warehouse','hr','reports','settings','manage-techs','technicians'] },
  tech:    { label: '🔧 فني',   modules: ['mywork'] },
  cashier: { label: '🛒 كاشير', modules: ['overview','pos','maintenance'] },
};

// ── Init auth listener ──
export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) { currentUser = null; onLogout(); return; }

    try {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, fbUser.uid));
      if (!snap.exists()) { await signOut(auth); onLogout(); return; }

      currentUser = { uid: fbUser.uid, email: fbUser.email, ...snap.data() };
      onLogin(currentUser);
    } catch (err) {
      console.error('[auth] initAuth error:', err.code);
      onLogout();
    }
  });
}

// ── Login ──
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, cred.user.uid));
  if (!snap.exists()) throw new Error('بيانات المستخدم غير موجودة في النظام');
  currentUser = { uid: cred.user.uid, email: cred.user.email, ...snap.data() };
  return currentUser;
}

// ── Logout ──
export async function logout() {
  await signOut(auth);
  currentUser = null;
}

// ── Create user (admin only, same shop) ──
export async function createUser({ email, password, name, role, avatar, shopId }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    name,
    role,
    avatar: avatar || name.charAt(0),
    shopId,           // ← ربط المستخدم بالمحل
  });
  return uid;
}

// ── Permission check ──
export function canAccess(moduleId) {
  if (!currentUser) return false;
  return ROLES[currentUser.role]?.modules.includes(moduleId) ?? false;
}

// ── Get current shopId ──
export function getShopId() {
  return currentUser?.shopId ?? null;
}
