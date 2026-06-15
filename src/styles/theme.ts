'use client';

import { createTheme } from '@mui/material/styles';

// ZikkitAppointments — premium, minimalist, Apple-inspired.
// Colors reference CSS variables so we can switch light/dark at runtime.
// The variable values are defined in globals (see ThemeVars below / layout).
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
  shadowAccent: '0 8px 24px rgba(124,58,237,0.24)',
};

// CSS injected once — defines the variables for light (default) and dark.
export const THEME_CSS = `
:root, [data-theme="light"] {
  --zk-bg: #FAFAFA; --zk-bg2: #F4F4F5;
  --zk-surface1: #FFFFFF; --zk-surface2: #FAFAFA; --zk-surface3: #F4F4F5; --zk-surface4: #E9E9EB;
  --zk-border: #ECECEE; --zk-border2: #E0E0E3;
  --zk-text: #111113; --zk-text2: #5E5E66; --zk-text3: #9A9AA2;
  --zk-accent-dim: rgba(124,58,237,0.06); --zk-accent-mid: rgba(124,58,237,0.12);
  --zk-hot-dim: rgba(229,72,77,0.07); --zk-green-dim: rgba(48,164,108,0.08);
  --zk-shadow-sm: 0 1px 2px rgba(17,17,19,0.04), 0 1px 3px rgba(17,17,19,0.03);
  --zk-shadow-md: 0 2px 8px rgba(17,17,19,0.04), 0 4px 16px rgba(17,17,19,0.04);
  --zk-shadow-lg: 0 8px 30px rgba(17,17,19,0.08), 0 2px 8px rgba(17,17,19,0.04);
}
[data-theme="dark"] {
  --zk-bg: #0E0E11; --zk-bg2: #16161A;
  --zk-surface1: #1A1A1F; --zk-surface2: #16161A; --zk-surface3: #222228; --zk-surface4: #2E2E36;
  --zk-border: #2A2A31; --zk-border2: #36363F;
  --zk-text: #F4F4F6; --zk-text2: #A9A9B4; --zk-text3: #6E6E78;
  --zk-accent-dim: rgba(144,97,249,0.14); --zk-accent-mid: rgba(144,97,249,0.22);
  --zk-hot-dim: rgba(229,72,77,0.16); --zk-green-dim: rgba(48,164,108,0.16);
  --zk-shadow-sm: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2);
  --zk-shadow-md: 0 2px 8px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.25);
  --zk-shadow-lg: 0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
}
body { background: var(--zk-bg); transition: background 0.3s ease; }
`;

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: { main: '#7C3AED' },
    error: { main: '#E5484D' },
    success: { main: '#30A46C' },
    background: { default: '#FAFAFA', paper: '#FFFFFF' },
    text: { primary: '#111113', secondary: '#5E5E66' },
  },
  typography: {
    fontFamily: "'Heebo', 'Assistant', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    h1: { fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontWeight: 800, letterSpacing: '-0.025em' },
    h3: { fontWeight: 700, letterSpacing: '-0.02em' },
    button: { fontWeight: 600, letterSpacing: '-0.01em' },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 12, padding: '8px 18px', transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)' },
        containedPrimary: { background: '#7C3AED', boxShadow: 'none', '&:hover': { background: '#6D28D9', boxShadow: '0 8px 24px rgba(124,58,237,0.24)' } },
        outlined: { borderColor: 'var(--zk-border2)', color: 'var(--zk-text)', '&:hover': { borderColor: '#7C3AED', background: 'var(--zk-accent-dim)' } },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12, backgroundColor: 'var(--zk-surface1)', color: 'var(--zk-text)', transition: 'all 0.2s',
            '& fieldset': { borderColor: 'var(--zk-border2)' },
            '&:hover fieldset': { borderColor: 'var(--zk-text3)' },
            '&.Mui-focused fieldset': { borderColor: '#7C3AED', borderWidth: 1.5 },
          },
          '& .MuiInputLabel-root': { color: 'var(--zk-text3)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', backgroundColor: 'var(--zk-surface1)', color: 'var(--zk-text)' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24, boxShadow: 'var(--zk-shadow-lg)' } } },
    MuiMenu: { styleOverrides: { paper: { backgroundColor: 'var(--zk-surface1)', color: 'var(--zk-text)' } } },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        switchBase: { '&.Mui-checked': { color: '#fff', '& + .MuiSwitch-track': { backgroundColor: '#7C3AED', opacity: 1 } } },
        thumb: { boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
        track: { borderRadius: 22, backgroundColor: 'var(--zk-surface4)', opacity: 1 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
  },
});
