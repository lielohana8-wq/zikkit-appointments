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
      <Dialog open={!!editor} onClose={() => setEditor(null)} PaperProps={{ sx: { borderRadius: 5, p: 3, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' } }}>
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

      {/* Branding dialog — deep design */}
      <Dialog open={brandingOpen} onClose={() => setBrandingOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 3, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 2.5, color: c.text }}>עיצוב המסמכים שלך</Typography>

        {/* Template chooser */}
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text2, mb: 1 }}>סגנון</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2.5 }}>
          {[
            { id: 'modern', label: 'מודרני', icon: '▰' },
            { id: 'classic', label: 'קלאסי', icon: '═' },
            { id: 'minimal', label: 'מינימלי', icon: '─' },
            { id: 'bold', label: 'נועז', icon: '█' },
          ].map((t) => (
            <Box key={t.id} onClick={() => setBranding({ ...branding, template: t.id })} sx={{ cursor: 'pointer', textAlign: 'center', py: 1.25, borderRadius: 2.5, bgcolor: branding.template === t.id ? c.accentDim : c.surface2, border: `2px solid ${branding.template === t.id ? c.accent : 'transparent'}` }}>
              <Box sx={{ fontSize: 18, color: branding.template === t.id ? c.accent : c.text3, lineHeight: 1 }}>{t.icon}</Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: branding.template === t.id ? c.accent : c.text2, mt: 0.5 }}>{t.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {branding.logo ? <Box component="img" src={branding.logo} sx={{ width: 52, height: 52, borderRadius: 2, objectFit: 'contain', bgcolor: c.surface2 }} /> : <Box sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼️</Box>}
          <Button component="label" variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 600 }}>העלה לוגו<input type="file" accept="image/*" hidden onChange={handleLogo} /></Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>הצג לוגו</Typography>
            <input type="checkbox" checked={branding.showLogo} onChange={(e) => setBranding({ ...branding, showLogo: e.target.checked })} />
          </Box>
        </Box>

        <TextField fullWidth size="small" label="שם העסק" value={branding.businessName} onChange={(e) => setBranding({ ...branding, businessName: e.target.value })} sx={{ mb: 1.5 }} />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <TextField fullWidth size="small" label="ע.מ / ח.פ" value={branding.businessId} onChange={(e) => setBranding({ ...branding, businessId: e.target.value })} />
          <TextField fullWidth size="small" label="טלפון" value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <TextField fullWidth size="small" label="כתובת" value={branding.address} onChange={(e) => setBranding({ ...branding, address: e.target.value })} />
          <TextField fullWidth size="small" label="אימייל" value={branding.email} onChange={(e) => setBranding({ ...branding, email: e.target.value })} />
        </Box>
        <TextField fullWidth size="small" label="טקסט תחתון / תודה" value={branding.footer} onChange={(e) => setBranding({ ...branding, footer: e.target.value })} sx={{ mb: 1.5 }} />

        {/* Signature */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: branding.showSignature ? 1.5 : 2 }}>
          <input type="checkbox" checked={branding.showSignature} onChange={(e) => setBranding({ ...branding, showSignature: e.target.checked })} />
          <Typography sx={{ fontSize: 13, color: c.text2 }}>הוסף שורת חתימה</Typography>
        </Box>
        {branding.showSignature && <TextField fullWidth size="small" label="שם החותם" value={branding.signatureName} onChange={(e) => setBranding({ ...branding, signatureName: e.target.value })} sx={{ mb: 2 }} />}

        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text2, mb: 1 }}>צבע מותג</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          {COLORS.map((col) => <Box key={col} onClick={() => setBranding({ ...branding, accentColor: col })} sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: col, cursor: 'pointer', border: branding.accentColor === col ? `3px solid ${c.text}` : '3px solid transparent' }} />)}
        </Box>

        {/* Live mini preview */}
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text2, mb: 1 }}>תצוגה מקדימה חיה</Typography>
        <Box sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${c.border}`, mb: 2.5, transform: 'scale(1)', transformOrigin: 'top' }}>
          <DocPreview doc={sampleDoc} branding={branding} compact />
        </Box>

        <Button onClick={saveBrand} variant="contained" fullWidth disabled={saving} sx={{ borderRadius: 3, fontWeight: 700, py: 1.5 }}>{saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור עיצוב'}</Button>
      </Dialog>

      {/* Preview dialog — the actual branded document */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} PaperProps={{ sx: { borderRadius: 4, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' } }}>
        {preview && branding && <DocPreview doc={preview} branding={branding} />}
      </Dialog>
    </Box>
  );
}

const sampleDoc: BizDocument = {
  id: 'sample', type: 'receipt', number: '001', customerName: 'ישראל ישראלי', customerPhone: '050-1234567',
  date: new Date().toISOString().split('T')[0], items: [{ description: 'תספורת', qty: 1, price: 80 }, { description: 'צבע', qty: 1, price: 200 }],
  discount: 0, taxRate: 0, notes: '', status: 'paid', createdAt: '',
};

function DocPreview({ doc, branding, compact }: { doc: BizDocument; branding: DocBranding; compact?: boolean }) {
  const { subtotal, tax, total } = docTotal(doc);
  const ac = branding.accentColor;
  const tmpl = branding.template || 'modern';
  const docTitle = doc.type === 'receipt' ? 'קבלה' : 'הצעת מחיר';
  const pad = compact ? 2 : 3;

  // Header varies by template
  const Header = () => {
    if (tmpl === 'minimal') {
      return (
        <Box sx={{ px: pad, pt: pad, pb: 1.5, borderBottom: `2px solid ${ac}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Box>
              {branding.showLogo && branding.logo && <Box component="img" src={branding.logo} sx={{ height: compact ? 28 : 38, mb: 0.5, objectFit: 'contain' }} />}
              <Typography sx={{ fontSize: compact ? 16 : 20, fontWeight: 800, color: c.text }}>{branding.businessName}</Typography>
              {branding.businessId && <Typography sx={{ fontSize: 11, color: c.text3 }}>ע.מ {branding.businessId}</Typography>}
            </Box>
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontSize: compact ? 14 : 17, fontWeight: 800, color: ac }}>{docTitle}</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>#{doc.number} · {doc.date}</Typography>
            </Box>
          </Box>
        </Box>
      );
    }
    if (tmpl === 'classic') {
      return (
        <Box sx={{ px: pad, pt: pad, pb: 1.5, textAlign: 'center', borderBottom: `1px solid ${c.border}` }}>
          {branding.showLogo && branding.logo && <Box component="img" src={branding.logo} sx={{ height: compact ? 32 : 46, mb: 0.5, objectFit: 'contain' }} />}
          <Typography sx={{ fontSize: compact ? 18 : 24, fontWeight: 800, color: c.text, letterSpacing: '-0.01em' }}>{branding.businessName}</Typography>
          <Typography sx={{ fontSize: 11, color: c.text3 }}>{[branding.businessId && `ע.מ ${branding.businessId}`, branding.phone, branding.address].filter(Boolean).join(' · ')}</Typography>
          <Box sx={{ display: 'inline-block', mt: 1, px: 2, py: 0.5, border: `1.5px solid ${ac}`, borderRadius: 1, color: ac, fontWeight: 800, fontSize: compact ? 13 : 15 }}>{docTitle} #{doc.number}</Box>
        </Box>
      );
    }
    if (tmpl === 'bold') {
      return (
        <Box sx={{ bgcolor: ac, color: '#fff', p: pad }}>
          {branding.showLogo && branding.logo && <Box component="img" src={branding.logo} sx={{ height: compact ? 30 : 42, mb: 1, borderRadius: 1, bgcolor: '#fff', p: 0.5 }} />}
          <Typography sx={{ fontSize: compact ? 22 : 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{branding.businessName}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 1.5 }}>
            <Typography sx={{ fontSize: 12, opacity: 0.9 }}>{branding.businessId && `ע.מ ${branding.businessId}`}</Typography>
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontSize: compact ? 15 : 18, fontWeight: 800 }}>{docTitle}</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.85 }}>#{doc.number} · {doc.date}</Typography>
            </Box>
          </Box>
        </Box>
      );
    }
    // modern (default) — gradient band
    return (
      <Box sx={{ background: `linear-gradient(135deg, ${ac}, ${ac}cc)`, color: '#fff', p: pad, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          {branding.showLogo && branding.logo && <Box component="img" src={branding.logo} sx={{ height: compact ? 30 : 44, mb: 1, borderRadius: 1, bgcolor: '#fff', p: 0.5 }} />}
          <Typography sx={{ fontSize: compact ? 16 : 20, fontWeight: 800 }}>{branding.businessName}</Typography>
          {branding.businessId && <Typography sx={{ fontSize: 12, opacity: 0.85 }}>ע.מ {branding.businessId}</Typography>}
        </Box>
        <Box sx={{ textAlign: 'left' }}>
          <Typography sx={{ fontSize: compact ? 14 : 16, fontWeight: 800 }}>{docTitle}</Typography>
          <Typography sx={{ fontSize: 13, opacity: 0.9 }}>#{doc.number}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.8, mt: 0.5 }}>{doc.date}</Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ direction: 'rtl', bgcolor: '#fff' }}>
      <Header />

      <Box sx={{ p: pad }}>
        {/* Customer */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 10.5, color: c.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>לכבוד</Typography>
          <Typography sx={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: c.text }}>{doc.customerName || '—'}</Typography>
          {doc.customerPhone && <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{doc.customerPhone}</Typography>}
        </Box>

        {/* Items */}
        <Box sx={{ border: `1px solid ${c.border}`, borderRadius: 2.5, overflow: 'hidden', mb: 2 }}>
          <Box sx={{ display: 'flex', bgcolor: tmpl === 'minimal' ? c.surface2 : `${ac}12`, px: 1.5, py: 1, fontSize: 11.5, fontWeight: 700, color: tmpl === 'minimal' ? c.text2 : ac }}>
            <Box sx={{ flex: 2 }}>תיאור</Box><Box sx={{ width: 45, textAlign: 'center' }}>כמות</Box><Box sx={{ width: 60, textAlign: 'left' }}>מחיר</Box><Box sx={{ width: 70, textAlign: 'left' }}>סה״כ</Box>
          </Box>
          {doc.items.map((it, i) => (
            <Box key={i} sx={{ display: 'flex', px: 1.5, py: 1.1, fontSize: 12.5, borderTop: `1px solid ${c.border}`, color: c.text }}>
              <Box sx={{ flex: 2 }}>{it.description || '—'}</Box><Box sx={{ width: 45, textAlign: 'center' }}>{it.qty}</Box><Box sx={{ width: 60, textAlign: 'left' }}>₪{it.price}</Box><Box sx={{ width: 70, textAlign: 'left', fontWeight: 700 }}>₪{(it.qty * it.price).toLocaleString()}</Box>
            </Box>
          ))}
        </Box>

        {/* Totals */}
        <Box sx={{ ml: 'auto', maxWidth: 220 }}>
          {doc.discount > 0 && <Row label="הנחה" value={`-₪${doc.discount}`} />}
          {doc.taxRate > 0 && <><Row label="ביניים" value={`₪${subtotal.toLocaleString()}`} /><Row label={`מע״מ ${doc.taxRate}%`} value={`₪${tax.toLocaleString()}`} /></>}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: `${ac}10`, borderRadius: 2, px: 1.5, py: 1, mt: 1 }}>
            <Typography sx={{ fontSize: compact ? 14 : 16, fontWeight: 800, color: c.text }}>סה״כ לתשלום</Typography>
            <Typography sx={{ fontSize: compact ? 16 : 19, fontWeight: 900, color: ac, letterSpacing: '-0.02em' }}>₪{total.toLocaleString()}</Typography>
          </Box>
        </Box>

        {doc.notes && <Typography sx={{ fontSize: 12, color: c.text2, mt: 2, bgcolor: c.surface2, borderRadius: 2, p: 1.5 }}>{doc.notes}</Typography>}

        {/* Signature */}
        {branding.showSignature && !compact && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-start' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ borderTop: `1px solid ${c.text3}`, width: 140, pt: 0.5 }}>
                <Typography sx={{ fontSize: 11, color: c.text3 }}>{branding.signatureName || 'חתימה'}</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: compact ? 2 : 3, pt: 1.5, borderTop: `1px solid ${c.border}` }}>
          <Typography sx={{ fontSize: 12.5, color: ac, fontWeight: 700 }}>{branding.footer}</Typography>
          {!compact && <Typography sx={{ fontSize: 10.5, color: c.text3, mt: 0.5 }}>{[branding.phone, branding.email, branding.address].filter(Boolean).join(' · ')}</Typography>}
        </Box>

        {!compact && (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
            <Button onClick={() => window.print()} variant="contained" fullWidth sx={{ borderRadius: 3, fontWeight: 700, bgcolor: ac, '&:hover': { bgcolor: ac, filter: 'brightness(0.92)' } }}>🖨️ הדפס / PDF</Button>
            {doc.customerPhone && <Button href={`https://wa.me/972${doc.customerPhone.replace(/^0/, '')}`} target="_blank" variant="outlined" sx={{ borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>שלח</Button>}
          </Box>
        )}
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
