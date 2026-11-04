import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { WorkspaceSync } from '@/components/layout/WorkspaceSync';
import { CompanyProvider } from '@/context/CompanyContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { InactivityHandler } from '@/components/layout/InactivityHandler';

// Brand font (brand kit v1): Inter, five weights, self-hosted from the kit's files (SIL OFL)
const inter = localFont({
  src: [
    { path: './fonts/Inter-Regular.ttf', weight: '400' },
    { path: './fonts/Inter-Medium.ttf', weight: '500' },
    { path: './fonts/Inter-SemiBold.ttf', weight: '600' },
    { path: './fonts/Inter-Bold.ttf', weight: '700' },
    { path: './fonts/Inter-ExtraBold.ttf', weight: '800' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Blynt Workpapers — Working papers and statutory accounts',
  description: 'Working papers, trial balance mapping, review and sign-off for accountants and bookkeepers',
  icons: { icon: '/favicon.svg', apple: '/brand/blynt-symbol.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Browser extensions add attributes to <html> before React hydrates.
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#F5F8FD] text-[#122654] antialiased">
        <WorkspaceSync>
          <LocaleProvider>
            <CompanyProvider>
              <InactivityHandler />
              {children}
            </CompanyProvider>
          </LocaleProvider>
        </WorkspaceSync>
      </body>
    </html>
  );
}
