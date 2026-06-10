'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getDocuments, saveDocument, deleteDocument, getDocBranding, saveDocBranding, docTotal, type BizDocument, type DocBranding, type BizDocLineItem } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const COLORS = ['#7C3AED', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#1C1917'];

export default function DocumentsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [docs, setDocs] = useState<BizDocument[]>([]);
  const [branding, setBranding] = useState<DocBranding | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [editor, setEditor] = useState<BizDocument | null>(null);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [preview, setPreview] = useState<BizDocument | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setDocs(await getDocuments(bizId)); setBranding(await getDocBranding(bizId)); }
    finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const newDoc = (type: 'receipt' | 'quote') => {
    const num = String(docs.filter((d) => d.type === type).length + 1).padStart(3, '0');
    setEditor({
      id: 'doc_' + Date.now(), type, number: num, customerName: '', customerPhone: '',
      date: new Date().toISOString().split('T')[0], items: [{ description: '', qty: 1, price: 0 }],
      discount: 0, taxRate: 0, notes: '', status: type === 'receipt' ? 'paid' : 'sent', createdAt: new Date().toISOString(),
    });
  };

  const saveDoc = async () => {
    if (!bizId || !editor) return;
    setSaving(true);
    try { await saveDocument(bizId, editor); setEditor(null); await load(); }
    finally { setSaving(false); }
  };

  const saveBrand = async () => {
    if (!bizId || !branding) return;
    setSaving(true);
    try { await saveDocBranding(bizId, branding); setBrandingOpen(false); }
    finally { setSaving(false); }
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !branding) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 240 / img.width);
        const cv = document.createElement('canvas'); cv.width = img.width * s; cv.height = img.height * s;
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        setBranding({ ...branding, logo: cv.toDataURL('image/jpeg', 0.75) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (loading || dataLoading || !branding) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>קבלות והצעות מחיר</Typography>
        <Button onClick={() => setBrandingOpen(true)} size="small" sx={{ color: c.text2, fontWeight: 600 }}>🎨 עיצוב</Button>
      </Box>

      <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
        {/* Create buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 4 }}>
          <Box onClick={() => newDoc('receipt')} sx={{ flex: 1, cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm, transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: c.shadowMd } }}>
            <Box sx={{ fontSize: 26, mb: 0.5 }}>🧾</Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>קבלה חדשה</Typography>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>תיעוד תשלום שהתקבל</Typography>
          </Box>
          <Box onClick={() => newDoc('quote')} sx={{ flex: 1, cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm, transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: c.shadowMd } }}>
            <Box sx={{ fontSize: 26, mb: 0.5 }}>📄</Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>הצעת מחיר</Typography>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>הצעה מעוצבת ללקוח</Typography>
          </Box>
        </Box>

        {/* List */}
        {docs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ fontSize: 44, mb: 1, opacity: 0.5 }}>📋</Box>
            <Typography sx={{ color: c.text3, fontSize: 14 }}>עדיין אין מסמכים</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {docs.map((d) => {
              const { total } = docTotal(d);
              return (
                <Box key={d.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{d.type === 'receipt' ? '🧾' : '📄'}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>{d.type === 'receipt' ? 'קבלה' : 'הצעה'} #{d.number} · {d.customerName || 'ללא שם'}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{d.date} · ₪{total.toLocaleString()}</Typography>
                  </Box>
                  <Button onClick={() => setPreview(d)} size="small" sx={{ fontWeight: 600, color: c.accent }}>צפה</Button>
                  <Button onClick={() => setEditor(d)} size="small" sx={{ minWidth: 'auto', color: c.text2 }}>✎</Button>
                  <Button onClick={async () => { if (bizId) { await deleteDocument(bizId, d.id); await load(); } }} size="small" sx={{ minWidth: 'auto', color: c.hot }}>✕</Button>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Editor dialog */}
      <Dialog open={!!editor} onClose={() => setEditor(null)} PaperProps={{ sx: { borderRadius: 5, p: 3, maxWidth: 520, width: '100%' } }}>
        {editor && (
          <>
            <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>{editor.type === 'receipt' ? 'קבלה' : 'הצעת מחיר'} #{editor.number}</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <TextField fullWidth size="small" label="שם הלקוח" value={editor.customerName} onChange={(e) => setEditor({ ...editor, customerName: e.target.value })} />
              <TextField fullWidth size="small" label="טלפון" value={editor.customerPhone} onChange={(e) => setEditor({ ...editor, customerPhone: e.target.value })} />
            </Box>
            <TextField fullWidth size="small" type="date" label="תאריך" InputLabelProps={{ shrink: true }} value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} sx={{ mb: 2 }} />

            {/* Items */}
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>פריטים</Typography>
            {editor.items.map((it, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <TextField size="small" placeholder="תיאור" value={it.description} onChange={(e) => { const items = [...editor.items]; items[i] = { ...it, description: e.target.value }; setEditor({ ...editor, items }); }} sx={{ flex: 2 }} />
                <TextField size="small" type="number" placeholder="כמות" value={it.qty} onChange={(e) => { const items = [...editor.items]; items[i] = { ...it, qty: Number(e.target.value) }; setEditor({ ...editor, items }); }} sx={{ width: 70 }} />
                <TextField size="small" type="number" placeholder="₪" value={it.price} onChange={(e) => { const items = [...editor.items]; items[i] = { ...it, price: Number(e.target.value) }; setEditor({ ...editor, items }); }} sx={{ width: 90 }} />
                <Button onClick={() => setEditor({ ...editor, items: editor.items.filter((_, idx) => idx !== i) })} sx={{ minWidth: 'auto', color: c.hot }}>✕</Button>
              </Box>
            ))}
            <Button onClick={() => setEditor({ ...editor, items: [...editor.items, { description: '', qty: 1, price: 0 }] })} size="small" sx={{ color: c.accent, fontWeight: 600, mb: 2 }}>+ הוסף פריט</Button>

            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <TextField fullWidth size="small" type="number" label="הנחה ₪" value={editor.discount} onChange={(e) => setEditor({ ...editor, discount: Number(e.target.value) })} />
              <TextField select fullWidth size="small" label="מע״מ" value={editor.taxRate} onChange={(e) => setEditor({ ...editor, taxRate: Number(e.target.value) })}>
                <MenuItem value={0}>ללא מע״מ</MenuItem>
                <MenuItem value={18}>18% מע״מ</MenuItem>
              </TextField>
            </Box>
            <TextField fullWidth size="small" label="הערות" value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} multiline rows={2} sx={{ mb: 2 }} />

            <Box sx={{ bgcolor: c.surface2, borderRadius: 3, p: 2, mb: 2, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text }}>סה״כ: ₪{docTotal(editor).total.toLocaleString()}</Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => { setPreview(editor); }} variant="outlined" sx={{ flex: 1, borderRadius: 3, fontWeight: 600 }}>תצוגה מקדימה</Button>
              <Button onClick={saveDoc} variant="contained" disabled={saving} sx={{ flex: 1, borderRadius: 3, fontWeight: 700 }}>{saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור'}</Button>
            </Box>
          </>
        )}
      </Dialog>

      {/* Branding dialog */}
      <Dialog open={brandingOpen} onClose={() => setBrandingOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 3, maxWidth: 440, width: '100%' } }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>עיצוב המסמכים שלך</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {branding.logo ? <Box component="img" src={branding.logo} sx={{ width: 56, height: 56, borderRadius: 2, objectFit: 'contain', bgcolor: c.surface2 }} /> : <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖼️</Box>}
          <Button component="label" variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 600 }}>העלה לוגו<input type="file" accept="image/*" hidden onChange={handleLogo} /></Button>
        </Box>
        <TextField fullWidth size="small" label="שם העסק" value={branding.businessName} onChange={(e) => setBranding({ ...branding, businessName: e.target.value })} sx={{ mb: 1.5 }} />
        <TextField fullWidth size="small" label="ע.מ / ח.פ" value={branding.businessId} onChange={(e) => setBranding({ ...branding, businessId: e.target.value })} sx={{ mb: 1.5 }} />
        <TextField fullWidth size="small" label="כתובת" value={branding.address} onChange={(e) => setBranding({ ...branding, address: e.target.value })} sx={{ mb: 1.5 }} />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <TextField fullWidth size="small" label="טלפון" value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} />
          <TextField fullWidth size="small" label="אימייל" value={branding.email} onChange={(e) => setBranding({ ...branding, email: e.target.value })} />
        </Box>
        <TextField fullWidth size="small" label="טקסט תחתון" value={branding.footer} onChange={(e) => setBranding({ ...branding, footer: e.target.value })} sx={{ mb: 2 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text2, mb: 1 }}>צבע</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          {COLORS.map((col) => <Box key={col} onClick={() => setBranding({ ...branding, accentColor: col })} sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: col, cursor: 'pointer', border: branding.accentColor === col ? `3px solid ${c.text}` : '3px solid transparent' }} />)}
        </Box>
        <Button onClick={saveBrand} variant="contained" fullWidth disabled={saving} sx={{ borderRadius: 3, fontWeight: 700, py: 1.5 }}>{saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור עיצוב'}</Button>
      </Dialog>

      {/* Preview dialog — the actual branded document */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} PaperProps={{ sx: { borderRadius: 4, maxWidth: 500, width: '100%' } }}>
        {preview && branding && <DocPreview doc={preview} branding={branding} />}
      </Dialog>
    </Box>
  );
}

