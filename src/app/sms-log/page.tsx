'use client';

/**
 * SMS delivery log — every send attempt the system made for this business:
 * who, when, succeeded or failed, and Twilio's exact error. Turns
 * "sometimes it doesn't arrive" from a mystery into a list.
 */

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadBiz } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

interface SmsEntry { at: string; to: string; ok: boolean; err?: string; preview?: string; delivery?: string }

export default function SmsLogPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [items, setItems] = useState<SmsEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [health, setHealth] = useState<{ ok?: boolean; accountType?: string; balance?: string; warnings?: string[]; fix?: string } | null>(null);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const biz = await loadBiz(bizId);
      const log = (((biz as Record<string, unknown>).smsLog as Record<string, unknown>)?.items as SmsEntry[]) || [];
      setItems(log);
      fetch('/api/sms/health').then((r) => r.json()).then(setHealth).catch(() => {});
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const explain = (err?: string) => {
    if (!err) return '';
    if (err.includes('21608')) return ' → חשבון Trial: המספר הזה לא מאומת ב-Twilio';
    if (err.includes('21211')) return ' → מספר לא תקין';
    if (err.includes('21610')) return ' → הנמען חסם הודעות';
    if (err.includes('20003')) return ' → בעיית הרשאות/מפתחות Twilio';
    if (err.includes('TWILIO env')) return ' → מפתחות Twilio חסרים ב-Vercel';
    return '';
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.canvas }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.canvas }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20, bgcolor: c.chrome, backdropFilter: 'blur(20px)' }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: c.text }}>📨 יומן הודעות SMS</Typography>
        <Button onClick={() => { setDataLoading(true); load(); }} sx={{ color: c.accent, fontWeight: 500 }}>רענן</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2, sm: 4 }, py: 3 }}>
        {/* Account health */}
        {health && (
          <Box sx={{ bgcolor: health.ok ? c.accentDim : c.hotDim, border: `1px solid ${health.ok ? c.accent : c.hot}44`, borderRadius: 4, p: 2, mb: 2.5 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: c.text, mb: 0.5 }}>
              {health.ok ? '✅ חשבון Twilio תקין' : '⚠️ נדרש טיפול בחשבון Twilio'}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: c.text2 }}>
              {health.accountType && `סוג חשבון: ${health.accountType} · `}{health.balance && `יתרה: ${health.balance}`}
            </Typography>
            {(health.warnings || (health.fix ? [health.fix] : [])).map((w, i) => (
              <Typography key={i} sx={{ fontSize: 12.5, color: c.text2, mt: 0.75, lineHeight: 1.5 }}>{w}</Typography>
            ))}
          </Box>
        )}

        <Typography sx={{ fontSize: 13, color: c.text3, mb: 2 }}>כל ניסיון שליחה שהמערכת ביצעה — אישורים, תזכורות, ביטולים. אם הודעה לא הגיעה, כאן תראה בדיוק למה.</Typography>

        {items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5 }}>📭</Box>
            <Typography sx={{ fontWeight: 500, color: c.text, mb: 0.5 }}>עוד אין רשומות</Typography>
            <Typography sx={{ fontSize: 13, color: c.text3 }}>קבע תור בדיקה מדף ההזמנות — והשליחות יופיעו כאן</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {items.map((e, i) => (
              <Box key={i} sx={{ bgcolor: c.card, border: `1px solid ${e.ok ? c.border2 : c.hot + '55'}`, borderRadius: 4, p: 1.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 15 }}>{e.ok ? '✅' : '❌'}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: c.text, direction: 'ltr' }}>{e.to}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: c.text3, mr: 'auto' }}>{new Date(e.at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                </Box>
                {e.preview && <Typography sx={{ fontSize: 12.5, color: c.text2, mb: e.err ? 0.5 : 0 }}>{e.preview}…</Typography>}
                {!e.ok && e.err && <Typography sx={{ fontSize: 12, color: c.hot, fontWeight: 600 }}>שגיאה: {e.err}{explain(e.err)}</Typography>}
                {e.delivery && <Typography sx={{ fontSize: 12, color: e.delivery.startsWith('✓') ? c.accent : e.delivery.startsWith('✗') ? c.hot : c.text3, fontWeight: 500, mt: 0.25 }}>מסירה: {e.delivery}</Typography>}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
