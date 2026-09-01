import type { Metadata, Viewport } from 'next';
import { Montserrat, Bodoni_Moda, Bebas_Neue } from 'next/font/google';
import './globals.css';
import { VisitorTracker } from '@/components/VisitorTracker';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { AuthModal } from '@/components/AuthModal';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'IndoBid — Everyone has an opinion. Put money behind it.',
  description: 'The premium social debate platform. Read opinions for free. Put money behind your opinion to participate with skin in the game. Built & Designed by Vishal Chaudhary.',
  keywords: ['paid debate', 'social opinion', 'skin in the game', 'indobid', 'arguments', 'debates', 'conviction', 'opinions', 'vishal chaudhary'],
  authors: [{ name: 'Vishal Chaudhary', url: 'https://indobid.lol' }],
  creator: 'Vishal Chaudhary',
  metadataBase: new URL('https://indobid.lol'),
  openGraph: {
    title: 'IndoBid — Everyone has an opinion. Put money behind it.',
    description: 'Read debates for free. Put money behind your opinion to participate with skin in the game.',
    url: 'https://indobid.lol',
    siteName: 'IndoBid.lol',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IndoBid — Everyone has an opinion. Put money behind it.',
    description: 'Read debates for free. Put money behind your opinion to participate with skin in the game.',
    creator: '@vishalchaudhary',
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
    <html lang="en" className={`scroll-smooth ${montserrat.variable} ${bodoniModa.variable} ${bebasNeue.variable}`}>
      <head>
        {/* Razorpay Checkout Script */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] antialiased flex flex-col selection:bg-[var(--color-coral)] selection:text-[var(--bg-page-deep)]">
        <ThemeProvider>
          <AuthProvider>
            <VisitorTracker />
            {children}
            <AuthModal />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
