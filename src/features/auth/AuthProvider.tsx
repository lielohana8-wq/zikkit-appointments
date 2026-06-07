'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth, getFirestoreDb, doc, getDoc, setDoc, PRODUCT } from '@/lib/firebase';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff' | 'pending';
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  bizId: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, bizName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null, user: null, bizId: null, loading: true, error: null,
  login: async () => {}, register: async () => {}, loginWithGoogle: async () => {},
  logout: async () => {}, clearError: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null, user: null, bizId: null, loading: true, error: null,
  });

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setState({ firebaseUser: null, user: null, bizId: null, loading: false, error: null });
        return;
      }
      const uid = fbUser.uid;
      const email = fbUser.email || '';
      try {
        const db = getFirestoreDb();
        // Look for an appointments business owned by this user
        const snap = await getDoc(doc(db, 'businesses', uid));
        if (snap.exists() && snap.data().product === PRODUCT) {
          const data = snap.data();
          setState({
            firebaseUser: fbUser,
            user: { id: uid, name: data.cfg?.biz_name || email.split('@')[0], email, role: 'owner' },
            bizId: uid, loading: false, error: null,
          });
          return;
        }
        // Authenticated but no appointments business yet — pending (will see setup)
        setState({
          firebaseUser: fbUser,
          user: { id: uid, name: email.split('@')[0] || 'User', email, role: 'pending' },
          bizId: uid, loading: false, error: null,
        });
      } catch (e) {
        console.error('[ZApp Auth]', e);
        setState({
          firebaseUser: fbUser,
          user: { id: uid, name: email.split('@')[0] || 'User', email, role: 'pending' },
          bizId: uid, loading: false, error: null,
        });
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: 'התחברות נכשלה. בדוק אימייל וסיסמה.' }));
      throw e;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, bizName: string) => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const db = getFirestoreDb();
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await setDoc(doc(db, 'businesses', cred.user.uid), {
        product: PRODUCT,
        cfg: { biz_name: bizName, lang: 'he', currency: 'ILS', region: 'IL', plan: 'trial', planStatus: 'trial', trialEnds: trialEnd },
        appointments: { bookings: [], stations: 1 },
        created: new Date().toISOString(),
        ownerEmail: email.toLowerCase(),
      });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: 'הרשמה נכשלה. ייתכן שהאימייל כבר רשום.' }));
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: null }));
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const db = getFirestoreDb();
      const existing = await getDoc(doc(db, 'businesses', result.user.uid));
      // Only create an appointments business if none exists for this product
      if (!existing.exists() || existing.data().product !== PRODUCT) {
        if (!existing.exists()) {
          const bizName = result.user.displayName || result.user.email?.split('@')[0] || 'העסק שלי';
          const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          await setDoc(doc(db, 'businesses', result.user.uid), {
            product: PRODUCT,
            cfg: { biz_name: bizName, lang: 'he', currency: 'ILS', region: 'IL', plan: 'trial', planStatus: 'trial', trialEnds: trialEnd },
            appointments: { bookings: [], stations: 1 },
            created: new Date().toISOString(),
            ownerEmail: result.user.email?.toLowerCase() || '',
          });
        }
        // If a field-service business exists under this uid, we do NOT overwrite it.
        // (Per product decision: each product = separate subscription. A shared uid
        //  with both products is an edge case handled later.)
      }
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: 'התחברות Google נכשלה.' }));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const clearError = useCallback(() => setState((p) => ({ ...p, error: null })), []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithGoogle, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
