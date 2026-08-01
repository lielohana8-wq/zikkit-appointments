'use client';

import { Box, Typography, Button } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

/**
 * Shared premium UI primitives — consistent StatCard, EmptyState, and Skeleton
 * across the app so every screen shares the same polished vocabulary.
 * Purely presentational; no business logic.
 */

// ── Skeleton loader ──
export function Skeleton({ width = '100%', height = 20, radius = 8, mb = 0 }: { width?: number | string; height?: number | string; radius?: number; mb?: number }) {
  return <Box className="zk-skeleton" sx={{ width, height, borderRadius: `${radius}px`, mb }} />;
}

export function SkeletonCard() {
  return (
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
      <Skeleton width={80} height={12} mb={1.5} />
      <Skeleton width={120} height={32} mb={1} />
      <Skeleton width="60%" height={12} />
    </Box>
  );
}

// ── Stat card ──
export function StatCard({ label, value, icon, accent, sublabel }: { label: string; value: string | number; icon?: string; accent?: boolean; sublabel?: string }) {
  return (
    <Box className="zk-card" sx={{ bgcolor: accent ? c.accent : c.surface1, border: `1px solid ${accent ? c.accent : c.border2}`, borderRadius: 3, p: { xs: 2, sm: 2.5 } }}>
      {icon && <Box sx={{ fontSize: 20, mb: 1 }}>{icon}</Box>}
      <Typography sx={{ fontSize: { xs: 26, sm: 32 }, fontWeight: 900, color: accent ? '#fff' : c.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ fontSize: 11.5, color: accent ? 'rgba(255,255,255,0.85)' : c.text3, mt: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
      {sublabel && <Typography sx={{ fontSize: 12, color: accent ? 'rgba(255,255,255,0.7)' : c.text3, mt: 0.5 }}>{sublabel}</Typography>}
    </Box>
  );
}

// ── Empty state ──
export function EmptyState({ icon = '✨', title, description, ctaLabel, onCta }: { icon?: string; title: string; description?: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <Box className="zk-fade" sx={{ textAlign: 'center', py: { xs: 6, sm: 9 }, px: 3 }}>
      <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, mx: 'auto', mb: 2.5 }}>{icon}</Box>
      <Typography sx={{ fontSize: 19, fontWeight: 800, color: c.text, letterSpacing: '-0.02em', mb: 1 }}>{title}</Typography>
      {description && <Typography sx={{ fontSize: 14, color: c.text3, maxWidth: 320, mx: 'auto', lineHeight: 1.55, mb: ctaLabel ? 3 : 0 }}>{description}</Typography>}
      {ctaLabel && onCta && (
        <Button onClick={onCta} variant="contained" sx={{ borderRadius: 2.5, fontWeight: 800, py: 1.25, px: 3 }}>{ctaLabel}</Button>
      )}
    </Box>
  );
}
