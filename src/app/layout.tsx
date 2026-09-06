import type { Metadata, Viewport } from 'next';
import { Montserrat, Bodoni_Moda, Bebas_Neue } from 'next/font/google';
import './globals.css';
import { VisitorTracker } from '@/components/VisitorTracker';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { GlobalAtmosphericBackground } from '@/components/GlobalAtmosphericBackground';

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
  title: 'IndoBid — Put Value Behind Your Opinion',
  description: 'Share opinions, discover perspectives, join conversations, and back ideas with conviction.',
  keywords: ['paid debate', 'social opinion', 'skin in the game', 'indobid', 'arguments', 'debates', 'conviction', 'opinions', 'vishal chaudhary'],
  authors: [{ name: 'Vishal Chaudhary', url: 'https://indobid.lol' }],
  creator: 'Vishal Chaudhary',
  metadataBase: new URL('https://indobid.lol'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'IndoBid — Put Value Behind Your Opinion',
    description: 'Share opinions, discover perspectives, join conversations, and back ideas with conviction.',
    url: 'https://indobid.lol',
    siteName: 'IndoBid',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IndoBid — Put Value Behind Your Opinion',
    description: 'Share opinions, discover perspectives, join conversations, and back ideas with conviction.',
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
    <html lang="en" suppressHydrationWarning className={`scroll-smooth ${montserrat.variable} ${bodoniModa.variable} ${bebasNeue.variable}`}>
      <head>
        {/* Anti-flash Theme Initialization Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('indobid_theme');
                  var isDark = true;
                  if (saved === 'light') {
                    isDark = false;
                  } else if (saved === 'system') {
                    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  }
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Razorpay Checkout Script */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] antialiased flex flex-col selection:bg-[var(--color-coral)] selection:text-[var(--bg-page-deep)] relative">
        <GlobalAtmosphericBackground />
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