function DocPreview({ doc, branding }: { doc: BizDocument; branding: DocBranding }) {
  const { subtotal, tax, total } = docTotal(doc);
  const ac = branding.accentColor;
  return (
    <Box sx={{ direction: 'rtl' }}>
      {/* Header band */}
      <Box sx={{ background: `linear-gradient(135deg, ${ac}, ${ac}dd)`, color: '#fff', p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          {branding.logo && <Box component="img" src={branding.logo} sx={{ height: 44, mb: 1, borderRadius: 1, bgcolor: '#fff', p: 0.5 }} />}
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{branding.businessName}</Typography>
          {branding.businessId && <Typography sx={{ fontSize: 12, opacity: 0.85 }}>ע.מ {branding.businessId}</Typography>}
        </Box>
        <Box sx={{ textAlign: 'left' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{doc.type === 'receipt' ? 'קבלה' : 'הצעת מחיר'}</Typography>
          <Typography sx={{ fontSize: 13, opacity: 0.9 }}>#{doc.number}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.5 }}>{doc.date}</Typography>
        </Box>
      </Box>

      <Box sx={{ p: 3 }}>
        {/* Customer */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 11, color: c.text3, fontWeight: 700 }}>לכבוד</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{doc.customerName || '—'}</Typography>
          {doc.customerPhone && <Typography sx={{ fontSize: 13, color: c.text3 }}>{doc.customerPhone}</Typography>}
        </Box>

        {/* Items table */}
        <Box sx={{ border: `1px solid ${c.border}`, borderRadius: 2, overflow: 'hidden', mb: 2 }}>
          <Box sx={{ display: 'flex', bgcolor: c.surface2, px: 1.5, py: 1, fontSize: 12, fontWeight: 700, color: c.text2 }}>
            <Box sx={{ flex: 2 }}>תיאור</Box><Box sx={{ width: 50, textAlign: 'center' }}>כמות</Box><Box sx={{ width: 70, textAlign: 'left' }}>מחיר</Box><Box sx={{ width: 80, textAlign: 'left' }}>סה״כ</Box>
          </Box>
          {doc.items.map((it, i) => (
            <Box key={i} sx={{ display: 'flex', px: 1.5, py: 1.25, fontSize: 13, borderTop: `1px solid ${c.border}`, color: c.text }}>
              <Box sx={{ flex: 2 }}>{it.description || '—'}</Box><Box sx={{ width: 50, textAlign: 'center' }}>{it.qty}</Box><Box sx={{ width: 70, textAlign: 'left' }}>₪{it.price}</Box><Box sx={{ width: 80, textAlign: 'left', fontWeight: 700 }}>₪{(it.qty * it.price).toLocaleString()}</Box>
            </Box>
          ))}
        </Box>

        {/* Totals */}
        <Box sx={{ ml: 'auto', maxWidth: 220 }}>
          {doc.discount > 0 && <Row label="הנחה" value={`-₪${doc.discount}`} />}
          <Row label="ביניים" value={`₪${subtotal.toLocaleString()}`} />
          {doc.taxRate > 0 && <Row label={`מע״מ ${doc.taxRate}%`} value={`₪${tax.toLocaleString()}`} />}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${ac}`, mt: 1, pt: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>סה״כ</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: ac }}>₪{total.toLocaleString()}</Typography>
          </Box>
        </Box>

        {doc.notes && <Typography sx={{ fontSize: 12.5, color: c.text2, mt: 2, bgcolor: c.surface2, borderRadius: 2, p: 1.5 }}>{doc.notes}</Typography>}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: `1px solid ${c.border}` }}>
          <Typography sx={{ fontSize: 13, color: ac, fontWeight: 600 }}>{branding.footer}</Typography>
          <Typography sx={{ fontSize: 11, color: c.text3, mt: 0.5 }}>
            {[branding.phone, branding.email, branding.address].filter(Boolean).join(' · ')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
          <Button onClick={() => window.print()} variant="contained" fullWidth sx={{ borderRadius: 3, fontWeight: 700, bgcolor: ac, '&:hover': { bgcolor: ac } }}>🖨️ הדפס / שמור PDF</Button>
          {doc.customerPhone && <Button href={`https://wa.me/972${doc.customerPhone.replace(/^0/, '')}`} target="_blank" variant="outlined" sx={{ borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>שלח</Button>}
        </Box>
      </Box>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
      <Typography sx={{ fontSize: 13, color: c.text2 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: c.text, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
