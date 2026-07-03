import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function getApp_(): FirebaseApp {
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  authInstance = getAuth(getApp_());
  return authInstance;
}

export function getFirestoreDb(): Firestore {
  if (dbInstance) return dbInstance;
  const a = getApp_();
  try {
    dbInstance = initializeFirestore(a, { ignoreUndefinedProperties: true });
  } catch {
    dbInstance = getFirestore(a);
  }
  return dbInstance;
}

export { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs };

// Product tag — this is how ZikkitAppointments data is separated
// from the field-service Zikkit while sharing the same Firebase project.
export const PRODUCT = 'appointments' as const;

// Dedicated collection — fully separate from Zikkit field's `businesses`.
// Guarantees zero ID collisions even if the same person uses both products.
export const BIZ_COLLECTION = 'appointment_businesses' as const;

// ---------------------------------------------------------------------------
// Cached business-document reader.
// Reduces repeat Firestore reads: a revisit within TTL returns the cached
// snapshot instead of hitting the network. Call invalidateBizCache(bizId)
// after any write so the next read is fresh. Safe, additive — pages may opt in.
// ---------------------------------------------------------------------------
import { getDoc as _getDoc, doc as _doc } from 'firebase/firestore';

interface BizCacheEntry { data: Record<string, unknown>; ts: number; }
const _bizCache = new Map<string, BizCacheEntry>();
const BIZ_TTL = 30_000;

export async function getBizDocCached(bizId: string, force = false): Promise<Record<string, unknown> | null> {
  const hit = _bizCache.get(bizId);
  if (!force && hit && Date.now() - hit.ts < BIZ_TTL) return hit.data;
  const snap = await _getDoc(_doc(getFirestoreDb(), BIZ_COLLECTION, bizId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  _bizCache.set(bizId, { data, ts: Date.now() });
  return data;
}

export function invalidateBizCache(bizId: string): void {
  _bizCache.delete(bizId);
}
