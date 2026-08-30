import type { Metadata, Viewport } from 'next';
import './globals.css';
import { VisitorTracker } from '@/components/VisitorTracker';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'indobid.lol — Pay More. Rank Higher. Startup City Leaderboard.',
  description: 'The live interactive 3D startup city and attention leaderboard. Public visibility determined by verified cumulative bids with zero algorithmic bias.',
  keywords: ['pay-to-rank', 'startup city', '3d leaderboard', 'attention marketplace', 'indobid', 'advertising', 'startup ranking'],
  authors: [{ name: 'indobid' }],
  metadataBase: new URL('https://indobid.lol'),
  openGraph: {
    title: 'indobid.lol — Pay More. Rank Higher. Startup City Leaderboard.',
    description: '100% transparent pay-to-rank 3D startup city leaderboard for websites, startups, and creators.',
    url: 'https://indobid.lol',
    siteName: 'indobid.lol',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'indobid.lol — Pay More. Rank Higher. Startup City Leaderboard.',
    description: '100% transparent pay-to-rank interactive 3D startup city.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] antialiased flex flex-col selection:bg-[#f2c7b8] selection:text-[#192328]"
        suppressHydrationWarning
      >
        <VisitorTracker />
        {children}
      </body>
    </html>
  );
}
