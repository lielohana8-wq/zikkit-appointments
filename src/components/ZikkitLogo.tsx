'use client';

import { Box, Typography } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

/**
 * Zikkit logo — a minimalist "Z" mark in a rounded squircle,
 * inspired by premium app icons (Apple-style).
 */
export function ZikkitLogo({ size = 32, showText = true, textColor }: { size?: number; showText?: boolean; textColor?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="zikGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9061F9" />
              <stop offset="1" stopColor="#6D28D9" />
            </linearGradient>
          </defs>
          {/* Squircle */}
          <rect width="40" height="40" rx="11" fill="url(#zikGrad)" />
          {/* Stylized Z — sharp, geometric */}
          <path d="M13 13.5H27L15 24.5H27" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          {/* subtle dot — the appointment "moment" */}
          <circle cx="27" cy="27.5" r="2.2" fill="white" />
        </svg>
      </Box>
      {showText && (
        <Typography sx={{ fontFamily: "'Heebo', sans-serif", fontWeight: 800, fontSize: size * 0.56, letterSpacing: '-0.03em', color: textColor || c.text, lineHeight: 1 }}>
          Zikkit
        </Typography>
      )}
    </Box>
  );
}
