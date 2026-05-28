// src/js/auth.js
import { auth, db, COLLECTIONS } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Current user cache ──
export let currentUser = null;   // { uid, email, name, role, avatar, techId? }

// ── Role permissions ──
export const ROLES = {
  admin:   { label: '👑 مدير',  modules: ['overview','maintenance','pos','stock-purchases','other-purchases','warehouse','hr','reports','settings','manage-techs','technicians'] },
  tech:    { label: '🔧 فني',   modules: ['mywork'] },
  cashier: { label: '🛒 كاشير', modules: ['pos','maintenance'] },
};

// ── Listen to auth state (called once on app load) ──
export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
      if (snap.exists()) {
        currentUser = { uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() };
        onLogin(currentUser);
      } else {
        // user doc missing — sign out
        await signOut(auth);
        onLogout();
      }
    } else {
      currentUser = null;
      onLogout();
    }
  });
}

// ── Login ──
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, cred.user.uid));
  if (!snap.exists()) throw new Error('بيانات المستخدم غير موجودة');
  currentUser = { uid: cred.user.uid, ...snap.data() };
  return currentUser;
}

// ── Logout ──
export async function logout() {
  await signOut(auth);
  currentUser = null;
}

// ── Create user (admin only) ──
export async function createUser({ email, password, name, role, avatar, techId }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), {
    name, role, avatar: avatar || name.charAt(0),
    ...(techId ? { techId } : {})
  });
  return cred.user.uid;
}

// ── Check if current user can access a module ──
export function canAccess(moduleId) {
  if (!currentUser) return false;
  return ROLES[currentUser.role]?.modules.includes(moduleId) ?? false;
}
