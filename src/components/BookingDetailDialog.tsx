'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, MenuItem } from '@mui/material';
import { updateBooking, deleteBooking, getTeam, loadBiz, type Booking, type TeamMember } from '@/lib/bizdata';
import { waLink, messageTemplates } from '@/lib/messaging';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

interface Props {
  booking: Booking | null;
  bizId: string | null;
  onClose: () => void;
  onChanged?: () => void;   // called after save/cancel so the parent can reload
}

/**
 * Unified appointment popup — shows details, allows editing time/date/staff,
 * quick actions (call / whatsapp), and cancellation. Usable from anywhere
 * (calendar, dashboard "next appointment", etc).
 */
export function BookingDetailDialog({ booking, bizId, onClose, onChanged }: Props) {
  const { showToast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [bizName, setBizName] = useState('העסק');
  const [showMsgMenu, setShowMsgMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', time: '', staff: '', service: '', notes: '', duration: 30 });

  useEffect(() => {
    if (booking) {
      setForm({
        date: booking.date, time: booking.time, staff: booking.staff || '',
        service: booking.service || '', notes: booking.notes || '', duration: booking.duration || 30,
      });
      setEditing(false);
    }
  }, [booking]);

  useEffect(() => {
    if (bizId && booking) {
      getTeam(bizId).then(setTeam).catch(() => {});
      loadBiz(bizId).then((biz) => {
        const name = ((biz?.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק';
        setBizName(name);
      }).catch(() => {});
    }
  }, [bizId, booking]);

  const save = async () => {
    if (!bizId || !booking) return;
    setSaving(true);
    try {
      await updateBooking(bizId, booking.id, {
        date: form.date, time: form.time, staff: form.staff || null,
        service: form.service, notes: form.notes, duration: form.duration,
      });
      showToast('התור עודכן', 'success');
      onChanged?.();
      onClose();
    } catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const cancel = async () => {
    if (!bizId || !booking) return;
    if (!confirm('לבטל את התור?')) return;
    setSaving(true);
    try {
      await deleteBooking(bizId, booking.id);
      showToast('התור בוטל', 'success');
      onChanged?.();
      onClose();
    } catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const setStatus = async (status: string) => {
    if (!bizId || !booking) return;
    setSaving(true);
    try {
      await updateBooking(bizId, booking.id, { status });
      showToast(status === 'completed' ? 'התור סומן כהושלם' : status === 'no_show' ? 'סומן: לא הגיע' : 'סטטוס עודכן', 'success');
      onChanged?.();
      onClose();
    } catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  if (!booking) return null;

  return (
    <Dialog scroll="body" open={!!booking} onClose={onClose} PaperProps={{ sx: { borderRadius: 8, maxWidth: 420, width: '100%' } }}>
      {/* Header — editorial */}
      <Box sx={{ bgcolor: c.accent, color: '#fff', p: 3, position: 'relative' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
          {booking.source === 'dana' ? 'נקבע ע״י דנה' : booking.source === 'online' ? 'הזמנה אונליין' : 'תור'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
          <Typography sx={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.9 }}>{booking.time}</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 600, opacity: 0.9 }}>{booking.date} · {booking.duration} דק׳</Typography>
        </Box>
        <Typography sx={{ fontSize: 24, fontWeight: 800, mt: 1.5, letterSpacing: '-0.02em' }}>{booking.customerName}</Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        {!editing ? (
          <>
            {/* Details */}
            <DetailRow label="שירות" value={booking.service || 'טיפול'} />
            {booking.staff && <DetailRow label="חבר צוות" value={booking.staff} />}
            {booking.customerPhone && <DetailRow label="טלפון" value={booking.customerPhone} />}
            {booking.price ? <DetailRow label="מחיר" value={`₪${booking.price}`} /> : null}
            {booking.notes && <DetailRow label="הערות" value={booking.notes} />}

            {/* Pending approval */}
            {booking.status === 'pending' && (
              <Box sx={{ bgcolor: '#FEF9EC', border: '1px solid #F5D98F', borderRadius: 2, p: 1.75, mt: 2 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#92600A', mb: 1 }}>⏳ התור ממתין לאישור שלך</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button onClick={() => setStatus('confirmed')} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 800, bgcolor: '#16A34A', '&:hover': { bgcolor: '#15803D' } }}>✓ אשר תור</Button>
                  <Button onClick={() => setStatus('cancelled')} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, color: c.hot, borderColor: c.border2, whiteSpace: 'nowrap' }}>דחה</Button>
                </Box>
                {booking.customerPhone && <Typography sx={{ fontSize: 11.5, color: '#92600A', mt: 1 }}>💡 אחרי האישור — עדכן את הלקוח דרך &quot;שלח הודעה&quot;</Typography>}
              </Box>
            )}

            {/* Quick actions */}
            {booking.customerPhone && (
              <>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
                  <Button href={`tel:${booking.customerPhone}`} fullWidth variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>📞 התקשר</Button>
                  <Button onClick={() => setShowMsgMenu(!showMsgMenu)} fullWidth variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, color: '#25D366', borderColor: c.border2 }}>💬 שלח הודעה</Button>
                </Box>

                {/* WhatsApp message templates */}
                {showMsgMenu && (() => {
                  const manageUrl = (booking as { manageToken?: string }).manageToken && bizId
                    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/manage/${bizId}/${(booking as { manageToken?: string }).manageToken}`
                    : undefined;
                  const ctx = { bizName, customerName: booking.customerName, service: booking.service, date: booking.date, time: booking.time, manageUrl };
                  const msgs: [string, string][] = [
                    ['✅ אישור תור', messageTemplates.confirmation(ctx)],
                    ['⏰ תזכורת', messageTemplates.reminder(ctx)],
                    ['🚗 בדרך אליך', messageTemplates.onTheWay(ctx)],
                    ['🙏 תודה + ביקורת', messageTemplates.thankYou(ctx)],
                  ];
                  return (
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, bgcolor: c.surface2, borderRadius: 2, p: 1.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text3, mb: 0.25 }}>שלח בוואטסאפ — לחיצה פותחת הודעה מוכנה</Typography>
                      {msgs.map(([label, msg]) => (
                        <Button key={label} href={waLink(booking.customerPhone!, msg)} target="_blank" onClick={() => setShowMsgMenu(false)}
                          sx={{ justifyContent: 'flex-start', borderRadius: 1.5, fontWeight: 600, fontSize: 13.5, color: c.text, bgcolor: c.surface1, py: 1, px: 1.5, '&:hover': { bgcolor: c.surface3 } }}>{label}</Button>
                      ))}
                    </Box>
                  );
                })()}
              </>
            )}

            {/* Status */}
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: c.text3, mt: 2.5, mb: 1, textTransform: 'uppercase', letterSpacing: '0.1em' }}>סטטוס</Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {([['confirmed', 'מאושר', c.accent], ['completed', 'הושלם', c.green], ['no_show', 'לא הגיע', c.hot]] as [string, string, string][]).map(([st, label, col]) => (
                <Button key={st} onClick={() => setStatus(st)} disabled={saving} sx={{ flex: 1, borderRadius: 2, fontWeight: 700, fontSize: 13, py: 1, bgcolor: booking.status === st ? col : c.surface3, color: booking.status === st ? '#fff' : c.text2, '&:hover': { bgcolor: booking.status === st ? col : c.surface4 } }}>{label}</Button>
              ))}
            </Box>

            {/* Edit / cancel */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
              <Button onClick={cancel} disabled={saving} sx={{ flex: 1, borderRadius: 2, fontWeight: 700, color: c.hot, '&:hover': { bgcolor: c.hotDim } }}>בטל תור</Button>
              <Button onClick={() => setEditing(true)} variant="contained" sx={{ flex: 2, borderRadius: 2, fontWeight: 700 }}>ערוך תור</Button>
            </Box>
          </>
        ) : (
          <>
            {/* Edit form */}
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>עריכת תור</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <TextField label="תאריך" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} size="small" />
              <TextField label="שעה" type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} size="small" />
            </Box>
            <TextField fullWidth label="שירות" value={form.service} onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))} sx={{ mb: 2 }} size="small" />
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <TextField select label="משך" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: Number(e.target.value) }))} sx={{ flex: 1 }} size="small">
                {[15, 30, 45, 60, 90, 120, 180].map((d) => <MenuItem key={d} value={d}>{d} דק׳</MenuItem>)}
              </TextField>
              {team.length > 0 && (
                <TextField select label="חבר צוות" value={form.staff} onChange={(e) => setForm((p) => ({ ...p, staff: e.target.value }))} sx={{ flex: 1 }} size="small">
                  <MenuItem value="">ללא</MenuItem>
                  {team.map((m) => <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>)}
                </TextField>
              )}
            </Box>
            <TextField fullWidth label="הערות" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} multiline rows={2} sx={{ mb: 2.5 }} size="small" />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setEditing(false)} sx={{ flex: 1, borderRadius: 2, fontWeight: 700, color: c.text2 }}>חזרה</Button>
              <Button onClick={save} variant="contained" disabled={saving} sx={{ flex: 2, borderRadius: 2, fontWeight: 700 }}>{saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור שינויים'}</Button>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', py: 1.25, borderBottom: `1px solid ${c.border2}` }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: c.text, textAlign: 'left', maxWidth: '60%' }}>{value}</Typography>
    </Box>
  );
}
