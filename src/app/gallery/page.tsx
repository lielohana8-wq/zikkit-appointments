'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

export default function GalleryPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const res = await fetch(`/api/gallery?bizId=${bizId}`);
      const data = await res.json();
      if (data.success) setImages(data.images);
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bizId) return;
    setUploading(true);
    // Downscale to keep under Firestore limits
    const dataUrl = await downscale(file, 900, 0.7);
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, action: 'add', imageUrl: dataUrl }),
      });
      const data = await res.json();
      if (data.success) setImages(data.images);
      else alert(data.error || 'שגיאה');
    } finally { setUploading(false); }
  };

  const remove = async (index: number) => {
    if (!bizId) return;
    const res = await fetch('/api/gallery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bizId, action: 'remove', index }),
    });
    const data = await res.json();
    if (data.success) setImages(data.images);
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>גלריית עבודות</Typography>
        <Box sx={{ width: 80 }} />
      </Box>

      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Typography sx={{ fontSize: 14, color: c.text2, mb: 3 }}>
          התמונות שתעלה כאן יופיעו בדף הנחיתה האוטומטי של העסק. (עד 12 תמונות)
        </Typography>

        <Button component="label" variant="contained" disabled={uploading || images.length >= 12} sx={{ borderRadius: 3, fontWeight: 700, mb: 3 }}>
          {uploading ? <><CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} />מעלה...</> : '📷 העלה תמונה'}
          <input type="file" accept="image/*" hidden onChange={handleFile} />
        </Button>

        {images.length > 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2 }}>
            {images.map((img, i) => (
              <Box key={i} sx={{ position: 'relative', '&:hover .del': { opacity: 1 } }}>
                <Box component="img" src={img} sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 3 }} />
                <Button onClick={() => remove(i)} className="del" sx={{ position: 'absolute', top: 4, left: 4, minWidth: 'auto', width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', opacity: 0, transition: 'opacity 0.2s', '&:hover': { bgcolor: c.hot } }}>✕</Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6, color: c.text3 }}>
            <Box sx={{ fontSize: 48, mb: 1 }}>🖼️</Box>
            <Typography>עדיין אין תמונות בגלריה</Typography>
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
