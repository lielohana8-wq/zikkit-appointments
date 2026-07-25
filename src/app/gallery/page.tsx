'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getGallery, addGalleryImage, removeGalleryImage } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

export default function GalleryPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const imgs = await getGallery(bizId);
      setImages(imgs);
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !bizId) return;
    setUploading(true);
    try {
      // Upload every selected image, one after the other
      let updated: string[] = images;
      for (const file of files) {
        const dataUrl = await downscale(file, 900, 0.7); // keep under Firestore limits
        updated = await addGalleryImage(bizId, dataUrl);
      }
      setImages(updated);
      if (files.length > 1) showToast(`${files.length} תמונות הועלו`, 'success');
    } catch (err) {
      showToast((err as Error).message || 'שגיאה', 'error');
    } finally { setUploading(false); e.target.value = ''; }
  };

  const remove = async (index: number) => {
    if (!bizId) return;
    const updated = await removeGalleryImage(bizId, index);
    setImages(updated);
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.canvas }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.chrome, backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 600, color: c.text }}>גלריית עבודות</Typography>
        <Box sx={{ width: 80 }} />
      </Box>

      <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <Box sx={{ bgcolor: c.card, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box sx={{ fontSize: 22 }}>🖼️</Box>
          <Typography sx={{ fontSize: 12.5, color: c.text2, lineHeight: 1.5, flex: 1 }}>
            התמונות שתעלה כאן יופיעו בדף הנחיתה האוטומטי של העסק (עד 12).
          </Typography>
        </Box>

        <Button component="label" variant="contained" disabled={uploading || images.length >= 12} fullWidth sx={{ borderRadius: 1.5, fontWeight: 500, mb: 3, py: 1.4, borderStyle: 'dashed' }}>
          {uploading ? <><CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} />מעלה...</> : `📷 העלה תמונה (${images.length}/12)`}
          <input type="file" accept="image/*" multiple hidden onChange={handleFile} />
        </Button>

        {images.length > 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
            {images.map((img, i) => (
              <Box key={i} sx={{ position: 'relative', borderRadius: 1.5, '&:hover .del': { opacity: 1 } }}>
                <Box component="img" src={img} sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 3 }} />
                <Button onClick={() => remove(i)} className="del" sx={{ position: 'absolute', top: 6, left: 6, minWidth: 'auto', width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', opacity: 0, transition: 'opacity 0.2s', '&:hover': { bgcolor: c.hot } }}>✕</Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 7, color: c.text3 }}>
            <Box sx={{ fontSize: 40, mb: 1, opacity: 0.5 }}>🖼️</Box>
            <Typography sx={{ fontSize: 14 }}>עדיין אין תמונות בגלריה</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Downscale image client-side to a data URL (keeps Firestore docs small)
function downscale(file: File, maxW: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
