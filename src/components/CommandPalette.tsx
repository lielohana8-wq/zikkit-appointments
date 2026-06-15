'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, TextField, Dialog } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, getCustomers, type Booking, type Customer } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const PAGES = [
  { label: 'יומן תורים', path: '/calendar', icon: '📅', keywords: 'יומן תור לוח calendar' },
  { label: 'לקוחות', path: '/customers', icon: '👥', keywords: 'לקוח לקוחות customers' },
  { label: 'דף הזמנות', path: '/booking-page', icon: '🔗', keywords: 'הזמנה דף booking' },
  { label: 'מחירון', path: '/services', icon: '📋', keywords: 'מחיר שירות services' },
  { label: 'דוחות', path: '/reports', icon: '📊', keywords: 'דוח הכנסה reports' },
  { label: 'רווחיות', path: '/expenses', icon: '💰', keywords: 'הוצאה רווח expenses' },
  { label: 'קבלות', path: '/documents', icon: '🧾', keywords: 'קבלה הצעת מחיר' },
  { label: 'ייצוא', path: '/export-data', icon: '📤', keywords: 'ייצוא csv export' },
  { label: 'מבצעים', path: '/promos', icon: '🎟️', keywords: 'מבצע קופון נאמנות' },
  { label: 'ביקורות', path: '/reviews', icon: '⭐', keywords: 'ביקורת דירוג review' },
  { label: 'אוטומציות', path: '/automations', icon: '⚡', keywords: 'אוטומציה sms תזכורת' },
  { label: 'יועץ AI', path: '/ai-studio', icon: '📈', keywords: 'ai יועץ שיווק נחיתה' },
  { label: 'דנה', path: '/setup', icon: '📞', keywords: 'דנה טלפון מענה' },
  { label: 'צוות', path: '/team', icon: '🧑‍🤝‍🧑', keywords: 'צוות עובד team' },
  { label: 'שעות', path: '/hours', icon: '🕐', keywords: 'שעות פעילות hours' },
  { label: 'גלריה', path: '/gallery', icon: '🖼️', keywords: 'גלריה תמונה gallery' },
  { label: 'קורסים', path: '/courses', icon: '🎓', keywords: 'קורס מוצר course' },
  { label: 'הגדרות', path: '/settings', icon: '⚙️', keywords: 'הגדרה settings' },
];

export function CommandPalette() {
  const router = useRouter();
  const { bizId } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load data when opened
  const loadData = useCallback(async () => {
    if (!bizId) return;
    try {
      setCustomers(await getCustomers(bizId));
      setBookings(await getBookings(bizId));
    } catch { /* ignore */ }
  }, [bizId]);

  useEffect(() => {
    if (open) { loadData(); setTimeout(() => inputRef.current?.focus(), 100); }
    else setQuery('');
  }, [open, loadData]);

  const go = (path: string) => { setOpen(false); router.push(path); };

  const q = query.trim().toLowerCase();
  const matchedPages = q ? PAGES.filter((p) => p.label.toLowerCase().includes(q) || p.keywords.toLowerCase().includes(q)).slice(0, 5) : PAGES.slice(0, 6);
  const matchedCustomers = q ? customers.filter((cu) => cu.name?.toLowerCase().includes(q) || cu.phone?.includes(q)).slice(0, 4) : [];
  const matchedBookings = q ? bookings.filter((b) => b.customerName?.toLowerCase().includes(q) || b.service?.toLowerCase().includes(q)).slice(0, 4) : [];

  return (
    <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 5, width: '100%', maxWidth: 520, position: 'fixed', top: 80, m: 0, overflow: 'hidden' } }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${c.border}` }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="חיפוש לקוחות, תורים, עמודים..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{ startAdornment: <Box sx={{ mr: 1, fontSize: 18 }}>🔍</Box> }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, fontSize: 16 } }}
        />
      </Box>

      <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 1.5 }}>
        {matchedCustomers.length > 0 && (
          <>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text3, px: 1.5, py: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>לקוחות</Typography>
            {matchedCustomers.map((cu) => (
              <Box key={cu.id} onClick={() => go('/customers')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: 2.5, '&:hover': { bgcolor: c.surface2 } }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{cu.name?.[0] || '?'}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{cu.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: c.text3 }}>{cu.phone}</Typography>
                </Box>
                <Typography sx={{ fontSize: 11, color: c.text3 }}>{cu.visits} ביקורים</Typography>
              </Box>
            ))}
          </>
        )}

        {matchedBookings.length > 0 && (
          <>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text3, px: 1.5, py: 0.75, mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>תורים</Typography>
            {matchedBookings.map((b) => (
              <Box key={b.id} onClick={() => go('/calendar')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: 2.5, '&:hover': { bgcolor: c.surface2 } }}>
                <Box sx={{ fontSize: 18 }}>📅</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{b.customerName}</Typography>
                  <Typography sx={{ fontSize: 12, color: c.text3 }}>{b.service || 'טיפול'} · {b.date} {b.time}</Typography>
                </Box>
              </Box>
            ))}
          </>
        )}

        {matchedPages.length > 0 && (
          <>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text3, px: 1.5, py: 0.75, mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{q ? 'עמודים' : 'מעבר מהיר'}</Typography>
            {matchedPages.map((p) => (
              <Box key={p.path} onClick={() => go(p.path)} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, borderRadius: 2.5, '&:hover': { bgcolor: c.surface2 } }}>
                <Box sx={{ fontSize: 18, width: 28, textAlign: 'center' }}>{p.icon}</Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{p.label}</Typography>
              </Box>
            ))}
          </>
        )}

        {q && matchedPages.length === 0 && matchedCustomers.length === 0 && matchedBookings.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ fontSize: 14, color: c.text3 }}>לא נמצאו תוצאות עבור &quot;{query}&quot;</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${c.border}`, display: 'flex', gap: 2, bgcolor: c.surface2 }}>
        <Typography sx={{ fontSize: 11, color: c.text3 }}><kbd style={{ background: c.surface4, padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>⌘K</kbd> פתח/סגור</Typography>
        <Typography sx={{ fontSize: 11, color: c.text3 }}><kbd style={{ background: c.surface4, padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>ESC</kbd> סגור</Typography>
      </Box>
    </Dialog>
  );
}
