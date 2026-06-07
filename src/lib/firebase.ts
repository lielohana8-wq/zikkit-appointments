import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
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

export { doc, getDoc, setDoc, collection, getDocs };

// Product tag — this is how ZikkitAppointments data is separated
// from the field-service Zikkit while sharing the same Firebase project.
export const PRODUCT = 'appointments' as const;

// Dedicated collection — fully separate from Zikkit field's `businesses`.
// Guarantees zero ID collisions even if the same person uses both products.
export const BIZ_COLLECTION = 'appointment_businesses' as const;
