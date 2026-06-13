'use client';

import { Box, Typography } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

/**
 * Zikkit logo — a calendar mark with an integrated "Z", matching the brand.
 * Set `useImage` to render the uploaded PNG from /public/logo.png instead of the SVG.
 */
export function ZikkitLogo({
  size = 32,
  showText = true,
  textColor,
  subtitle = false,
  useImage = false,
}: {
  size?: number;
  showText?: boolean;
  textColor?: string;
  subtitle?: boolean;
  useImage?: boolean;
}) {
  if (useImage) {
    // Full uploaded lockup (icon + text together)
    return <Box component="img" src="/logo.png" alt="Zikkit Appointments" sx={{ height: size * 1.4, width: 'auto', display: 'block' }} />;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="zikGrad" x1="6" y1="8" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA" />
              <stop offset="0.5" stopColor="#7C3AED" />
              <stop offset="1" stopColor="#5B21B6" />
            </linearGradient>
          </defs>
          {/* Calendar tabs on top */}
          <rect x="15" y="6" width="3.4" height="8" rx="1.7" fill="url(#zikGrad)" />
          <rect x="29.6" y="6" width="3.4" height="8" rx="1.7" fill="url(#zikGrad)" />
          {/* Calendar body — rounded square outline */}
          <rect x="8.5" y="10.5" width="31" height="31" rx="9" stroke="url(#zikGrad)" strokeWidth="3.4" fill="none" />
          {/* Z in Heebo — same typeface as the wordmark */}
          <text x="24" y="33.5" textAnchor="middle" fill="url(#zikGrad)" fontFamily="'Heebo', sans-serif" fontWeight="800" fontSize="22" letterSpacing="-0.02em">Z</text>
        </svg>
      </Box>
      {showText && (
        <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <Typography sx={{ fontFamily: "'Heebo', sans-serif", fontWeight: 800, fontSize: size * 0.6, letterSpacing: '-0.03em', background: `linear-gradient(120deg, ${c.accent2}, ${c.accentDeep})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
            Zikkit
          </Typography>
          {subtitle && (
            <Typography sx={{ fontFamily: "'Heebo', sans-serif", fontWeight: 600, fontSize: size * 0.26, letterSpacing: '0.18em', color: c.text3, mt: 0.3, textTransform: 'uppercase' }}>
              Appointments
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
