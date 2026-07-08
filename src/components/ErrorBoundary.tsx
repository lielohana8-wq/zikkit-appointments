'use client';

import { Component, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Caught by ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg, p: 3, textAlign: 'center' }}>
          <Box sx={{ fontSize: 48, mb: 2 }}>😔</Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.text, mb: 1 }}>משהו השתבש</Typography>
          <Typography sx={{ fontSize: 14, color: c.text3, mb: 3, maxWidth: 320 }}>נתקלנו בבעיה זמנית. רענון הדף בדרך כלל פותר את זה.</Typography>
          <Button onClick={() => window.location.reload()} variant="contained" sx={{ borderRadius: 3, fontWeight: 700, px: 4, py: 1.25 }}>רענן את הדף</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
