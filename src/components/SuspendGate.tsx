'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Box, Typography } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirestoreDb, doc, onSnapshot, BIZ_COLLECTION } from '@/lib/firebase';

// Public surfaces stay reachable even when the account is suspended
const OPEN_PREFIXES = ['/book', '/manage', '/login', '/register', '/terms', '/accessibility', '/activate', '/pilot-requests'];

/**
 * Account-level suspension gate: when the signed-in owner's business doc
 * carries suspended === true, the entire management app locks behind a
 * full-screen notice. Flips live via onSnapshot — no refresh needed.
 */
export function SuspendGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      if (!user) { setSuspended(false); return; }
      unsubDoc = onSnapshot(doc(getFirestoreDb(), BIZ_COLLECTION, user.uid), (snap) => {
        setSuspended(snap.exists() && (snap.data() as { suspended?: boolean }).suspended === true);
      }, () => setSuspended(false));
    });
    return () => { unsubAuth(); if (unsubDoc) unsubDoc(); };
  }, []);

  const isOpen = OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')) || pathname === '/';
  if (!suspended || isOpen) return <>{children}</>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0710', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', px: 3 }}>
      <Box sx={{ maxWidth: 420, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 56, mb: 2 }}>⏸️</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#fff', mb: 1.5 }}>החשבון מושעה זמנית</Typography>
        <Typography sx={{ fontSize: 14.5, color: '#9C93A8', lineHeight: 1.8 }}>
          הגישה למערכת הניהול הוקפאה. אם לדעתך מדובר בטעות, או להסדרת החשבון — דברו איתנו ונחזיר אתכם לאוויר במהירות.
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#C9A0FF', mt: 2, fontWeight: 700 }}>support@zikkit.app</Typography>
      </Box>
    </Box>
  );
}
