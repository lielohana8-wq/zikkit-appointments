'use client';

import { createTheme } from '@mui/material/styles';

// ZikkitAppointments — monochrome editorial design.
// Sharp lines, big type, near-black & white, purple used ONLY as a punctuation accent.
export const zikkitColors = {
  bg: 'var(--zk-bg)',
  bg2: 'var(--zk-bg2)',
  surface1: 'var(--zk-surface1)',
  surface2: 'var(--zk-surface2)',
  surface3: 'var(--zk-surface3)',
  surface4: 'var(--zk-surface4)',
  border: 'var(--zk-border)',
  border2: 'var(--zk-border2)',
  text: 'var(--zk-text)',
  text2: 'var(--zk-text2)',
  text3: 'var(--zk-text3)',
  accent: '#7C3AED',
  accent2: '#9061F9',
  accent3: '#6D28D9',
  accentDeep: '#5B21B6',
  accentDim: 'var(--zk-accent-dim)',
  accentMid: 'var(--zk-accent-mid)',
  hot: '#E5484D',
  hotDim: 'var(--zk-hot-dim)',
  green: '#30A46C',
  greenDim: 'var(--zk-green-dim)',
  amber: '#FFB224',
  shadowSm: 'var(--zk-shadow-sm)',
  shadowMd: 'var(--zk-shadow-md)',
  shadowLg: 'var(--zk-shadow-lg)',
  shadowAccent: 'none',
};

// Monochrome palette. Shadows are nearly gone — we use crisp 1px borders instead.
export const THEME_CSS = `
:root, [data-theme="light"] {
  --zk-bg: #FFFFFF; --zk-bg2: #FAFAFA;
  --zk-surface1: #FFFFFF; --zk-surface2: #FAFAFA; --zk-surface3: #F2F2F2; --zk-surface4: #E5E5E5;
  --zk-border: #1A1A1A; --zk-border2: #E2E2E2;
  --zk-text: #0A0A0A; --zk-text2: #4A4A4A; --zk-text3: #8A8A8A;
  --zk-accent-dim: rgba(124,58,237,0.08); --zk-accent-mid: rgba(124,58,237,0.16);
  --zk-hot-dim: rgba(229,72,77,0.08); --zk-green-dim: rgba(48,164,108,0.10);
  --zk-shadow-sm: none; --zk-shadow-md: none; --zk-shadow-lg: 0 24px 60px rgba(0,0,0,0.12); --zk-blur: rgba(255,255,255,0.85);
}
[data-theme="dark"] {
  --zk-bg: #000000; --zk-bg2: #0A0A0A;
  --zk-surface1: #0D0D0D; --zk-surface2: #0A0A0A; --zk-surface3: #161616; --zk-surface4: #242424;
  --zk-border: #F0F0F0; --zk-border2: #262626;
  --zk-text: #FAFAFA; --zk-text2: #A0A0A0; --zk-text3: #5A5A5A;
  --zk-accent-dim: rgba(144,97,249,0.16); --zk-accent-mid: rgba(144,97,249,0.26);
  --zk-hot-dim: rgba(229,72,77,0.18); --zk-green-dim: rgba(48,164,108,0.18);
  --zk-shadow-sm: none; --zk-shadow-md: none; --zk-shadow-lg: 0 24px 60px rgba(0,0,0,0.6); --zk-blur: rgba(0,0,0,0.85);
}
body { background: var(--zk-bg); transition: background 0.3s ease; }
::selection { background: #7C3AED; color: #fff; }

/* ---- Interaction polish (applies app-wide) ---- */
.zk-page { animation: zkPageIn 0.42s cubic-bezier(0.16,1,0.3,1) both; }
@keyframes zkPageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.zk-lift { transition: transform 0.18s cubic-bezier(0.16,1,0.3,1), border-color 0.18s ease, box-shadow 0.18s ease; }
.zk-lift:hover { transform: translateY(-3px); border-color: var(--zk-border) !important; }
.zk-stagger > * { animation: zkPageIn 0.42s cubic-bezier(0.16,1,0.3,1) both; }
.zk-stagger > *:nth-child(1){animation-delay:.02s} .zk-stagger > *:nth-child(2){animation-delay:.06s}
.zk-stagger > *:nth-child(3){animation-delay:.1s} .zk-stagger > *:nth-child(4){animation-delay:.14s}
.zk-stagger > *:nth-child(5){animation-delay:.18s} .zk-stagger > *:nth-child(6){animation-delay:.22s}
.zk-stagger > *:nth-child(7){animation-delay:.26s} .zk-stagger > *:nth-child(8){animation-delay:.3s}
@media (prefers-reduced-motion: reduce) { .zk-page, .zk-stagger > *, .zk-lift { animation: none !important; transition: none !important; } }
`;

// NOTE: --zk-border is near-black (light) / near-white (dark) — this is the SHARP LINE look.
// --zk-border2 is the subtle hairline for less-important separators.

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: { main: '#7C3AED' },
    error: { main: '#E5484D' },
    success: { main: '#30A46C' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    text: { primary: '#0A0A0A', secondary: '#4A4A4A' },
  },
  typography: {
    fontFamily: "'Heebo', 'Assistant', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    h1: { fontWeight: 900, letterSpacing: '-0.04em' },
    h2: { fontWeight: 900, letterSpacing: '-0.035em' },
    h3: { fontWeight: 800, letterSpacing: '-0.03em' },
    button: { fontWeight: 700, letterSpacing: '-0.01em' },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, borderRadius: 6, padding: '9px 20px', transition: 'transform 0.12s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease', '&:active': { transform: 'scale(0.97)' } },
        containedPrimary: { background: '#7C3AED', boxShadow: 'none', '&:hover': { background: '#6D28D9', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' } },
        outlined: { borderColor: 'var(--zk-border)', borderWidth: 1.5, color: 'var(--zk-text)', '&:hover': { borderColor: 'var(--zk-border)', borderWidth: 1.5, background: 'var(--zk-text)', color: 'var(--zk-bg)' } },
        text: { color: 'var(--zk-text)', '&:hover': { background: 'var(--zk-surface3)' } },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6, backgroundColor: 'var(--zk-surface1)', color: 'var(--zk-text)', transition: 'all 0.18s',
            '& fieldset': { borderColor: 'var(--zk-border2)', borderWidth: 1.5 },
            '&:hover fieldset': { borderColor: 'var(--zk-text2)' },
            '&.Mui-focused fieldset': { borderColor: 'var(--zk-border)', borderWidth: 1.5 },
          },
          '& .MuiInputLabel-root': { color: 'var(--zk-text3)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: 'var(--zk-surface1)', color: 'var(--zk-text)' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 8, border: '1.5px solid var(--zk-border)', boxShadow: 'var(--zk-shadow-lg)' } } },
    MuiMenu: { styleOverrides: { paper: { backgroundColor: 'var(--zk-surface1)', color: 'var(--zk-text)', border: '1.5px solid var(--zk-border)', borderRadius: 8 } } },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        switchBase: { '&.Mui-checked': { color: '#fff', '& + .MuiSwitch-track': { backgroundColor: '#7C3AED', opacity: 1 } } },
        thumb: { boxShadow: 'none' },
        track: { borderRadius: 22, backgroundColor: 'var(--zk-surface4)', opacity: 1 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 700, borderRadius: 4 } } },
  },
});
