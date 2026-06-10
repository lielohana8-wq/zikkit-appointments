'use client';

import { createTheme } from '@mui/material/styles';

// ZikkitAppointments — premium, minimalist, Apple-inspired.
export const zikkitColors = {
  bg: '#FAFAFA',
  bg2: '#F4F4F5',
  surface1: '#FFFFFF',
  surface2: '#FAFAFA',
  surface3: '#F4F4F5',
  surface4: '#E9E9EB',
  border: '#ECECEE',
  border2: '#E0E0E3',
  text: '#111113',
  text2: '#5E5E66',
  text3: '#9A9AA2',
  accent: '#7C3AED',
  accent2: '#9061F9',
  accent3: '#6D28D9',
  accentDeep: '#5B21B6',
  accentDim: 'rgba(124,58,237,0.06)',
  accentMid: 'rgba(124,58,237,0.12)',
  hot: '#E5484D',
  hotDim: 'rgba(229,72,77,0.07)',
  green: '#30A46C',
  greenDim: 'rgba(48,164,108,0.08)',
  amber: '#FFB224',
  shadowSm: '0 1px 2px rgba(17,17,19,0.04), 0 1px 3px rgba(17,17,19,0.03)',
  shadowMd: '0 2px 8px rgba(17,17,19,0.04), 0 4px 16px rgba(17,17,19,0.04)',
  shadowLg: '0 8px 30px rgba(17,17,19,0.08), 0 2px 8px rgba(17,17,19,0.04)',
  shadowAccent: '0 8px 24px rgba(124,58,237,0.24)',
};

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: { main: zikkitColors.accent },
    error: { main: zikkitColors.hot },
    success: { main: zikkitColors.green },
    background: { default: zikkitColors.bg, paper: zikkitColors.surface1 },
    text: { primary: zikkitColors.text, secondary: zikkitColors.text2 },
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
        containedPrimary: { background: zikkitColors.accent, boxShadow: 'none', '&:hover': { background: zikkitColors.accent3, boxShadow: zikkitColors.shadowAccent } },
        outlined: { borderColor: zikkitColors.border2, '&:hover': { borderColor: zikkitColors.accent, background: zikkitColors.accentDim } },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12, backgroundColor: zikkitColors.surface1, transition: 'all 0.2s',
            '& fieldset': { borderColor: zikkitColors.border2 },
            '&:hover fieldset': { borderColor: zikkitColors.text3 },
            '&.Mui-focused fieldset': { borderColor: zikkitColors.accent, borderWidth: 1.5 },
          },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24, boxShadow: zikkitColors.shadowLg } } },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        switchBase: { '&.Mui-checked': { color: '#fff', '& + .MuiSwitch-track': { backgroundColor: zikkitColors.accent, opacity: 1 } } },
        thumb: { boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
        track: { borderRadius: 22, backgroundColor: zikkitColors.surface4, opacity: 1 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
  },
});
