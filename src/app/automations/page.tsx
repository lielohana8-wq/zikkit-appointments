'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Switch, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getAutomations, saveAutomations, type AutomationSettings } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

export default function AutomationsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [a, setA] = useState<AutomationSettings | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setA(await getAutomations(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof AutomationSettings>(k: K, v: AutomationSettings[K]) => setA((p) => p ? { ...p, [k]: v } : p);

  const save = async () => {
    if (!bizId || !a) return;
    setSaving(true);
    try { await saveAutomations(bizId, a); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };

  if (loading || dataLoading || !a) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const Row = ({ icon, title, desc, on, onToggle, children }: { icon: string; title: string; desc: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) => (
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${on ? c.accent : c.border}`, borderRadius: 3, p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ fontSize: 26 }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{title}</Typography>
          <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{desc}</Typography>
        </Box>
        <Switch checked={on} onChange={(e) => onToggle(e.target.checked)} />
      </Box>
      {on && children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1, position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>אוטומציות</Typography>
        <Button onClick={save} variant="contained" disabled={saving} sx={{ borderRadius: 99, fontWeight: 700 }}>{saved ? '✓' : saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'שמור'}</Button>
      </Box>

      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <Box sx={{ bgcolor: c.accentDim, borderRadius: 3, p: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 13, color: c.text2, lineHeight: 1.6 }}>
            ⚡ אוטומציות עובדות <b>בנפרד מדנה</b>. גם בלי מענה טלפוני, המערכת תשלח אישורים, תזכורות ובקשות ביקורת ללקוחות אוטומטית.
          </Typography>
        </Box>

        {/* Channel */}
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, boxShadow: c.shadowSm, p: 2.5, mb: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.text, mb: 1.5 }}>📡 ערוץ שליחה</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box onClick={() => set('channel', 'sms')} sx={{ flex: 1, cursor: 'pointer', textAlign: 'center', py: 2, borderRadius: 2.5, bgcolor: a.channel === 'sms' ? c.accentDim : c.surface2, border: `2px solid ${a.channel === 'sms' ? c.accent : c.border}` }}>
              <Box sx={{ fontSize: 26 }}>💬</Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>SMS</Typography>
              <Typography sx={{ fontSize: 11, color: c.text3 }}>דורש Twilio</Typography>
            </Box>
            <Box onClick={() => set('channel', 'whatsapp')} sx={{ flex: 1, cursor: 'pointer', textAlign: 'center', py: 2, borderRadius: 2.5, bgcolor: a.channel === 'whatsapp' ? c.accentDim : c.surface2, border: `2px solid ${a.channel === 'whatsapp' ? c.accent : c.border}` }}>
              <Box sx={{ fontSize: 26 }}>📱</Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>וואטסאפ</Typography>
              <Typography sx={{ fontSize: 11, color: c.text3 }}>דורש חיבור</Typography>
            </Box>
          </Box>
          {a.channel === 'whatsapp' && (
            <Box sx={{ mt: 2 }}>
              <TextField fullWidth size="small" label="מספר הוואטסאפ העסקי שלך" value={a.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} placeholder="0501234567" />
              <Box sx={{ bgcolor: '#FEF3C7', borderRadius: 2, p: 1.5, mt: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                  ⚠️ חיבור וואטסאפ דורש הגדרה חד-פעמית מול WhatsApp Business. צור קשר לתמיכה כדי לחבר את המספר שלך.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 2 }}>הודעות אוטומטיות</Typography>

        <Row icon="✅" title="אישור בעת קביעת תור" desc="הלקוח מקבל הודעה מיד כשנקבע תור" on={a.confirmOnBooking} onToggle={(v) => set('confirmOnBooking', v)}>
          <TextField fullWidth size="small" label="טקסט מותאם (אופציונלי)" value={a.customConfirmText} onChange={(e) => set('customConfirmText', e.target.value)} placeholder="התור שלך אושר! נתראה" multiline rows={2} />
        </Row>

        <Row icon="⏰" title="תזכורת לפני התור" desc="הלקוח מקבל תזכורת לפני המועד" on={a.reminderEnabled} onToggle={(v) => set('reminderEnabled', v)}>
          <TextField select fullWidth size="small" label="כמה זמן לפני?" value={a.reminderHoursBefore} onChange={(e) => set('reminderHoursBefore', Number(e.target.value))} sx={{ mb: 1.5 }}>
            {[2, 3, 6, 12, 24, 48].map((h) => <MenuItem key={h} value={h}>{h} שעות לפני</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="טקסט תזכורת (אופציונלי)" value={a.customReminderText} onChange={(e) => set('customReminderText', e.target.value)} placeholder="תזכורת: יש לך תור מחר" multiline rows={2} />
        </Row>

        <Row icon="⭐" title="בקשת ביקורת" desc="אחרי התור, בקש מהלקוח לדרג" on={a.reviewRequest} onToggle={(v) => set('reviewRequest', v)}>
          <TextField fullWidth size="small" label="קישור לביקורת (Google/Facebook)" value={a.reviewLink} onChange={(e) => set('reviewLink', e.target.value)} placeholder="https://g.page/..." />
        </Row>

        <Row icon="🔄" title="החזרת לקוחות" desc="לקוח שלא חזר זמן רב — הודעת חזרה" on={a.winbackEnabled} onToggle={(v) => set('winbackEnabled', v)}>
          <TextField select fullWidth size="small" label="אחרי כמה ימים?" value={a.winbackDays} onChange={(e) => set('winbackDays', Number(e.target.value))}>
            {[30, 45, 60, 90, 120].map((d) => <MenuItem key={d} value={d}>{d} ימים</MenuItem>)}
          </TextField>
        </Row>

        <Row icon="🎂" title="ברכת יום הולדת" desc="הודעת ברכה אוטומטית ללקוחות" on={a.birthdayGreeting} onToggle={(v) => set('birthdayGreeting', v)} />

        <Button onClick={save} variant="contained" fullWidth disabled={saving} sx={{ py: 1.75, borderRadius: 3, fontWeight: 800, mt: 1 }}>
          {saved ? '✓ נשמר!' : saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור אוטומציות'}
        </Button>
      </Box>
    </Box>
  );
}
