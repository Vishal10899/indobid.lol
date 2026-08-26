import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'indobid.lol — Pay More. Rank Higher.',
  description: 'Public visibility determined by verified cumulative bids with zero algorithmic bias.',
  keywords: ['pay-to-rank', 'leaderboard', 'attention marketplace', 'indobid', 'advertising', 'startup ranking'],
  authors: [{ name: 'indobid' }],
  metadataBase: new URL('https://indobid.lol'),
  openGraph: {
    title: 'indobid.lol — Pay More. Rank Higher.',
    description: '100% transparent pay-to-rank leaderboard for websites, startups, YouTube channels, and creators.',
    url: 'https://indobid.lol',
    siteName: 'indobid.lol',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'indobid.lol — Pay More. Rank Higher.',
    description: '100% transparent pay-to-rank leaderboard.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value || cookieStore.get('indobid_theme')?.value;
  const isDark = themeCookie === 'dark';
  const htmlClassName = isDark ? 'scroll-smooth dark' : 'scroll-smooth';

  return (
    <html lang="en" className={htmlClassName}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=localStorage.getItem('theme')||localStorage.getItem('indobid_theme')||(m?m[1]:null);var isDark=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark){document.documentElement.classList.add('dark');document.cookie='theme=dark;path=/;max-age=31536000;SameSite=Lax';}else{document.documentElement.classList.remove('dark');document.cookie='theme=light;path=/;max-age=31536000;SameSite=Lax';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
