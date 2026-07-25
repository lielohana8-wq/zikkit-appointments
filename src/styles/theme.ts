'use client';

import { createTheme } from '@mui/material/styles';

// ZikkitAppointments — quiet premium.
// Soft grey canvas, floating white cards, hairline dividers, restrained type.
// Purple is punctuation only: actions and "now". No large colour washes.
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

  // ── New in 2.0 ──────────────────────────────────────────────
  // The page sits on a soft grey canvas; cards are white and float.
  canvas: 'var(--zk-canvas)',
  card: 'var(--zk-card)',
  cardLine: 'var(--zk-card-line)',
  // Subtle fills for search fields, avatars, chips, row hover.
  fill: 'var(--zk-fill)',
  fillStrong: 'var(--zk-fill-strong)',
  // Decorative icon strokes ONLY (chevrons). Never body text.
  glyph: 'var(--zk-glyph)',
  // Translucent sticky header over blur.
  chrome: 'var(--zk-chrome)',
  chromeLine: 'var(--zk-chrome-line)',
  shadowCard: 'var(--zk-shadow-card)',
  shadowCardHover: 'var(--zk-shadow-card-hover)',
  radiusCard: 16,
};

export const THEME_CSS = `
:root, [data-theme="light"] {
  --zk-bg: #F5F5F7; --zk-bg2: #FFFFFF;
  --zk-surface1: #FFFFFF; --zk-surface2: #FAFAFA; --zk-surface3: #F2F2F2; --zk-surface4: #E5E5E5;
  --zk-border: #E2E2E2; --zk-border2: #E5E5EA;
  --zk-text: #0A0A0A; --zk-text2: #4A4A4A; --zk-text3: #8A8A8A;
  --zk-accent-dim: rgba(124,58,237,0.10); --zk-accent-mid: rgba(124,58,237,0.20);
  --zk-hot-dim: rgba(229,72,77,0.10); --zk-green-dim: rgba(48,164,108,0.12);
  --zk-shadow-sm: 0 1px 2px rgba(0,0,0,0.04); --zk-shadow-md: 0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.045);
  --zk-shadow-lg: 0 2px 6px rgba(0,0,0,0.05), 0 24px 60px rgba(0,0,0,0.08);
  --zk-blur: rgba(245,245,247,0.72);

  --zk-canvas: #F5F5F7; --zk-card: #FFFFFF; --zk-card-line: transparent;
  --zk-fill: rgba(0,0,0,0.045); --zk-fill-strong: rgba(0,0,0,0.075); --zk-glyph: #C7C7CC;
  --zk-chrome: rgba(245,245,247,0.72); --zk-chrome-line: rgba(0,0,0,0.07);
  --zk-shadow-card: 0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.045);
  --zk-shadow-card-hover: 0 2px 4px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.07);
}
[data-theme="dark"] {
  --zk-bg: #000000; --zk-bg2: #0A0A0A;
  --zk-surface1: #0D0D0D; --zk-surface2: #0A0A0A; --zk-surface3: #161616; --zk-surface4: #242424;
  --zk-border: #262626; --zk-border2: #262626;
  --zk-text: #FAFAFA; --zk-text2: #A0A0A0; --zk-text3: #5A5A5A;
  --zk-accent-dim: rgba(144,97,249,0.16); --zk-accent-mid: rgba(144,97,249,0.26);
  --zk-hot-dim: rgba(229,72,77,0.18); --zk-green-dim: rgba(48,164,108,0.18);
  --zk-shadow-sm: none; --zk-shadow-md: none; --zk-shadow-lg: 0 24px 60px rgba(0,0,0,0.6);
  --zk-blur: rgba(0,0,0,0.72);

  --zk-canvas: #000000; --zk-card: #0D0D0D; --zk-card-line: #262626;
  --zk-fill: rgba(255,255,255,0.07); --zk-fill-strong: rgba(255,255,255,0.12); --zk-glyph: #3A3A3A;
  --zk-chrome: rgba(0,0,0,0.72); --zk-chrome-line: #262626;
  /* On black, the card outline replaces the shadow. */
  --zk-shadow-card: none; --zk-shadow-card-hover: none;
}
body { background: var(--zk-canvas); transition: background 0.3s ease; -webkit-font-smoothing: antialiased; }
::selection { background: rgba(124,58,237,0.18); }

/* ---- Interaction polish (applies app-wide) ---- */
.zk-page { animation: zkPageIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
@keyframes zkPageIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.zk-lift { transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease; }
.zk-lift:hover { transform: translateY(-2px); box-shadow: var(--zk-shadow-card-hover); }
.zk-stagger > * { animation: zkPageIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
.zk-stagger > *:nth-child(1){animation-delay:.02s} .zk-stagger > *:nth-child(2){animation-delay:.06s}
.zk-stagger > *:nth-child(3){animation-delay:.1s} .zk-stagger > *:nth-child(4){animation-delay:.14s}
.zk-stagger > *:nth-child(5){animation-delay:.18s} .zk-stagger > *:nth-child(6){animation-delay:.22s}
.zk-stagger > *:nth-child(7){animation-delay:.26s} .zk-stagger > *:nth-child(8){animation-delay:.3s}

/* The 2.0 card: floating white surface, no hard border, soft double shadow. */
.zk-card {
  background: var(--zk-card);
  border: 1px solid var(--zk-card-line);
  border-radius: 16px;
  box-shadow: var(--zk-shadow-card);
  transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease;
}
.zk-card:hover { transform: translateY(-2px); box-shadow: var(--zk-shadow-card-hover); }
/* Non-interactive cards opt out of the lift. */
.zk-card.zk-static:hover { transform: none; box-shadow: var(--zk-shadow-card); }

/* iOS-style inset hairline between list rows. */
.zk-row + .zk-row { border-top: 1px solid var(--zk-border2); }
.zk-row-hover { transition: background 0.2s ease; }
.zk-row-hover:hover { background: var(--zk-fill); }

/* Numerals in tables, money and times must not jitter. */
.zk-nums { font-variant-numeric: tabular-nums; }

/* Sticky translucent app bar. */
.zk-chrome {
  position: sticky; top: 0; z-index: 30;
  background: var(--zk-chrome);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--zk-chrome-line);
}

.MuiButton-root { transition: transform 0.12s cubic-bezier(0.16,1,0.3,1) !important; }
.MuiButton-root:active { transform: scale(0.97); }

/* Skeleton shimmer */
.zk-skeleton { background: linear-gradient(90deg, var(--zk-fill) 25%, var(--zk-card) 37%, var(--zk-fill) 63%); background-size: 400% 100%; animation: zkShimmer 1.4s ease infinite; border-radius: 10px; }
@keyframes zkShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.zk-fade { animation: zkFade 0.5s ease both; }
@keyframes zkFade { from { opacity: 0; } to { opacity: 1; } }

@media (prefers-reduced-motion: reduce) { .zk-page, .zk-stagger > *, .zk-lift, .zk-card, .zk-skeleton, .zk-fade, .MuiButton-root { animation: none !important; transition: none !important; } }
`;

