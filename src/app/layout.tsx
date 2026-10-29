import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { WorkspaceSync } from '@/components/layout/WorkspaceSync';
import { CompanyProvider } from '@/context/CompanyContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { InactivityHandler } from '@/components/layout/InactivityHandler';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
  title: 'Blynt Workpapers — Financial Working Papers & Statutory Audit',
  description: 'AI-assisted financial working paper platform for audit and accounting firms',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Browser extensions add attributes to <html> before React hydrates.
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#F6F7FB] text-[#102654] antialiased">
        <WorkspaceSync>
          <LocaleProvider>
            <CompanyProvider>
              <InactivityHandler />
              <OnboardingModal />
              {children}
            </CompanyProvider>
          </LocaleProvider>
        </WorkspaceSync>
      </body>
    </html>
  );
}
