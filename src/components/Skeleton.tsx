'use client';

import { Box } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

const shimmer = {
  background: `linear-gradient(90deg, ${c.surface3} 25%, ${c.surface4} 50%, ${c.surface3} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'zkShimmer 1.4s ease-in-out infinite',
  '@keyframes zkShimmer': {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' },
  },
};

export function SkeletonBox({ width = '100%', height = 20, radius = 8, mb = 0 }: { width?: string | number; height?: number; radius?: number; mb?: number }) {
  return <Box sx={{ ...shimmer, width, height, borderRadius: `${radius}px`, mb }} />;
}

// A page-level skeleton that mimics a typical list page (header + rows)
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.canvas }}>
      {/* header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.card }}>
        <SkeletonBox width={80} height={20} />
        <SkeletonBox width={120} height={22} />
        <SkeletonBox width={70} height={36} radius={99} />
      </Box>
      <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <SkeletonBox height={48} radius={99} mb={24} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <Box key={i} sx={{ bgcolor: c.card, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <SkeletonBox width={46} height={46} radius={23} />
              <Box sx={{ flex: 1 }}>
                <SkeletonBox width="55%" height={16} mb={8} />
                <SkeletonBox width="35%" height={13} />
              </Box>
              <SkeletonBox width={50} height={40} radius={10} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