// NOTE (changed in 2.0): --zk-border is no longer near-black. The old sharp
// black outline read as "AI-generated"; hierarchy now comes from the grey
// canvas + soft card shadow. In dark mode the card outline does that job.

export const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: { main: '#7C3AED' },
    error: { main: '#E5484D' },
    success: { main: '#30A46C' },
    background: { default: '#F5F5F7', paper: '#FFFFFF' },
    text: { primary: '#0A0A0A', secondary: '#4A4A4A' },
  },
  typography: {
    // Restrained weights. 900 everywhere was the loudest "AI" tell.
    fontFamily: "'Heebo', 'Assistant', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    h1: { fontWeight: 600, letterSpacing: '-0.035em' },
    h2: { fontWeight: 600, letterSpacing: '-0.03em' },
    h3: { fontWeight: 600, letterSpacing: '-0.025em' },
    h4: { fontWeight: 600, letterSpacing: '-0.025em' },
    h5: { fontWeight: 600, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '-0.02em' },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500 },
    body1: { letterSpacing: '-0.01em' },
    body2: { letterSpacing: '-0.01em' },
    button: { fontWeight: 500, letterSpacing: '-0.01em' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 500, borderRadius: 10, padding: '9px 18px',
          transition: 'transform 0.12s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
          '&:active': { transform: 'scale(0.97)' },
        },
        containedPrimary: {
          background: '#7C3AED', boxShadow: 'none',
          '&:hover': { background: '#6D28D9', boxShadow: 'none', opacity: 0.92 },
        },
        outlined: {
          borderColor: 'var(--zk-border2)', borderWidth: 1, color: 'var(--zk-text)',
          '&:hover': { borderColor: 'var(--zk-text3)', borderWidth: 1, background: 'var(--zk-fill)', color: 'var(--zk-text)' },
        },
        text: { color: 'var(--zk-text)', '&:hover': { background: 'var(--zk-fill)' } },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 11, backgroundColor: 'var(--zk-fill)', color: 'var(--zk-text)', transition: 'all 0.2s',
            '& fieldset': { borderColor: 'transparent', borderWidth: 1 },
            '&:hover fieldset': { borderColor: 'var(--zk-border2)' },
            '&.Mui-focused': { backgroundColor: 'var(--zk-card)' },
            '&.Mui-focused fieldset': { borderColor: '#7C3AED', borderWidth: 1 },
          },
          '& .MuiInputLabel-root': { color: 'var(--zk-text3)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: 'var(--zk-card)', color: 'var(--zk-text)' },
        outlined: { border: '1px solid var(--zk-card-line)', boxShadow: 'var(--zk-shadow-card)', borderRadius: 16 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 20, border: '1px solid var(--zk-card-line)', boxShadow: 'var(--zk-shadow-lg)' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { backgroundColor: 'var(--zk-card)', color: 'var(--zk-text)', border: '1px solid var(--zk-card-line)', borderRadius: 14, boxShadow: 'var(--zk-shadow-lg)' },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        switchBase: { '&.Mui-checked': { color: '#fff', '& + .MuiSwitch-track': { backgroundColor: '#30A46C', opacity: 1 } } },
        thumb: { boxShadow: '0 1px 3px rgba(0,0,0,0.24)' },
        track: { borderRadius: 22, backgroundColor: 'var(--zk-fill-strong)', opacity: 1 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500, borderRadius: 99 } } },
    MuiDivider: { styleOverrides: { root: { borderColor: 'var(--zk-border2)' } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { background: 'var(--zk-text)', color: 'var(--zk-canvas)', fontSize: 12, fontWeight: 500, borderRadius: 8, padding: '6px 10px' },
      },
    },
  },
});
