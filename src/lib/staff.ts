'use client';

import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestoreDb, doc, setDoc, getDoc } from '@/lib/firebase';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Create a staff login WITHOUT signing out the currently logged-in owner.
 * We spin up a temporary secondary Firebase app, create the user there,
 * then delete the secondary app. The owner's session stays intact.
 *
 * Also writes staff_lookup/{uid} → { ownerBizId, staffId, name } so that
 * when the staff member logs in, AuthProvider knows which business they
 * belong to and which appointments are theirs.
 */
export async function createStaffAccount(params: {
  ownerBizId: string;
  staffId: string;
  staffName: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; uid?: string; error?: string }> {
  const { ownerBizId, staffId, staffName, email, password } = params;
  const secondaryName = 'staff-creator-' + Date.now();
  let secondaryApp;
  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryName);
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
    const uid = cred.user.uid;

    // Map this staff account to the owner's business
    const db = getFirestoreDb();
    await setDoc(doc(db, 'staff_lookup', uid), {
      ownerBizId,
      staffId,
      staffName,
      email: email.toLowerCase(),
      createdAt: new Date().toISOString(),
    });

    // sign out the secondary (not strictly needed, app is deleted)
    await secondaryAuth.signOut().catch(() => {});
    return { success: true, uid };
  } catch (e) {
    const msg = (e as { code?: string }).code === 'auth/email-already-in-use'
      ? 'האימייל כבר רשום במערכת'
      : (e as Error).message;
    return { success: false, error: msg };
  } finally {
    if (secondaryApp && getApps().some((a) => a.name === secondaryName)) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }
}

/** Look up a staff member's owner business by their uid. */
export async function getStaffLookup(uid: string): Promise<{ ownerBizId: string; staffId: string; staffName: string } | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'staff_lookup', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ownerBizId: d.ownerBizId, staffId: d.staffId, staffName: d.staffName };
}
