'use client';

import React, { useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { db } from '@/lib/server/db';
import { getActor } from '@/lib/session';

interface DashboardShellProps {
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // A new practice's owner, admins and partners finish the set-up wizard first; other members carry on
  useEffect(() => {
    const firm = db.firms[0];
    const me = getActor();
    const canSetUp = me.role === 'admin' || me.role === 'partner' || firm?.owner_user_id === me.id;
    if (canSetUp && firm?.onboarding && !firm.onboarding.completed_at) window.location.replace('/onboarding');
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F6F7FB] text-[#102654]">
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block shrink-0 border-r border-[#E3E7EF]">
        <AppSidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="lg:hidden fixed inset-0 z-50 bg-[#0B1B3D]/50 backdrop-blur-xs flex"
        >
          <div className="w-[264px] bg-[#0B1B3D] h-full shadow-2xl flex flex-col">
            <AppSidebar onMobileClose={() => setMobileMenuOpen(false)} />
          </div>
          <div
            className="flex-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          />
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
