'use client';

import { createTheme } from '@mui/material/styles';

// ZikkitAppointments brand — distinct from Zikkit field service.
// Zikkit field = indigo #4F46E5. Appointments = rose/plum for beauty/wellness feel.
export const zikkitColors = {
  bg: '#FCFBF9',
  bg2: '#F8F5F1',
  surface1: '#FFFFFF',
  surface2: '#F8F5F1',
  surface3: '#F0EBE5',
  surface4: '#E7E1DA',
  border: '#E7E1DA',
  border2: '#D6CFC6',

  text: '#1C1917',
  text2: '#57534E',
  text3: '#A8A29E',

  // Appointments accent: plum/rose
  accent: '#9333EA',
  accent2: '#A855F7',
  accent3: '#7E22CE',
  accentDim: 'rgba(147,51,234,0.08)',
  accentMid: 'rgba(147,51,234,0.16)',

  hot: '#E11D48',
  hotDim: 'rgba(225,29,72,0.08)',
};

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: { main: zikkitColors.accent },
    background: { default: zikkitColors.bg, paper: zikkitColors.surface1 },
    text: { primary: zikkitColors.text, secondary: zikkitColors.text2 },
  },
  typography: {
    fontFamily: "'Assistant', 'Heebo', system-ui, sans-serif",
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700 },
        containedPrimary: {
          background: `linear-gradient(135deg, ${zikkitColors.accent}, ${zikkitColors.accent2})`,
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
  },
});
