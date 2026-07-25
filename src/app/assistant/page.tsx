'use client';

/**
 * "Ziki" — the in-app AI assistant. Business owners and staff ask in plain
 * Hebrew ("איך מוסיפים ספר?") and get step-by-step guidance for THIS system.
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, TextField, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

interface Msg { role: 'user' | 'assistant'; content: string }

const QUICK = ['איך מוסיפים איש צוות?', 'איך מגדירים שעות שיא?', 'למה לקוח לא קיבל הודעה?', 'איך משנים את עיצוב האפליקציה?'];

export default function AssistantPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: 'היי! אני זיקי 🤖 העוזר של המערכת. שאלו אותי כל דבר — "איך מוסיפים ספר?", "איך מפעילים תקנון?", "למה הודעה לא נשלחה?" — ואסביר צעד-צעד.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
      const d = await res.json();
      setMsgs((p) => [...p, { role: 'assistant', content: d.reply || 'שגיאה — נסו שוב' }]);
    } catch {
      setMsgs((p) => [...p, { role: 'assistant', content: 'שגיאת רשת — נסו שוב' }]);
    } finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.canvas }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.canvas, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20, bgcolor: c.chrome, backdropFilter: 'blur(20px)' }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: c.text }}>🤖 העוזר החכם</Typography>
        <Box sx={{ width: 90 }} />
      </Box>

      <Box sx={{ flex: 1, maxWidth: 680, width: '100%', mx: 'auto', px: 2, py: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {msgs.map((m, i) => (
          <Box key={i} sx={{ alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end', maxWidth: '85%', bgcolor: m.role === 'user' ? c.accent : c.surface1, color: m.role === 'user' ? '#fff' : c.text, borderRadius: 4, px: 2, py: 1.25, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', border: m.role === 'user' ? 'none' : `1px solid ${c.border2}` }}>{m.content}</Box>
        ))}
        {busy && <Box sx={{ alignSelf: 'flex-end', bgcolor: c.card, borderRadius: 4, px: 2, py: 1.25 }}><CircularProgress size={16} sx={{ color: c.accent }} /></Box>}
        {msgs.length === 1 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {QUICK.map((q) => <Box key={q} onClick={() => send(q)} sx={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: c.accent, border: `1px solid ${c.accent}44`, borderRadius: 99, px: 1.5, py: 0.6, '&:hover': { bgcolor: c.accentDim } }}>{q}</Box>)}
          </Box>
        )}
        <div ref={endRef} />
      </Box>

      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: c.canvas, borderTop: `1px solid ${c.border}`, p: 1.5 }}>
        <Box sx={{ maxWidth: 680, mx: 'auto', display: 'flex', gap: 1 }}>
          <TextField fullWidth size="small" placeholder="שאלו אותי איך עושים משהו במערכת…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <Button onClick={() => send()} disabled={busy || !input.trim()} variant="contained" sx={{ bgcolor: c.accent, fontWeight: 600, borderRadius: 4, px: 3 }}>שלח</Button>
        </Box>
      </Box>
    </Box>
  );
}
