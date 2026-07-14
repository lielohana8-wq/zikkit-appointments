'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField , Dialog } from '@mui/material';
import { useParams } from 'next/navigation';
import { track, Events } from '@/lib/analytics';

interface Service { id: string; name: string; duration: number; price?: string | number; priceFrom?: boolean; description?: string; category?: string; }
interface Branding { logo: string; banner: string; brandColor: string; headerStyle?: string; welcomeText: string; thankYouMessage?: string; cancellationNote?: string; address?: string; phone?: string; instagram?: string; whatsapp?: string; showPrices: boolean; showDuration?: boolean; requireEmail?: boolean; requirePhone?: boolean; gallery?: string[]; galleryTitle?: string; announcement?: string; announcementOn?: boolean; popupTitle?: string; popupText?: string; popupOn?: boolean; promoText?: string; promoOn?: boolean; aboutText?: string; tiktok?: string; facebook?: string; showReviews?: boolean; depositOn?: boolean; depositAmount?: number; depositPercent?: number; slotInterval?: number; slotMode?: string; bookingWindowDays?: number; approvalMode?: string; policyOn?: boolean; policyText?: string; requireRegistration?: boolean; otpOn?: boolean; firstFreeOn?: boolean; iconV?: number; theme?: string; brandColor2?: string; nameFont?: string; bandImageOn?: boolean; benefitOn?: boolean; benefitText?: string; benefitEvery?: number; peakOn?: boolean; peakRules?: Array<{ days: number[]; from: string; to: string; extra: number }>; products?: Array<{ id?: string; name: string; price?: number; photo?: string; description?: string }>; }
interface Staff { id: string; name: string; role: string; photo: string; services: string[]; }
interface Review { customerName: string; rating: number; text: string; date: string; }
interface BizInfo {
  enabled: boolean;
  reason?: string;
  error?: string;
  businessName: string;
  services: Service[];
  stations: number; staffCount?: number;
  team?: Staff[];
  reviews?: Review[];
  hours: Record<number, { open: boolean; start: string; end: string }> | null;
  blockedDates?: string[];
  bookings: Array<{ date: string; time: string; duration: number; staff?: string | null; status?: string }>;
  branding: Branding;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// Lighten/darken a hex color
function shade(hex: string, percent: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (n & 0xff) + percent));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export default function PublicBookingPage() {
  const params = useParams();
  const bizId = params.bizId as string;
  const [info, setInfo] = useState<BizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<'service' | 'staff' | 'slot' | 'details' | 'done' | 'waitlist' | 'waitlisted'>('service');
  const [tab, setTab] = useState<'home' | 'book' | 'gallery' | 'info' | 'profile'>('home');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBusy, setRegBusy] = useState(false);
  const [regErr, setRegErr] = useState('');

  const [me, setMe] = useState<{ name: string; phone: string } | null>(null);

  // ── The business becomes the app: dynamic manifest, icon, title, theme ──
  useEffect(() => {
    if (!info || !bizId) return;
    document.title = info.businessName || 'הזמנת תור';
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
      el.href = href;
    };
    setLink('manifest', `/api/biz-manifest?bizId=${bizId}&v=${info.branding.iconV || 1}`);
    setLink('apple-touch-icon', `/api/biz-icon?bizId=${bizId}&v=${info.branding.iconV || 1}`);
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    setMeta('theme-color', accent);
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-title', info.businessName || 'תורים');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, bizId]);

  // ── Recognize a returning customer (saved on this device) ──
  useEffect(() => {
    if (!bizId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`zk_cust_${bizId}`) || 'null');
      if (saved?.phone) {
        setMe(saved);
        fetch('/api/public-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, action: 'find', phone: saved.phone }) })
          .then((r) => r.json()).then((d) => { if (d.success) { setMyUpcoming(d.bookings || []); setMyVisits(d.visits || 0); } }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, [bizId]);
  const [myUpcoming, setMyUpcoming] = useState<Array<{ service: string; date: string; time: string; token: string }>>([]);
  const [myVisits, setMyVisits] = useState(0);
  useEffect(() => {
    if (me && !form.name && !form.phone) setForm((p) => ({ ...p, name: me.name, phone: me.phone }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const [pushMsg, setPushMsg] = useState('');
  const enablePush = async () => {
    setPushMsg('');
    try {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) { setPushMsg('❌ המערכת עוד לא הוגדרה להתראות (מפתח חסר)'); return; }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushMsg('❌ הדפדפן הזה לא תומך — באייפון: שמרו את האפליקציה למסך הבית ופתחו מהאייקון'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushMsg('❌ ההרשאה נדחתה — הגדרות > התראות > אפשרו לאפליקציה'); return; }
      const b64 = vapid.replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (b64.length % 4)) % 4);
      const rawKey = Uint8Array.from(atob(b64 + pad), (ch) => ch.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: rawKey });
      const rr = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, phone: me?.phone || '', sub }) });
      const dj = await rr.json();
      setPushMsg(dj.ok ? '✅ ההתראות פעילות! תקבלו עדכון על כל תור' : '❌ השמירה נכשלה — נסו שוב');
    } catch (e) {
      setPushMsg('❌ ' + String((e as Error)?.message || 'שגיאה').slice(0, 90));
    }
  };

  // Web-push, fully automatic: already-granted devices subscribe silently on
  // load; new devices get the permission prompt on their FIRST natural tap
  // anywhere in the app (Apple requires a user gesture for the prompt).
  useEffect(() => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!me || !vapid || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const doSubscribe = async () => {
      try {
      const b64 = vapid.replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (b64.length % 4)) % 4);
      const rawKey = Uint8Array.from(atob(b64 + pad), (ch) => ch.charCodeAt(0));
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: rawKey });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, phone: me?.phone || '', sub }) });
      } catch { /* best effort */ }
    };
    if (Notification.permission === 'granted') { doSubscribe(); return; }
    if (Notification.permission === 'denied') return;
    const onFirstTap = () => {
      window.removeEventListener('pointerdown', onFirstTap);
      Notification.requestPermission().then((perm) => { if (perm === 'granted') doSubscribe(); }).catch(() => {});
    };
    window.addEventListener('pointerdown', onFirstTap, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstTap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, bizId]);

  const [rebookMsg, setRebookMsg] = useState('');
  const rebook = async (weeks: number) => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setRebookMsg('⏳ בודק זמינות…');
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + weeks * 7);
      const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const res = await fetch('/api/public-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, booking: {
          customerName: form.name, customerPhone: form.phone,
          service: selectedService.name, duration: selectedService.duration,
          date: newDate, time: selectedTime,
          staff: selectedStaff?.name || null,
          price: typeof selectedService.price === 'string' ? parseInt(selectedService.price) || 0 : selectedService.price || 0,
        } }),
      });
      const dj = await res.json();
      const dateHe = newDate.split('-').reverse().slice(0, 2).join('.');
      setRebookMsg(res.ok && !dj.error ? `✅ נקבע גם ל-${dateHe} ב-${selectedTime}!` : `❌ ${dj.error || 'השעה תפוסה בתאריך הזה'}`);
    } catch { setRebookMsg('❌ שגיאה — נסו שוב'); }
  };

  const [annClosed, setAnnClosed] = useState(false);
  useEffect(() => {
    try {
      if (bizId && info?.branding?.announcement && localStorage.getItem('zk_ann_' + bizId) === String(info.branding.announcement)) setAnnClosed(true);
    } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, info?.branding?.announcement]);
  const [recurWeeks, setRecurWeeks] = useState(3);
  const [recurCount] = useState(3);
  const [recurBusy, setRecurBusy] = useState(false);
  const [recurDone, setRecurDone] = useState('');
  const bookRecurring = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setRecurBusy(true);
    try {
      const res = await fetch('/api/public-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, action: 'recur', recur: { service: selectedService.name, staff: (selectedStaff as unknown as { name?: string })?.name || '', date: selectedDate, time: selectedTime, name: me?.name || '', phone: me?.phone || '', weeks: recurWeeks, count: recurCount, price: staffPriceFor(selectedService.name, selectedService.price), duration: selectedService.duration || 30 } }) });
      const d = await res.json();
      if (d.ok && d.created?.length) setRecurDone(`✅ נקבעו ${d.created.length} תורים קבועים! הקרוב: ${d.created[0]}${d.skipped?.length ? ` (דולגו ${d.skipped.length} — תפוסים)` : ''}`);
      else setRecurDone('לא הצלחנו לקבוע — נסו מהאפליקציה');
    } catch { setRecurDone('שגיאה — נסו שוב'); }
    finally { setRecurBusy(false); }
  };
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const registerNow = async () => {
    setRegBusy(true); setRegErr('');
    try {
      if (info?.branding?.otpOn && !otpSent) {
        const rs = await fetch('/api/public-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, action: 'otp-send', phone: regPhone }) });
        const ds = await rs.json();
        if (!ds.success) { setRegErr(ds.error || 'שליחת הקוד נכשלה'); return; }
        setOtpSent(true); return;
      }
      const res = await fetch('/api/public-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, action: 'register', name: regName.trim(), phone: regPhone, code: otpCode }) });
      const d = await res.json();
      if (!d.success) { setRegErr(d.error || 'שגיאה'); return; }
      const meObj = { name: (d.knownName as string) || regName.trim(), phone: regPhone };
      try { localStorage.setItem(`zk_cust_${bizId}`, JSON.stringify(meObj)); } catch { /* ignore */ }
      setMe(meObj);
      setTab('home');
      fetch('/api/public-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, action: 'find', phone: regPhone }) }).then((r) => r.json()).then((dd) => { if (dd.success) { setMyUpcoming(dd.bookings || []); setMyVisits(dd.visits || 0); } }).catch(() => {});
    } catch { setRegErr('שגיאה — נסו שוב'); } finally { setRegBusy(false); }
  };

  const [policyOk, setPolicyOk] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findPhone, setFindPhone] = useState('');
  const [findBusy, setFindBusy] = useState(false);
  const [findErr, setFindErr] = useState('');
  const [findResults, setFindResults] = useState<Array<{ service: string; date: string; time: string; token: string }> | null>(null);

  const [findOtpSent, setFindOtpSent] = useState(false);
  const [findCode, setFindCode] = useState('');
  const findMyBookings = async () => {
    setFindBusy(true); setFindErr(''); setFindResults(null);
    try {
      if (info?.branding?.otpOn && !findOtpSent) {
        const rs = await fetch('/api/public-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, action: 'otp-send', phone: findPhone }) });
        const ds = await rs.json();
        if (!ds.success) { setFindErr(ds.error || 'שליחת הקוד נכשלה'); setFindBusy(false); return; }
        setFindOtpSent(true); setFindBusy(false); return;
      }
      const res = await fetch('/api/public-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, action: 'find', phone: findPhone, code: findCode }),
      });
      const data = await res.json();
      if (data.success) setFindResults(data.bookings || []);
      else setFindErr(data.error || 'שגיאה בחיפוש');
    } catch { setFindErr('שגיאה בחיפוש — נסו שוב'); } finally { setFindBusy(false); }
  };
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [booking, setBooking] = useState(false);
  const [wlNote, setWlNote] = useState('');

  const submitWaitlist = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setBooking(true);
    try {
      const res = await fetch('/api/public-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizId, action: 'waitlist',
          waitlist: {
            name: form.name, phone: form.phone,
            service: selectedService?.name || '', staff: selectedStaff?.name || '',
            preferredDate: selectedDate || '', note: wlNote,
          },
        }),
      });
      const data = await res.json();
      if (data.success) { track(Events.WAITLIST_JOINED, { bizId }); setStage('waitlisted'); }
      else alert(data.error || 'שגיאה');
    } catch { alert('שגיאה'); } finally { setBooking(false); }
  };
  const [manageToken, setManageToken] = useState('');
  const [showPopup, setShowPopup] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!bizId) return;
    fetch(`/api/public-booking?bizId=${bizId}`)
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .finally(() => setLoading(false));
  }, [bizId]);

  const accent = info?.branding?.brandColor || '#9333EA';
  const mustRegister = !!info && info.branding.requireRegistration !== false && !me;
  const accentLight = shade(accent, 60);
  const c2 = info?.branding?.brandColor2 || accent;
  const nameFont = info?.branding?.nameFont === 'modern' ? "'Heebo', sans-serif" : "'Playfair Display', 'Heebo', serif";
  const bandImg = (info?.branding?.bandImageOn && info?.branding?.banner) ? info.branding.banner : '';
  const THEMES: Record<string, { bandBg: string; bandText: string; bandSub: string; pageBase: string; navBg: string; navBorder: string; navActive: string; navIdle: string }> = {
    dark: { bandBg: 'linear-gradient(180deg,#0A0710 0%,#150F22 100%)', bandText: '#fff', bandSub: 'rgba(255,255,255,0.62)', pageBase: 'linear-gradient(180deg,#FAF9F7 0%,#F3F1EE 100%)', navBg: 'rgba(12,9,18,0.88)', navBorder: 'rgba(255,255,255,0.12)', navActive: '#fff', navIdle: 'rgba(255,255,255,0.48)' },
    light: { bandBg: 'linear-gradient(180deg,#FFFFFF 0%,#F6F4FA 100%)', bandText: '#16120E', bandSub: '#8A837B', pageBase: '#FFFFFF', navBg: 'rgba(255,255,255,0.9)', navBorder: 'rgba(16,24,40,0.08)', navActive: accent, navIdle: '#A8A29E' },
    soft: { bandBg: `linear-gradient(160deg, ${accent}26 0%, ${c2}33 100%), #FDFAF6`, bandText: '#241E18', bandSub: '#8A837B', pageBase: '#FBF7F2', navBg: 'rgba(255,255,255,0.92)', navBorder: 'rgba(16,24,40,0.07)', navActive: accent, navIdle: '#A8A29E' },
    bold: { bandBg: `linear-gradient(140deg, ${accent} 0%, ${c2} 100%)`, bandText: '#fff', bandSub: 'rgba(255,255,255,0.78)', pageBase: 'linear-gradient(180deg,#FAF9FE 0%,#F2EFF8 100%)', navBg: 'rgba(20,14,30,0.9)', navBorder: 'rgba(255,255,255,0.14)', navActive: '#fff', navIdle: 'rgba(255,255,255,0.5)' },
  };
  const th = THEMES[(info?.branding?.theme as string) || 'dark'] || THEMES.dark;
  const peakExtraFor = (date: string, time: string) => {
    if (!info?.branding?.peakOn || !date || !time) return 0;
    const dow = new Date(date + 'T00:00:00').getDay();
    const tm = (x: string) => { const [h, m] = x.split(':').map(Number); return h * 60 + (m || 0); };
    const t = tm(time);
    return (info.branding.peakRules || []).reduce((acc, r) => ((r.days || []).includes(dow) && t >= tm(r.from || '00:00') && t < tm(r.to || '23:59') ? acc + (Number(r.extra) || 0) : acc), 0);
  };
  const staffPriceFor = (svcName: string, svcPrice: unknown): number => {
    const sel = selectedStaff as unknown as { name?: string } | null;
    const m = sel ? ((info?.team || []).find((t) => t.name === sel.name) as unknown as { prices?: Record<string, number> } | undefined) : undefined;
    return Number(m?.prices?.[svcName] ?? (svcPrice as number)) || 0;
  };
  const bandText = bandImg ? '#fff' : th.bandText;
  const bandSub = bandImg ? 'rgba(255,255,255,0.75)' : th.bandSub;
  const accentDark = shade(accent, -30);
  const socialBtn = (col: string) => ({ width: 46, height: 46, borderRadius: '50%', bgcolor: `${col}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, textDecoration: 'none', transition: 'all 0.18s', cursor: 'pointer', '&:hover': { bgcolor: col, transform: 'translateY(-2px)' } });

  const freeSlots = useCallback((date: string): string[] => {
    if (!info || !selectedService) return [];
    if (info.blockedDates && info.blockedDates.includes(date)) return []; // holiday/vacation
    const dow = new Date(date).getDay();
    let dh = info.hours?.[dow] || { open: dow !== 6, start: '09:00', end: '19:00' };
    if (selectedStaff) {
      const member = (info.team || []).find((t) => t.name === (selectedStaff as unknown as { name?: string })?.name) as { hours?: Record<number, { open: boolean; start: string; end: string }> } | undefined;
      if (member?.hours?.[dow]) dh = member.hours[dow]; // personal hours override
      if ((member as unknown as { blockedDates?: string[] })?.blockedDates?.includes(date)) return []; // personal day off
    }
    if (!dh.open) return [];
    // Never offer times that already passed today (+30 min prep buffer)
    const nowD = new Date();
    const localToday = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
    const minStart = date === localToday ? nowD.getHours() * 60 + nowD.getMinutes() + 30 : 0;
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const dur = selectedService.duration || 30;
    const slots: string[] = [];
    // If a specific staff member is chosen, only that staff's bookings block the slot
    // (each staff can take one booking at a time). Otherwise use station capacity.
    const relevantBookings = selectedStaff
      ? info.bookings.filter((b) => b.staff === selectedStaff.name || (b.status === 'blocked' && !b.staff))
      : info.bookings;
    const capacity = selectedStaff ? 1 : (info.staffCount || info.stations);
    const open = toMin(dh.start); const close = toMin(dh.end);
    const overlapAt = (t: number) => relevantBookings.filter((b) => {
      if (b.date !== date) return false;
      const bs = toMin(b.time); const be = bs + (b.duration || 30);
      return t < be && t + dur > bs;
    }).length;

    if (info.branding.slotMode === 'packed') {
      // Smart packing: offer only times that touch a booking edge (or the day's
      // start/end) — so mixed 60/75/90-min services never leave dead time.
      const candidates = new Set<number>([open, close - dur]);
      relevantBookings.filter((b) => b.date === date).forEach((b) => {
        const bs = toMin(b.time); const be = bs + (b.duration || 30);
        candidates.add(be);                       // right after an existing booking
        if (bs - dur >= open) candidates.add(bs - dur); // finish exactly when one starts
      });
      Array.from(candidates).sort((a, b) => a - b).forEach((t) => {
        if (t >= Math.max(open, minStart) && t + dur <= close && overlapAt(t) < capacity) slots.push(toStr(t));
      });
      return slots;
    }

    for (let t = open; t + dur <= close; t += (info.branding.slotInterval || 15)) {
      if (t >= minStart && overlapAt(t) < capacity) slots.push(toStr(t));
    }
    return slots;
  }, [info, selectedService, selectedStaff]);

  const submit = async () => {
    if (!info || !selectedService || !form.name) return;
    if (info.branding.requirePhone !== false && !form.phone) return;
    setBooking(true);
    try {
      const res = await fetch('/api/public-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizId,
          booking: {
            customerName: form.name, customerPhone: form.phone,
            service: selectedService.name, duration: selectedService.duration,
            date: selectedDate, time: selectedTime,
            staff: selectedStaff?.name || null,
            price: typeof selectedService.price === 'string' ? parseInt(selectedService.price) || 0 : selectedService.price || 0,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        track(Events.PUBLIC_BOOKING_MADE, { bizId, hasDeposit: info.branding.depositOn || false });
        setManageToken(data.manageToken || '');
        // If a deposit is required, redirect to Grow payment
        const b = info.branding;
        if (b.depositOn) {
          const servicePrice = typeof selectedService.price === 'string' ? parseInt(selectedService.price) || 0 : selectedService.price || 0;
          const depositAmt = b.depositAmount && b.depositAmount > 0
            ? b.depositAmount
            : Math.round((servicePrice * (b.depositPercent || 0)) / 100);
          if (depositAmt > 0) {
            try {
              const payRes = await fetch('/api/payments/create-deposit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bizId, amount: depositAmt,
                  description: `מקדמה ל${selectedService.name} · ${selectedDate} ${selectedTime}`,
                  customerName: form.name, customerPhone: form.phone,
                  bookingRef: data.manageToken || '',
                }),
              });
              const payData = await payRes.json();
              if (payData.ok && payData.url) { window.location.href = payData.url; return; }
              // Grow not configured / failed → confirm anyway (owner will collect manually)
            } catch { /* fall through to confirmation */ }
          }
        }
        setStage('done'); try { localStorage.setItem(`zk_cust_${bizId}`, JSON.stringify({ name: form.name, phone: form.phone })); } catch { /* ignore */ }
      }
      else alert(data.error || 'שגיאה');
    } finally { setBooking(false); }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8F7F5' }}><CircularProgress sx={{ color: accent }} /></Box>;

  if (!info || !info.enabled) {
    const reasonText: Record<string, string> = {
      no_service_account: 'תקלת הגדרה בשרת. (פנה לבעל העסק)',
      firestore_error: 'תקלה זמנית. נסה שוב מאוחר יותר.',
      biz_not_found: 'העסק לא נמצא.',
      disabled_by_owner: 'בעל העסק עדיין לא הפעיל הזמנות מקוונות.',
    };
    const msg = info?.reason ? (reasonText[info.reason] || 'הדף אינו זמין') : 'בעל העסק עדיין לא הפעיל הזמנות מקוונות.';
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8F7F5', p: 3, textAlign: 'center', direction: 'rtl' }}>
        <Box sx={{ fontSize: 56, mb: 2 }}>🔒</Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1C1917', mb: 1 }}>דף ההזמנות אינו זמין</Typography>
        <Typography sx={{ fontSize: 14, color: '#78716C', maxWidth: 360 }}>{msg}</Typography>
      </Box>
    );
  }

  const days = Array.from({ length: info?.branding.bookingWindowDays || 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
  const fontStack = "'Heebo', 'Assistant', -apple-system, sans-serif";

  if (mustRegister) {
    const bgImg = info.branding.banner || info.branding.gallery?.[0] || '';
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0C0714', direction: 'rtl', fontFamily: fontStack, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');
          @keyframes gateUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
          @keyframes gatePop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }`}</style>
        {/* Cinematic backdrop: banner if exists, else the logo — HUGE and blurred */}
        {bgImg ? (
          <Box component="img" src={bgImg} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(3px) brightness(0.6)', transform: 'scale(1.08)' }} />
        ) : info.branding.logo ? (
          <Box component="img" src={info.branding.logo} sx={{ position: 'absolute', top: '50%', left: '50%', width: 560, height: 560, objectFit: 'cover', transform: 'translate(-50%, -52%) rotate(-8deg)', filter: 'blur(64px) saturate(1.3)', opacity: 0.55 }} />
        ) : null}
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(175deg, ${accent}55 0%, rgba(6,3,14,0.82) 62%, rgba(6,3,14,0.95) 100%)` }} />

        <Box sx={{ position: 'relative', width: '100%', maxWidth: 400, textAlign: 'center' }}>
          {info.branding.logo ? (
            <Box sx={{ width: 112, height: 112, borderRadius: '50%', mx: 'auto', mb: 2.25, p: '4px', background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))', boxShadow: `0 22px 60px rgba(0,0,0,0.55), 0 0 0 8px ${accent}22`, animation: 'gatePop 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
              <Box component="img" src={info.branding.logo} sx={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            </Box>
          ) : (
            <Box sx={{ width: 112, height: 112, borderRadius: '50%', mx: 'auto', mb: 2.25, bgcolor: 'rgba(255,255,255,0.12)', fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'gatePop 0.5s' }}>✂️</Box>
          )}
          <Typography sx={{ fontFamily: nameFont, fontSize: 30, fontWeight: 600, color: '#fff', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1.2, textShadow: '0 3px 18px rgba(0,0,0,0.55)', animation: 'gateUp 0.55s 0.08s both' }}>{info.businessName}</Typography>
          <Typography sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', mt: 1, mb: 3, letterSpacing: '0.04em', animation: 'gateUp 0.55s 0.16s both' }}>· האפליקציה הרשמית ·</Typography>

          <Box sx={{ bgcolor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)', borderRadius: 5, p: 3, boxShadow: '0 30px 80px rgba(0,0,0,0.5)', textAlign: 'right', animation: 'gateUp 0.55s 0.24s both' }}>
            <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#1C1917', textAlign: 'center', mb: 2 }}>הצטרפו כדי להיכנס 💜</Typography>
            <TextField fullWidth size="small" label="שם מלא" value={regName} onChange={(e) => setRegName(e.target.value)} sx={{ mb: 1.5 }} />
            <TextField fullWidth size="small" type="tel" label="טלפון" placeholder="050-1234567" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registerNow(); }} sx={{ mb: 1.5 }} />
            {info.branding.otpOn && otpSent && (
              <TextField fullWidth size="small" label="קוד אימות מה-SMS" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(e) => { if (e.key === 'Enter') registerNow(); }} sx={{ mb: 1.5 }} inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', letterSpacing: '0.5em', fontWeight: 900 } }} />
            )}
            {regErr && <Typography sx={{ fontSize: 12.5, color: '#DC2626', mb: 1.5, textAlign: 'center' }}>{regErr}</Typography>}
            <Button disabled={regBusy || !regName.trim() || regPhone.replace(/\D/g, '').length < 9} onClick={registerNow} fullWidth variant="contained" sx={{ bgcolor: accent, borderRadius: 3, fontWeight: 900, py: 1.5, fontSize: 15.5, boxShadow: `0 10px 28px ${accent}66`, '&:hover': { bgcolor: accentDark } }}>
              {regBusy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : (info.branding.otpOn && !otpSent ? '📲 שלחו לי קוד אימות' : 'כניסה לאפליקציה ←')}
            </Button>
            <Typography sx={{ fontSize: 11.5, color: '#A8A29E', mt: 1.5, textAlign: 'center', lineHeight: 1.5 }}>כבר קבעתם אצלנו? הזינו את אותו טלפון — הכל יופיע מיד</Typography>
          </Box>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mt: 3 }}>מופעל ע"י Zikkit</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: `radial-gradient(1100px 460px at 50% -8%, ${accent}14, transparent 62%), ${th.pageBase}`, direction: 'rtl', fontFamily: fontStack, pb: 17 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }\n        @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap'); @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes popIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>

      {/* Announcement banner */}
      {info.branding.announcementOn && info.branding.announcement && !annClosed && (
        <Box sx={{ bgcolor: accentDark, color: '#fff', textAlign: 'center', py: 1.25, pr: 2, pl: 5.5, fontSize: 13.5, fontWeight: 600, position: 'sticky', top: 0, zIndex: 20 }}>
          📢 {info.branding.announcement}
          <Box onClick={() => { setAnnClosed(true); try { localStorage.setItem('zk_ann_' + bizId, String(info.branding.announcement)); } catch { /* private mode */ } }}
            sx={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 10, cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 14, fontWeight: 900, lineHeight: 1, zIndex: 21 }}>✕</Box>
        </Box>
      )}

      {/* Welcome popup (shown once) */}
      {showPopup && info.branding.popupOn && (info.branding.popupTitle || info.branding.popupText) && (
        <Box onClick={() => setShowPopup(false)} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, backdropFilter: 'blur(4px)' }}>
          <Box onClick={(e) => e.stopPropagation()} sx={{ bgcolor: '#fff', borderRadius: 5, maxWidth: 380, width: '100%', p: 4, textAlign: 'center', animation: 'popIn 0.3s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}>🎉</Box>
            {info.branding.popupTitle && <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#1C1917', letterSpacing: '-0.02em', mb: 1 }}>{info.branding.popupTitle}</Typography>}
            {info.branding.popupText && <Typography sx={{ fontSize: 15, color: '#57534E', lineHeight: 1.6, mb: 3 }}>{info.branding.popupText}</Typography>}
            <Button onClick={() => setShowPopup(false)} fullWidth variant="contained" sx={{ borderRadius: 3, fontWeight: 800, py: 1.4, bgcolor: accent, '&:hover': { bgcolor: accentDark } }}>הבנתי, בואו נתחיל</Button>
          </Box>
        </Box>
      )}

      {/* Gallery lightbox */}
      {lightbox && (
        <Box onClick={() => setLightbox(null)} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.88)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box component="img" src={lightbox} sx={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 3, objectFit: 'contain' }} />
          <Box sx={{ position: 'absolute', top: 20, left: 20, color: '#fff', fontSize: 28, cursor: 'pointer', opacity: 0.8 }}>✕</Box>
        </Box>
      )}

      {/* ══ Luxury identity band ══ */}
      <Box sx={{ background: bandImg ? '#0A0710' : th.bandBg, position: 'relative', overflow: 'hidden', textAlign: 'center', pt: 3, pb: 3.25, px: 2 }}>
        {bandImg && (<>
          <Box component="img" src={bandImg} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,5,14,0.45) 0%, rgba(8,5,14,0.75) 100%)' }} />
        </>)}
        <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(720px 300px at 50% -20%, ${accent}66, transparent 68%)` }} />
        <Box sx={{ position: 'absolute', bottom: -70, left: -50, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${accent}30, transparent 70%)` }} />
        <Box sx={{ position: 'relative' }}>
          {info.branding.logo && (
            <Box sx={{ width: 208, height: 208, borderRadius: '50%', mx: 'auto', mb: 2, p: '4px', background: `conic-gradient(from 140deg, rgba(255,255,255,0.9), ${accent}AA, rgba(255,255,255,0.25), rgba(255,255,255,0.9))`, boxShadow: `0 16px 44px rgba(0,0,0,0.55), 0 0 0 10px ${accent}14` }}>
              <Box component="img" src={info.branding.logo} sx={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid rgba(255,255,255,0.85)' }} />
            </Box>
          )}
          <Typography sx={{ fontFamily: nameFont, fontSize: 26, fontWeight: info.branding.nameFont === 'modern' ? 900 : 600, color: bandText, letterSpacing: info.branding.nameFont === 'modern' ? '0.06em' : '0.2em', textTransform: 'uppercase', lineHeight: 1.22, px: 1, textShadow: bandText === '#fff' ? '0 2px 14px rgba(0,0,0,0.45)' : 'none' }}>{info.businessName}</Typography>
          <Box sx={{ width: 58, height: 2, mx: 'auto', mt: 1.25, borderRadius: 99, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
          {info.branding.welcomeText && <Typography sx={{ fontSize: 13, color: bandSub, mt: 1.5, maxWidth: 340, mx: 'auto', lineHeight: 1.6 }}>{info.branding.welcomeText}</Typography>}
          {info.branding.promoOn && info.branding.promoText && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mt: 2, background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', borderRadius: 99, px: 2.25, py: 0.9, fontSize: 13, fontWeight: 800, boxShadow: `0 10px 26px ${accent}55` }}>🔥 {info.branding.promoText}</Box>
          )}
        </Box>
      </Box>

      <Box sx={{ maxWidth: 520, mx: 'auto', px: 2, mt: 3 }}>
        {/* Progress steps */}
        {tab === 'book' && stage !== 'done' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, mb: 3 }}>
            {[['service', 'שירות'], ['slot', 'מועד'], ['details', 'פרטים']].map(([s, label], i) => {
              const idx = ['service', 'slot', 'details'].indexOf(stage);
              const done = idx > i; const active = idx === i;
              return (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 900, background: done || active ? `linear-gradient(140deg, ${accent}, ${accentDark})` : '#EBE9E6', color: done || active ? '#fff' : '#A8A29E', boxShadow: active ? `0 0 0 5px ${accent}22, 0 8px 20px ${accent}44` : 'none', transform: active ? 'scale(1.08)' : 'none', transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)' }}>{done ? '✓' : i + 1}</Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: active ? accent : '#A8A29E' }}>{label}</Typography>
                  </Box>
                  {i < 2 && <Box sx={{ width: 32, height: 2, bgcolor: done ? accent : '#E7E5E4', mx: 0.5, mb: 2.5, transition: 'all 0.3s' }} />}
                </Box>
              );
            })}
          </Box>
        )}

        {/* STAGE 1: Service */}
        {tab === 'book' && (<>
        {stage === 'service' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#171412', letterSpacing: '-0.025em', mb: 2.25 }}>איזה שירות תרצו?</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {info.services.length === 0 && <Typography sx={{ textAlign: 'center', color: '#A8A29E', py: 4 }}>אין שירותים זמינים כרגע</Typography>}
              {info.services.map((s) => (
                <Box key={s.id} onClick={() => { setSelectedService(s); setStage(info.team && info.team.length > 0 ? 'staff' : 'slot'); }}
                  sx={{ cursor: 'pointer', bgcolor: '#fff', borderRadius: 4, p: 2.5, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', border: '1px solid rgba(16,24,40,0.05)', transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)', '&:hover': { borderColor: `${accent}55`, transform: 'translateY(-4px)', boxShadow: `0 20px 44px ${accent}2A` }, '&:active': { transform: 'translateY(-1px) scale(0.99)' } }}>
                  <Box sx={{ width: 56, height: 56, borderRadius: 3, background: `linear-gradient(135deg, ${accent}22, ${accent}0A)`, border: `1px solid ${accent}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>✂️</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 16.5, fontWeight: 800, color: '#1C1917', letterSpacing: '-0.01em' }}>{s.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 0.4 }}>
                      {info.branding.showDuration !== false && <Typography sx={{ fontSize: 12.5, color: '#A8A29E', fontWeight: 500 }}>🕐 {s.duration} דק'</Typography>}
                    </Box>
                  </Box>
                  {info.branding.showPrices && s.price ? <Box sx={{ textAlign: 'center', bgcolor: `${accent}0D`, borderRadius: 2, px: 1.5, py: 0.75 }}><Typography sx={{ fontSize: 18, fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.priceFrom ? <span style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 2 }}>{'החל מ־'}</span> : null}₪{s.price}</Typography></Box> : null}
                  <Box sx={{ color: accent, fontSize: 24, fontWeight: 300, opacity: 0.6 }}>‹</Box>
                </Box>
              ))}
            </Box>

            {/* Reviews — social proof */}
            {info.branding.showReviews !== false && info.reviews && info.reviews.length > 0 && (
              <Box sx={{ mt: 4 }}>
                {(() => {
                  const avg = Math.round((info.reviews.reduce((s, r) => s + r.rating, 0) / info.reviews.length) * 10) / 10;
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#1C1917' }}>{avg}</Typography>
                      <Typography sx={{ fontSize: 15, color: '#FFB224' }}>{'★'.repeat(Math.round(avg))}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#78716C' }}>· {info.reviews.length} ביקורות</Typography>
                    </Box>
                  );
                })()}
                <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 0 } }}>
                  {info.reviews.slice(0, 8).map((r, i) => (
                    <Box key={i} sx={{ minWidth: 240, maxWidth: 240, border: '1.5px solid #F0EDFA', bgcolor: '#fff', borderRadius: 3, p: 2, flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                      <Typography sx={{ fontSize: 13, color: '#FFB224', mb: 0.5 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#57534E', lineHeight: 1.5, mb: 1 }}>{r.text}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1C1917' }}>{r.customerName}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Gallery */}
            {info.branding.gallery && info.branding.gallery.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Typography sx={{ fontSize: 17, fontWeight: 800, color: '#1C1917', mb: 1.5, letterSpacing: '-0.01em' }}>{info.branding.galleryTitle || 'הגלריה שלנו'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {info.branding.gallery.map((img, i) => (
                    <Box key={i} onClick={() => setLightbox(img)} sx={{ cursor: 'pointer', borderRadius: 2.5, overflow: 'hidden', aspectRatio: '1', boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.03)' } }}>
                      <Box component="img" src={img} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Opening hours */}
            {info.hours && (
              <Box sx={{ mt: 4, bgcolor: '#fff', borderRadius: 3.5, p: 2.75, border: '1.5px solid #F0EDFA', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#171412', letterSpacing: '-0.01em', mb: 1.5 }}>🕐 שעות פתיחה</Typography>
                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((dayName, i) => {
                  const d = info.hours?.[i];
                  const todayDow = new Date().getDay();
                  return (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: i < 6 ? '1px solid #F5F3FA' : 'none' }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: i === todayDow ? 800 : 500, color: i === todayDow ? accent : '#57534E' }}>{dayName}{i === todayDow ? ' (היום)' : ''}</Typography>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: d?.open ? '#1C1917' : '#A8A29E' }}>{d?.open ? `${d.start} - ${d.end}` : 'סגור'}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* About */}
            {info.branding.aboutText && (
              <Box sx={{ mt: 4, bgcolor: '#fff', borderRadius: 3.5, p: 2.75, border: '1.5px solid #F0EDFA', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#1C1917', mb: 1 }}>קצת עלינו</Typography>
                <Typography sx={{ fontSize: 14, color: '#57534E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{info.branding.aboutText}</Typography>
              </Box>
            )}

            {/* Social links */}
            {(info.branding.instagram || info.branding.facebook || info.branding.tiktok || info.branding.whatsapp) && (
              <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'center', mt: 4 }}>
                {info.branding.instagram && <Box component="a" href={`https://instagram.com/${info.branding.instagram.replace('@', '')}`} target="_blank" sx={socialBtn(accent)}>📷</Box>}
                {info.branding.facebook && <Box component="a" href={info.branding.facebook.startsWith('http') ? info.branding.facebook : `https://${info.branding.facebook}`} target="_blank" sx={socialBtn(accent)}>👍</Box>}
                {info.branding.tiktok && <Box component="a" href={`https://tiktok.com/${info.branding.tiktok.startsWith('@') ? info.branding.tiktok : '@' + info.branding.tiktok}`} target="_blank" sx={socialBtn(accent)}>🎵</Box>}
                {info.branding.whatsapp && <Box component="a" href={`https://wa.me/972${info.branding.whatsapp.replace(/^0/, '')}`} target="_blank" sx={socialBtn(accent)}>💬</Box>}
              </Box>
            )}
          </Box>
        )}
        {stage === 'staff' && selectedService && info.team && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Button onClick={() => setStage('service')} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה לשירותים</Button>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#171412', letterSpacing: '-0.025em', mb: 2.25 }}>עם מי תרצו?</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {/* Any available */}
              {info.branding.firstFreeOn !== false && <Box onClick={() => { setSelectedStaff(null); setStage('slot'); }}
                sx={{ cursor: 'pointer', bgcolor: '#fff', border: `1px solid ${accent}30`, borderRadius: 4, p: 2.25, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', '&:hover': { borderColor: accent, transform: 'translateY(-3px)', boxShadow: `0 18px 40px ${accent}26` } }}>
                <Box sx={{ width: 58, height: 58, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}22, ${accent}0D)`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>⚡</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: '#1C1917' }}>הראשון שפנוי</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#78716C' }}>ללא העדפה — התור המוקדם ביותר</Typography>
                </Box>
              </Box>}
              {/* Staff who provide this service (or all if none specified) */}
              {info.team.filter((m) => !m.services?.length || m.services.includes(selectedService.name)).map((m) => (
                <Box key={m.id} onClick={() => { setSelectedStaff(m); setStage('slot'); }}
                  sx={{ cursor: 'pointer', bgcolor: '#fff', border: '1px solid rgba(16,24,40,0.06)', borderRadius: 4, p: 2.25, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', '&:hover': { borderColor: `${accent}55`, transform: 'translateY(-3px)', boxShadow: `0 18px 40px ${accent}26` } }}>
                  {m.photo
                    ? <Box component="img" src={m.photo} sx={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #fff', boxShadow: `0 0 0 2px ${accent}55, 0 6px 14px rgba(16,24,40,0.14)` }} />
                    : <Box sx={{ width: 60, height: 60, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>{m.name?.[0] || '?'}</Box>}
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: '#1C1917' }}>{m.name}</Typography>
                    {m.role && <Typography sx={{ fontSize: 12.5, color: '#78716C' }}>{m.role}</Typography>}
                  </Box>
                  <Typography sx={{ color: accent, fontSize: 18, fontWeight: 900 }}>‹</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* STAGE 2: Slot */}
        {stage === 'slot' && selectedService && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Button onClick={() => setStage(info.team && info.team.length > 0 ? 'staff' : 'service')} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה</Button>
            <Box sx={{ bgcolor: '#fff', border: `1px solid ${accent}30`, borderRadius: 99, px: 2.25, py: 1.15, mb: 2.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: accentDark }}>✂️ {selectedService.name}</Typography>
              <Typography sx={{ fontSize: 12, color: '#78716C' }}>· {selectedService.duration} דק'</Typography>
              {selectedStaff && <Typography sx={{ fontSize: 12, fontWeight: 700, color: accentDark }}>· 👤 {selectedStaff.name}</Typography>}
            </Box>
            <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#171412', letterSpacing: '-0.01em', mb: 1.5 }}>בחרו יום</Typography>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 1, '&::-webkit-scrollbar': { height: 0 } }}>
              {days.map((d, i) => {
                const dateObj = new Date(d);
                const has = freeSlots(d).length > 0;
                const active = d === selectedDate;
                return (
                  <Box key={d} onClick={() => has && (setSelectedDate(d), setSelectedTime(''))}
                    sx={{ cursor: has ? 'pointer' : 'default', opacity: has ? 1 : 0.32, minWidth: 62, textAlign: 'center', py: 1.6, borderRadius: 2.75, background: active ? `linear-gradient(155deg, ${accent}, ${accentDark})` : '#fff', color: active ? '#fff' : '#1C1917', border: active ? 'none' : '1px solid rgba(16,24,40,0.06)', boxShadow: active ? `0 10px 26px ${accent}55` : '0 1px 2px rgba(16,24,40,0.04)', transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)', transform: active ? 'translateY(-2px)' : 'none', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600, opacity: 0.7 }}>{i === 0 ? 'היום' : i === 1 ? 'מחר' : HEBREW_DAYS_SHORT[dateObj.getDay()]}</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{dateObj.getDate()}</Typography>
                    <Typography sx={{ fontSize: 9.5, opacity: 0.6 }}>{HEBREW_MONTHS[dateObj.getMonth()].slice(0, 3)}</Typography>
                  </Box>
                );
              })}
            </Box>
            {selectedDate && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#171412', letterSpacing: '-0.01em', mb: 1.5 }}>שעות פנויות</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {freeSlots(selectedDate).map((t) => (
                    <Box key={t} onClick={() => { setSelectedTime(t); setStage('details'); }}
                      sx={{ cursor: 'pointer', textAlign: 'center', py: 1.65, borderRadius: 3, bgcolor: '#fff', border: '1px solid rgba(16,24,40,0.07)', fontWeight: 900, fontSize: 15.5, letterSpacing: '0.01em', color: '#171412', transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 1px 2px rgba(16,24,40,0.04)', '&:hover': { border: '1px solid transparent', background: `linear-gradient(155deg, ${accent}, ${accentDark})`, color: '#fff', transform: 'translateY(-3px) scale(1.05)', boxShadow: `0 14px 30px ${accent}4D` } }}>{t}{peakExtraFor(selectedDate, t) > 0 && <Box component="span" sx={{ fontSize: 10, mr: 0.4 }}>⭐</Box>}</Box>
                  ))}
                  </Box>
                {info.branding.peakOn && selectedDate && freeSlots(selectedDate).some((t) => peakExtraFor(selectedDate, t) > 0) && (
                  <Typography sx={{ fontSize: 11.5, color: '#A8A29E', mt: 1 }}>⭐ שעת שיא — תוספת ₪{Math.max(...freeSlots(selectedDate).map((t) => peakExtraFor(selectedDate, t)))} למחיר</Typography>
                )}
                <Box sx={{ display: 'none' }}>
                  {freeSlots(selectedDate).length === 0 && (
                    <Box sx={{ gridColumn: '1/-1', textAlign: 'center', py: 3 }}>
                      <Typography sx={{ color: '#A8A29E', mb: 1.5 }}>אין תורים פנויים ביום זה 😔</Typography>
                      <Button onClick={() => setStage('waitlist')} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, borderColor: accent, color: accent, '&:hover': { borderColor: accent, bgcolor: `${accent}08` } }}>
                        🔔 הצטרפו לרשימת המתנה
                      </Button>
                      <Typography sx={{ fontSize: 12, color: '#A8A29E', mt: 1 }}>נודיע לכם ברגע שמתפנה תור</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
            {!selectedDate && <Typography sx={{ textAlign: 'center', color: '#A8A29E', fontSize: 13, mt: 2 }}>👆 בחרו יום כדי לראות שעות פנויות</Typography>}
          </Box>
        )}

        {/* STAGE 3: Details */}
        {stage === 'details' && selectedService && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Button onClick={() => setStage('slot')} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה למועד</Button>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#171412', letterSpacing: '-0.025em', mb: 2.25 }}>כמעט סיימנו!</Typography>
            <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 2.5, mb: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, mb: 1.5, borderBottom: '1px solid #F5F3F0' }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1C1917' }}>{selectedService.name}</Typography>
                {info.branding.showPrices && selectedService.price ? <Typography sx={{ fontSize: 17, fontWeight: 800, color: accent }}>{selectedService.priceFrom ? 'החל מ־' : ''}₪{staffPriceFor(selectedService.name, selectedService.price) + peakExtraFor(selectedDate, selectedTime || '')}{selectedTime && peakExtraFor(selectedDate, selectedTime) > 0 ? ' ⭐' : ''}</Typography> : null}
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ fontSize: 13.5, color: '#57534E' }}>📅 {new Date(selectedDate).getDate()} {HEBREW_MONTHS[new Date(selectedDate).getMonth()]}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#57534E' }}>🕐 {selectedTime}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#57534E' }}>⏱️ {selectedService.duration} דק'</Typography>
              </Box>
            </Box>
            <TextField fullWidth placeholder="שם מלא" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 1.75, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }} />
            <TextField fullWidth placeholder={info.branding.requirePhone !== false ? "מספר טלפון" : "מספר טלפון (אופציונלי)"} type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} sx={{ mb: info.branding.requireEmail ? 1.75 : 3, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }} />
            {info.branding.requireEmail && <TextField fullWidth placeholder="אימייל" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }} />}
            {(() => {
              const b = info.branding;
              if (!b.depositOn) return null;
              const sp = typeof selectedService.price === 'string' ? parseInt(selectedService.price) || 0 : selectedService.price || 0;
              const dep = b.depositAmount && b.depositAmount > 0 ? b.depositAmount : Math.round((sp * (b.depositPercent || 0)) / 100);
              if (dep <= 0) return null;
              return (
                <Box sx={{ bgcolor: `${accent}0D`, border: `1px solid ${accent}33`, borderRadius: 2, p: 1.75, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ fontSize: 22 }}>💳</Box>
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: accentDark }}>מקדמה: ₪{dep}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#78716C' }}>תשלום מאובטח לאישור התור. היתרה בעסק.</Typography>
                  </Box>
                </Box>
              );
            })()}
            {info.branding.policyOn && info.branding.policyText && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ bgcolor: '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: 2, p: 1.75, maxHeight: 130, overflowY: 'auto', mb: 1 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#57534E', mb: 0.5 }}>📋 תקנון העסק</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#78716C', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{info.branding.policyText}</Typography>
                </Box>
                <Box onClick={() => setPolicyOk(!policyOk)} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 20, height: 20, borderRadius: 1, border: `2px solid ${policyOk ? accent : '#D6D3D1'}`, bgcolor: policyOk ? accent : 'transparent', color: '#fff', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>{policyOk ? '✓' : ''}</Box>
                  <Typography sx={{ fontSize: 13, color: '#57534E', fontWeight: 600 }}>קראתי ואני מאשר/ת את התקנון</Typography>
                </Box>
              </Box>
            )}
            <Button onClick={submit} disabled={!form.name || (info.branding.requirePhone !== false && !form.phone) || booking || (info.branding.policyOn && !!info.branding.policyText && !policyOk)} fullWidth sx={{ py: 1.85, borderRadius: 1.5, fontWeight: 800, fontSize: 16.5, color: '#fff', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, boxShadow: `0 6px 20px ${accent}55`, '&:hover': { filter: 'brightness(1.05)' }, '&.Mui-disabled': { background: '#D6D3D1', color: '#fff' } }}>
              {booking ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : info.branding.depositOn ? '💳 המשך לתשלום מקדמה' : '✓ אישור התור'}
            </Button>
            {info.branding.cancellationNote && <Typography sx={{ fontSize: 11.5, color: '#A8A29E', textAlign: 'center', mt: 1.5 }}>{info.branding.cancellationNote}</Typography>}
          </Box>
        )}

        {/* DONE */}
        {/* STAGE: Waitlist form */}
        {stage === 'waitlist' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Button onClick={() => setStage('slot')} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה</Button>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#1C1917', mb: 0.5 }}>רשימת המתנה</Typography>
            <Typography sx={{ fontSize: 13.5, color: '#78716C', mb: 2.5 }}>השאירו פרטים ונודיע לכם ברגע שמתפנה תור{selectedService ? ` ל${selectedService.name}` : ''}.</Typography>
            <TextField fullWidth placeholder="שם מלא" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 1.75, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }} />
            <TextField fullWidth placeholder="טלפון" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} sx={{ mb: 1.75, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }} />
            <TextField fullWidth placeholder="העדפות? (יום/שעה שנוחים לכם)" value={wlNote} onChange={(e) => setWlNote(e.target.value)} multiline rows={2} sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }} />
            <Button onClick={submitWaitlist} disabled={booking || !form.name.trim() || !form.phone.trim()} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 800, py: 1.5, bgcolor: accent, '&:hover': { bgcolor: accentDark } }}>
              {booking ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : '🔔 הצטרפו לרשימת ההמתנה'}
            </Button>
          </Box>
        )}

        {/* STAGE: Waitlisted confirmation */}
        {stage === 'waitlisted' && (
          <Box sx={{ animation: 'fadeIn 0.4s', textAlign: 'center', py: 4 }}>
            <Box sx={{ width: 84, height: 84, borderRadius: '50%', bgcolor: `${accent}15`, fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}>🔔</Box>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#1C1917', letterSpacing: '-0.02em', mb: 1 }}>נרשמתם!</Typography>
            <Typography sx={{ fontSize: 15, color: '#57534E', lineHeight: 1.55, maxWidth: 300, mx: 'auto' }}>נודיע לכם מיד כשמתפנה תור. בינתיים אפשר לבדוק שוב מאוחר יותר 😊</Typography>
          </Box>
        )}

        {stage === 'done' && (
          <Box sx={{ textAlign: 'center', py: 5, animation: 'fadeIn 0.5s' }}>
            <Box sx={{ position: 'relative', width: 130, height: 130, mx: 'auto', mb: 3 }}>
              <Box sx={{ position: 'absolute', inset: -26, borderRadius: '50%', background: `radial-gradient(circle, ${accent}30, transparent 68%)` }} />
              <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px dashed ${accent}55`, animation: 'spin 14s linear infinite' }} />
              <Box sx={{ position: 'absolute', inset: 11, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', fontSize: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 18px 44px ${accent}66`, animation: 'pop 0.55s cubic-bezier(0.16,1,0.3,1)' }}>✓</Box>
            </Box>
            <Typography sx={{ fontSize: 32, fontWeight: 900, color: '#171412', letterSpacing: '-0.03em', mb: 1 }}>{info.branding.approvalMode === 'manual' ? 'הבקשה נשלחה! ⏳' : 'התור נקבע! 🎉'}</Typography>
            <Box sx={{ bgcolor: '#fff', borderRadius: 4, p: 3, mt: 3, mb: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 16px 40px rgba(16,24,40,0.1)', border: '1px solid rgba(16,24,40,0.05)', textAlign: 'right' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1C1917', mb: 1 }}>{selectedService?.name}</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ fontSize: 14, color: accent, fontWeight: 700 }}>📅 {new Date(selectedDate).getDate()} {HEBREW_MONTHS[new Date(selectedDate).getMonth()]}</Typography>
                <Typography sx={{ fontSize: 14, color: accent, fontWeight: 700 }}>🕐 {selectedTime}</Typography>
              </Box>
              {info.branding.address && (
                <Box sx={{ borderTop: '1px solid #F5F5F4', mt: 1.5, pt: 1.5 }}>
                  <Typography sx={{ fontSize: 14, color: '#57534E', fontWeight: 700 }}>📍 {info.branding.address}</Typography>
                  <Typography component="a" href={`https://waze.com/ul?q=${encodeURIComponent(info.branding.address)}`} target="_blank" sx={{ fontSize: 12.5, color: accent, fontWeight: 700, textDecoration: 'none' }}>ניווט ב-Waze ←</Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: 13.5, color: '#78716C' }}>{info.branding.approvalMode === 'manual' ? 'העסק יאשר את התור בהקדם ותקבלו עדכון 💜' : (info.branding.thankYouMessage || 'שלחנו לך SMS עם האישור. נתראה! 💜')}</Typography>

            {/* Share the business — customers become the marketing */}
            <Button
              onClick={() => {
                const url = `${window.location.origin}/book/${bizId}`;
                const text = `קבעתי תור ב${info.businessName} בשניות 💜 גם לכם מגיע:`;
                if (navigator.share) { navigator.share({ title: info.businessName, text, url }).catch(() => {}); }
                else { window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank'); }
              }}
              fullWidth sx={{ mt: 2, mb: 1, border: `1.5px solid ${accent}44`, color: accent, borderRadius: 3, fontWeight: 800, py: 1.2 }}>
              💬 שתפו את {info.businessName} עם חברים
                <Box sx={{ bgcolor: '#fff', borderRadius: 4, p: 2.25, mt: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', textAlign: 'center' }}>
                  {recurDone ? (
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: accent }}>{recurDone}</Typography>
                  ) : (<>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: '#171412', mb: 1 }}>🔁 להפוך לתור קבוע?</Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 13, color: '#6B6660' }}>כל</Typography>
                      {[2, 3, 4].map((w) => <Box key={w} onClick={() => setRecurWeeks(w)} sx={{ cursor: 'pointer', px: 1.5, py: 0.5, borderRadius: 99, fontSize: 13, fontWeight: 800, bgcolor: recurWeeks === w ? accent : '#F4F1EE', color: recurWeeks === w ? '#fff' : '#6B6660' }}>{w} שב׳</Box>)}
                      <Typography sx={{ fontSize: 13, color: '#6B6660' }}>· {recurCount} פעמים קדימה</Typography>
                    </Box>
                    <Button onClick={bookRecurring} disabled={recurBusy} fullWidth variant="outlined" sx={{ borderColor: `${accent}55`, color: accent, borderRadius: 3, fontWeight: 900 }}>{recurBusy ? '...' : 'קבעו לי אותם 🔁'}</Button>
                  </>)}
                </Box>
            </Button>

            {/* Recurring: one-tap rebook — server validates availability */}
            <Box sx={{ mt: 2.5, bgcolor: '#fff', borderRadius: 4, p: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#171412', mb: 1.25 }}>🔁 לקבוע את אותו תור שוב?</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map((w) => (
                  <Box key={w} onClick={() => rebook(w)} sx={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: accent, border: `1.5px solid ${accent}44`, borderRadius: 99, px: 1.75, py: 0.7, '&:hover': { bgcolor: `${accent}11` } }}>
                    בעוד {w === 1 ? 'שבוע' : `${w} שבועות`}
                  </Box>
                ))}
              </Box>
              {rebookMsg && <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 1.25, color: rebookMsg.startsWith('✅') ? '#059669' : rebookMsg.startsWith('⏳') ? '#78716C' : '#DC2626' }}>{rebookMsg}</Typography>}
            </Box>

            {/* Add to calendar — reduces no-shows */}
            <Button
              onClick={() => {
                const start = new Date(`${selectedDate}T${selectedTime}:00`);
                const end = new Date(start.getTime() + (selectedService?.duration || 30) * 60000);
                const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
                  `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
                  `SUMMARY:${selectedService?.name || 'תור'} - ${info.businessName}`,
                  selectedStaff ? `DESCRIPTION:עם ${selectedStaff.name}` : '',
                  info.branding.address ? `LOCATION:${info.branding.address}` : '',
                  'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\n');
                const blob = new Blob([ics], { type: 'text/calendar' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'appointment.ics'; a.click();
                URL.revokeObjectURL(url);
              }}
              variant="outlined"
              sx={{ mt: 2.5, borderRadius: 2, fontWeight: 700, borderColor: accent, color: accent, '&:hover': { borderColor: accent, bgcolor: `${accent}08` } }}
            >
              📅 הוסף ליומן שלי
            </Button>

            {manageToken && (
              <Typography sx={{ fontSize: 13, color: '#78716C', mt: 2 }}>
                צריך לבטל או לשנות?{' '}
                <Box component="a" href={`/manage/${bizId}/${manageToken}`} sx={{ color: accent, fontWeight: 700, textDecoration: 'none' }}>ניהול התור שלי</Box>
              </Typography>
            )}

            {info.branding.cancellationNote && <Typography sx={{ fontSize: 12, color: '#A8A29E', mt: 1.5 }}>{info.branding.cancellationNote}</Typography>}
          </Box>
        )}

        {/* Contact footer */}
        {(info.branding.whatsapp || info.branding.instagram) && stage !== 'done' && (
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #EEEAE5', display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            {info.branding.whatsapp && <Button href={`https://wa.me/972${info.branding.whatsapp.replace(/^0/, '')}`} target="_blank" sx={{ color: '#25D366', fontWeight: 700, fontSize: 13 }}>💬 וואטסאפ</Button>}
            {info.branding.instagram && <Button href={`https://instagram.com/${info.branding.instagram.replace('@', '')}`} target="_blank" sx={{ color: '#E1306C', fontWeight: 700, fontSize: 13 }}>📷 אינסטגרם</Button>}
          </Box>
        )}

        </>)}

        {/* ════════ HOME — the business's app ════════ */}
        {tab === 'home' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            {/* Hero */}
            <Box sx={{ position: 'relative', borderRadius: 4.5, overflow: 'hidden', mb: 2.5, minHeight: 292, background: (info.branding.banner || info.branding.gallery?.[0]) ? undefined : `linear-gradient(135deg, ${accent}, ${accentDark})` }}>
              {(info.branding.banner || info.branding.gallery?.[0]) && <Box component="img" src={info.branding.banner || info.branding.gallery?.[0]} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,6,18,0.02) 16%, rgba(10,6,18,0.5) 58%, rgba(10,6,18,0.84) 100%)' }} />
              <Box sx={{ position: 'relative', p: 2.75, pt: 12, color: '#fff' }}>
                <Typography sx={{ fontFamily: nameFont, fontSize: 11, fontWeight: 600, letterSpacing: '0.3em', opacity: 0.8, mb: 0.75 }}>{(info.businessName || '').toUpperCase()}</Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.08, textShadow: '0 3px 16px rgba(0,0,0,0.45)' }}>
                  {me?.name ? `שלום, ${me.name.split(' ')[0]} 👋` : `ברוכים הבאים ל${info.businessName}`}
                </Typography>
                <Typography sx={{ fontSize: 13.5, opacity: 0.92, mt: 0.25 }}>{me ? 'טוב לראות אותך שוב' : 'קובעים תור בשניות, בלי טלפונים'}</Typography>
                {(() => {
                  const dh = info.hours?.[new Date().getDay()]; if (!dh) return null;
                  const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes();
                  const tm = (t: string) => { const [h, mm] = t.split(':').map(Number); return h * 60 + (mm || 0); };
                  const state = !dh.open ? { c: '#F87171', t: 'סגור היום' }
                    : nowM < tm(dh.start) ? { c: '#FBBF24', t: `נפתח היום ב-${dh.start}` }
                    : nowM < tm(dh.end) ? { c: '#4ADE80', t: `פתוח עכשיו · עד ${dh.end}` }
                    : { c: '#F87171', t: 'סגור עכשיו' };
                  return (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)', borderRadius: 99, px: 1.5, py: 0.5, mt: 1.25 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: state.c }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{state.t}</Typography>
                    </Box>
                  );
                })()}
                <Button onClick={() => { setTab('book'); window.scrollTo({ top: 0 }); }} sx={{ mt: 2, bgcolor: '#fff', color: accentDark, fontWeight: 900, px: 4, py: 1.35, borderRadius: 99, fontSize: 15, letterSpacing: '-0.01em', boxShadow: '0 14px 36px rgba(0,0,0,0.35)', transition: 'all 0.2s', '&:hover': { bgcolor: '#fff', transform: 'translateY(-2px)', boxShadow: '0 20px 44px rgba(0,0,0,0.4)' }, '&:active': { transform: 'scale(0.97)' } }}>📅 הזמנת תור</Button>
              </Box>
            </Box>

            {/* Join the club */}
            {!me && (
              <Box onClick={() => setTab('profile')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff', border: `1.5px solid ${accent}33`, borderRadius: 3, p: 2, mb: 2.5, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                <Box sx={{ width: 42, height: 42, borderRadius: '50%', bgcolor: `${accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: '#1C1917' }}>הצטרפו לאפליקציה של {info.businessName}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#78716C' }}>מעקב תורים, קביעה מהירה והטבות</Typography>
                </Box>
                <Typography sx={{ fontSize: 14, color: accent, fontWeight: 900 }}>←</Typography>
              </Box>
            )}

            {/* My upcoming appointments */}
            {myUpcoming.length > 0 && (
              <Box sx={{ mb: 2.5, animation: 'fadeUp 0.5s 0.05s both' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', mb: 1.25, '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>התורים הקרובים שלך</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {myUpcoming.map((b, i) => (
                    <Box key={i} onClick={() => { window.location.href = `/manage/${bizId}/${b.token}`; }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff', borderRadius: 3, p: 1.75, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                      <Box sx={{ textAlign: 'center', bgcolor: `${accent}12`, borderRadius: 2, px: 1.5, py: 0.75, minWidth: 62 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 900, color: accent, lineHeight: 1.1 }}>{b.time}</Typography>
                        <Typography sx={{ fontSize: 10.5, color: accent, opacity: 0.8 }}>{b.date?.slice(5).split('-').reverse().join('/')}</Typography>
                      </Box>
                      <Typography sx={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: '#1C1917' }}>{b.service}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: accent, fontWeight: 800 }}>נהל ←</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Gallery as stories */}
            {(info.branding.gallery || []).length > 0 && (
              <Box sx={{ mb: 2.5, animation: 'fadeUp 0.5s 0.12s both' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>{info.branding.galleryTitle || 'העבודות שלנו'}</Typography>
                  <Typography onClick={() => setTab('gallery')} sx={{ fontSize: 12, fontWeight: 800, color: accent, cursor: 'pointer' }}>הצג הכל ←</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                  {(info.branding.gallery || []).slice(0, 10).map((img: string, i: number) => (
                    <Box key={i} onClick={() => setLightbox(img)} sx={{ cursor: 'pointer', flexShrink: 0, width: 82, height: 82, borderRadius: '50%', p: '3px', background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}>
                      <Box component="img" src={img} sx={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #fff' }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Our team */}
            {(info.team || []).length > 0 && (
              <Box sx={{ mb: 2.5, animation: 'fadeUp 0.5s 0.19s both' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', mb: 1.25, '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>✂️ הצוות שלנו</Typography>
                <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                  {(info.team || []).map((m) => (
                    <Box key={m.id} onClick={() => { setTab('book'); window.scrollTo({ top: 0 }); }} sx={{ cursor: 'pointer', flexShrink: 0, width: 128, bgcolor: '#fff', borderRadius: 4.5, p: 1.75, textAlign: 'center', boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', transition: 'transform 0.15s', '&:active': { transform: 'scale(0.97)' } }}>
                      {m.photo ? (
                        <Box component="img" src={m.photo} sx={{ width: 86, height: 86, borderRadius: '50%', objectFit: 'cover', mb: 1, border: '3px solid #fff', boxShadow: `0 0 0 2.5px ${accent}66, 0 8px 18px rgba(16,24,40,0.14)` }} />
                      ) : (
                        <Box sx={{ width: 76, height: 76, borderRadius: '50%', mx: 'auto', mb: 1, background: `linear-gradient(135deg, ${accent}25, ${accent}45)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: accentDark }}>{(m.name || '?').charAt(0)}</Box>
                      )}
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#1C1917', lineHeight: 1.2 }}>{m.name}</Typography>
                      {m.role && <Typography sx={{ fontSize: 11, color: '#A8A29E', mt: 0.25 }}>{m.role}</Typography>}
                      <Typography sx={{ fontSize: 11, color: accent, fontWeight: 800, mt: 0.75 }}>קביעת תור ←</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Services & prices */}
            {(info.services || []).length > 0 && (
              <Box sx={{ mb: 2.5, animation: 'fadeUp 0.5s 0.26s both' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>💅 השירותים והמחירים</Typography>
                  {(info.services || []).length > 5 && <Typography onClick={() => setTab('book')} sx={{ fontSize: 12, fontWeight: 800, color: accent, cursor: 'pointer' }}>הכל ←</Typography>}
                </Box>
                <Box sx={{ bgcolor: '#fff', borderRadius: 3.5, overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                  {(info.services || []).slice(0, 5).map((sv, i) => (
                    <Box key={sv.id || i} onClick={() => { setTab('book'); window.scrollTo({ top: 0 }); }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.6, borderBottom: i < Math.min((info.services || []).length, 5) - 1 ? '1px solid #F5F5F4' : 'none', '&:active': { bgcolor: '#FAFAF9' } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: '#1C1917' }}>{sv.name}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#A8A29E' }}>{sv.duration} דק'</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 900, color: accent, whiteSpace: 'nowrap' }}>{sv.priceFrom ? 'החל מ־' : ''}₪{sv.price}</Typography>
                      <Typography sx={{ color: '#D6D3D1', fontSize: 16 }}>‹</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Products shelf */}
            {(info.branding.products || []).length > 0 && (
              <Box sx={{ mb: 2.5, animation: 'fadeUp 0.5s 0.33s both' }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', mb: 1.25, '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>🛍️ המוצרים שלנו</Typography>
                <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                  {(info.branding.products || []).map((pr, i) => (
                    <Box key={i} sx={{ flexShrink: 0, width: 150, bgcolor: '#fff', borderRadius: 3, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      {pr.photo ? <Box component="img" src={pr.photo} sx={{ width: '100%', height: 108, objectFit: 'cover' }} /> : <Box sx={{ height: 108, bgcolor: `${accent}0D`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🛍️</Box>}
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1C1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.name}</Typography>
                        {pr.price ? <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: accent, mt: 0.25 }}>₪{pr.price}</Typography> : null}
                        {info.branding.phone && (
                          <Button href={`https://wa.me/${info.branding.phone.replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent('היי! אשמח להזמין את ' + pr.name + ' 🙂')}`} target="_blank" fullWidth size="small" sx={{ mt: 0.75, bgcolor: '#25D36618', color: '#1EA952', fontWeight: 800, fontSize: 11.5, borderRadius: 2, py: 0.4 }}>💬 הזמנה</Button>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            {/* Reviews — social proof */}
            {info.branding.showReviews !== false && (info.reviews || []).length > 0 && (
              <Box sx={{ mb: 2.5, animation: 'fadeUp 0.5s 0.4s both' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>לקוחות מספרים</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#B8860B' }}>{'★'.repeat(Math.round((info.reviews || []).reduce((sum, r) => sum + r.rating, 0) / (info.reviews || []).length))} {(Math.round(((info.reviews || []).reduce((sum, r) => sum + r.rating, 0) / (info.reviews || []).length) * 10) / 10)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                  {(info.reviews || []).slice(0, 6).map((r, i) => (
                    <Box key={i} sx={{ flexShrink: 0, width: 230, bgcolor: '#fff', borderRadius: 3.5, p: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                      <Typography sx={{ fontSize: 12.5, color: '#B8860B', mb: 0.5, letterSpacing: '0.08em' }}>{'★'.repeat(r.rating)}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#44403C', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.text}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#A8A29E', fontWeight: 700, mt: 1 }}>— {r.customerName}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ════════ GALLERY ════════ */}
        {tab === 'gallery' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#1C1917', mb: 1.5 }}>{info.branding.galleryTitle || 'העבודות שלנו'}</Typography>
            {(info.branding.gallery || []).length === 0 ? (
              <Typography sx={{ fontSize: 14, color: '#78716C', textAlign: 'center', py: 6 }}>עוד אין תמונות בגלריה</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
                {(info.branding.gallery || []).map((img: string, i: number) => (
                  <Box key={i} component="img" src={img} onClick={() => setLightbox(img)} sx={{ cursor: 'pointer', width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 1.5 }} />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* ════════ INFO ════════ */}
        {tab === 'info' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#1C1917', mb: 2 }}>ℹ️ מידע ושעות</Typography>
            {info.branding.phone && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                <Button href={`tel:${info.branding.phone}`} fullWidth sx={{ bgcolor: '#fff', color: '#1C1917', fontWeight: 800, borderRadius: 3, py: 1.4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>📞 התקשרו</Button>
                <Button href={`https://wa.me/${info.branding.phone.replace(/\D/g, '').replace(/^0/, '972')}`} target="_blank" fullWidth sx={{ bgcolor: '#fff', color: '#1EA952', fontWeight: 800, borderRadius: 3, py: 1.4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>💬 וואטסאפ</Button>
              </Box>
            )}
            <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 2.25, mb: 2, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#78716C', mb: 1.25 }}>🕐 שעות פעילות</Typography>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const dh = info.hours?.[d];
                return (
                  <Box key={d} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: d < 6 ? '1px solid #F5F5F4' : 'none' }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#44403C' }}>{['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d]}</Typography>
                    <Typography sx={{ fontSize: 13.5, color: dh?.open ? '#1C1917' : '#A8A29E', fontWeight: dh?.open ? 700 : 500 }}>{dh?.open ? `${dh.start} - ${dh.end}` : 'סגור'}</Typography>
                  </Box>
                );
              })}
            </Box>
            {info.branding.policyOn && info.branding.policyText && (
              <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 2.25, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#78716C', mb: 1 }}>📋 תקנון</Typography>
                <Typography sx={{ fontSize: 13, color: '#57534E', whiteSpace: 'pre-line', lineHeight: 1.7 }}>{info.branding.policyText}</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ════════ PROFILE ════════ */}
        {tab === 'profile' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            {me ? (
              <>
                <Box sx={{ bgcolor: '#fff', borderRadius: 4, p: 3, textAlign: 'center', boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)', mb: 2 }}>
                  <Box sx={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', fontSize: 30, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>{(me.name || '?').charAt(0)}</Box>
                  <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#1C1917' }}>{me.name}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: '#78716C', mt: 0.25 }}>{me.phone}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: accent, fontWeight: 800, mt: 1 }}>חבר/ה באפליקציה של {info.businessName} 💜</Typography>
                </Box>
                {myUpcoming.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12.5, fontWeight: 900, color: '#44403C', mb: 1.25, '&::before': { content: '""', width: 20, height: 3.5, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accentDark})`, display: 'inline-block' } }}>התורים הקרובים שלך</Typography>
                    {myUpcoming.map((b, i) => (
                      <Box key={i} onClick={() => { window.location.href = `/manage/${bizId}/${b.token}`; }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff', borderRadius: 3, p: 1.75, mb: 1, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                        <Box sx={{ textAlign: 'center', bgcolor: `${accent}12`, borderRadius: 2, px: 1.5, py: 0.75, minWidth: 62 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 900, color: accent, lineHeight: 1.1 }}>{b.time}</Typography>
                          <Typography sx={{ fontSize: 10.5, color: accent, opacity: 0.8 }}>{b.date?.slice(5).split('-').reverse().join('/')}</Typography>
                        </Box>
                        <Typography sx={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: '#1C1917' }}>{b.service}</Typography>
                        <Typography sx={{ fontSize: 12.5, color: accent, fontWeight: 800 }}>נהל ←</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                <Button onClick={() => { setTab('book'); }} fullWidth variant="contained" sx={{ bgcolor: accent, borderRadius: 3, fontWeight: 800, py: 1.4, mb: 1.5, '&:hover': { bgcolor: accentDark } }}>📅 קביעת תור חדש</Button>
                <Button onClick={() => { try { localStorage.removeItem(`zk_cust_${bizId}`); } catch { /* ignore */ } setMe(null); setMyUpcoming([]); }} fullWidth sx={{ color: '#A8A29E', fontWeight: 700 }}>התנתקות מהמכשיר הזה</Button>
              </>
            ) : (
              <Box sx={{ bgcolor: '#fff', borderRadius: 4, p: 3, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
                <Box sx={{ textAlign: 'center', mb: 2.5 }}>
                  <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: `${accent}12`, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>👤</Box>
                  <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#1C1917' }}>הצטרפות לאפליקציה</Typography>
                  <Typography sx={{ fontSize: 13.5, color: '#78716C', mt: 0.5 }}>של {info.businessName} — מעקב תורים, קביעה בשניות והטבות</Typography>
                </Box>
                <TextField fullWidth size="small" label="שם מלא" value={regName} onChange={(e) => setRegName(e.target.value)} sx={{ mb: 1.5 }} />
                <TextField fullWidth size="small" type="tel" label="טלפון" placeholder="050-1234567" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} sx={{ mb: 2 }} />
                {regErr && <Typography sx={{ fontSize: 12.5, color: '#DC2626', mb: 1.5, textAlign: 'center' }}>{regErr}</Typography>}
                <Button disabled={regBusy || !regName.trim() || regPhone.replace(/\D/g, '').length < 9} onClick={registerNow} fullWidth variant="contained" sx={{ bgcolor: accent, borderRadius: 3, fontWeight: 900, py: 1.4, '&:hover': { bgcolor: accentDark } }}>
                  {regBusy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : '🎉 הצטרפות'}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Box onClick={() => { setFindOpen(true); setFindResults(null); setFindErr(''); }} sx={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#fff', border: '1px solid #E7E5E4', borderRadius: 99, px: 2.5, py: 1.1, fontSize: 13.5, fontWeight: 700, color: '#57534E', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', '&:hover': { borderColor: accent, color: accent } }}>
          📅 כבר קבעתם תור? ניהול / ביטול תור
        </Box>
      </Box>
      <Typography sx={{ textAlign: 'center', mt: 2.5, fontSize: 11.5, color: '#C4BDB4' }}>מופעל ע"י ZikkitAppointments · <Box component="span" sx={{ fontSize: 10, opacity: 0.75 }}>גרסה 9.7-studio</Box></Typography>

      {/* ════════ Bottom app navigation ════════ */}
      <Box sx={{ position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 28px)', maxWidth: 430, zIndex: 40, bgcolor: th.navBg, backdropFilter: 'blur(24px) saturate(1.6)', border: `1px solid ${th.navBorder}`, borderRadius: 99, boxShadow: '0 22px 52px rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', pt: 0.75, pb: 0.75, px: 1.5 }}>
        {([['home', '🏠', 'בית'], ['gallery', '🖼️', 'גלריה'], ['__book__', '', ''], ['profile', '👤', 'פרופיל'], ['info', 'ℹ️', 'מידע']] as const).map(([t, icon, label]) => (
          t === '__book__' ? (
            <Box key={t} onClick={() => { setTab('book'); window.scrollTo({ top: 0 }); }} sx={{ cursor: 'pointer', mt: -3.5, width: 63, height: 63, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, border: `3px solid ${tab === 'book' ? accent : 'rgba(255,255,255,0.9)'}`, boxShadow: `0 8px 22px ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'all 0.2s', '&:active': { transform: 'scale(0.94)' } }}>
              {info.branding.logo ? <Box component="img" src={info.branding.logo} sx={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.18)' }} /> : <Box sx={{ fontSize: 24, color: '#fff' }}>📅</Box>}
            </Box>
          ) : (
          <Box key={t} onClick={() => { setTab(t as 'home' | 'gallery' | 'profile' | 'info'); window.scrollTo({ top: 0 }); }} sx={{ cursor: 'pointer', textAlign: 'center', px: 1.5, py: 0.5, borderRadius: 2, transition: 'all 0.15s' }}>
            <Box sx={{ fontSize: 21, filter: tab === t ? 'none' : 'grayscale(60%)', opacity: tab === t ? 1 : 0.55, transform: tab === t ? 'translateY(-1px)' : 'none', transition: 'all 0.2s' }}>{icon}</Box>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tab === t ? th.navActive : th.navIdle, mt: 0.1 }}>{label}</Typography>
          </Box>
          )
        ))}
      </Box>

      {/* Find my bookings dialog */}
      <Dialog open={findOpen} onClose={() => setFindOpen(false)} fullWidth PaperProps={{ sx: { borderRadius: 3, maxWidth: 400, m: 2, p: 3 } }}>
        <Typography sx={{ fontSize: 19, fontWeight: 900, color: '#1C1917', mb: 0.5 }}>📅 התורים שלי</Typography>
        <Typography sx={{ fontSize: 13, color: '#78716C', mb: 2 }}>הזינו את מספר הטלפון שאיתו קבעתם — ונמצא את התור.</Typography>
        <TextField fullWidth size="small" type="tel" label="מספר טלפון" placeholder="050-1234567" value={findPhone}
          onChange={(e) => setFindPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') findMyBookings(); }} sx={{ mb: 1.5 }} />
            {info?.branding?.otpOn && findOtpSent && (
              <TextField fullWidth size="small" label="קוד אימות מה-SMS" value={findCode} onChange={(e) => setFindCode(e.target.value.replace(/\D/g, '').slice(0, 4))} sx={{ mt: 1.5 }} inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', letterSpacing: '0.5em', fontWeight: 900 } }} />
            )}
        <Button onClick={findMyBookings} disabled={findBusy || findPhone.replace(/\D/g, '').length < 9} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 800, py: 1.25, bgcolor: accent, '&:hover': { bgcolor: accentDark } }}>
          {findBusy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'מצאו את התור שלי'}
        </Button>
        {findErr && <Typography sx={{ fontSize: 13, color: '#DC2626', mt: 1.5, textAlign: 'center' }}>{findErr}</Typography>}
        {findResults && findResults.length === 0 && (
          <Typography sx={{ fontSize: 13.5, color: '#78716C', mt: 2, textAlign: 'center' }}>לא נמצא תור עתידי למספר הזה 🤔<br/>אולי נקבע עם מספר אחר?</Typography>
        )}
        {findResults && findResults.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {findResults.map((r, i) => (
              <Box key={i} onClick={() => { window.location.href = `/manage/${bizId}/${r.token}`; }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid #E7E5E4', borderRadius: 2, p: 1.75, '&:hover': { borderColor: accent, bgcolor: `${accent}08` } }}>
                <Box sx={{ textAlign: 'center', bgcolor: `${accent}12`, borderRadius: 1.5, px: 1.5, py: 0.75, minWidth: 62 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 900, color: accent, lineHeight: 1.1 }}>{r.time}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: accent, opacity: 0.8 }}>{r.date?.slice(5).split('-').reverse().join('/')}</Typography>
                </Box>
                <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1C1917' }}>{r.service}</Typography>
                <Typography sx={{ fontSize: 13, color: accent, fontWeight: 800 }}>נהל ←</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Dialog>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes pop { 0% { transform: scale(0); } 70% { transform: scale(1.1); } 100% { transform: scale(1); } }`}</style>
    </Box>
  );
}
