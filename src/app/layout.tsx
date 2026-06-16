import type { Metadata } from 'next';
import { Providers } from './providers';
import { THEME_CSS } from '@/styles/theme';

export const metadata: Metadata = {
  title: 'ZikkitAppointments — ניהול תורים חכם עם AI',
  description: 'סוכנת AI שעונה לטלפון 24/7, קובעת תורים, ומנהלת את היומן שלך. לספרים, קוסמטיקאיות, קליניקות ועוד.',
  manifest: '/manifest.json',
  themeColor: '#9333EA',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Zikkit' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&family=Assistant:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body { font-family: 'Heebo', 'Assistant', -apple-system, system-ui, sans-serif; background: #FAFAFA; -webkit-font-smoothing: antialiased; }
          ::selection { background: rgba(124,58,237,0.18); }
          ::-webkit-scrollbar { width: 10px; height: 10px; }
          ::-webkit-scrollbar-thumb { background: #D4D4D8; border-radius: 99px; border: 2px solid #FAFAFA; }
          ::-webkit-scrollbar-thumb:hover { background: #B4B4BB; }
          .zk-fade-up { animation: zkFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
          @keyframes zkFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=document.cookie.split('; ').find(function(r){return r.indexOf('zk-theme=')===0});var t=m?m.split('=')[1]:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();` }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
