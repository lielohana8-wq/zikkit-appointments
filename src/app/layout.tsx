import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ZikkitAppointments — ניהול תורים חכם עם AI',
  description: 'סוכנת AI שעונה לטלפון 24/7, קובעת תורים, ומנהלת את היומן שלך. לספרים, קוסמטיקאיות, קליניקות ועוד.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Assistant', system-ui, sans-serif; background: #FCFBF9; }
          .zk-fade-up { animation: zkFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
          @keyframes zkFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
