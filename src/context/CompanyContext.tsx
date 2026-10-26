'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Client, Engagement } from '@/lib/types/models';
import { db } from '@/lib/server/db';
import { getCurrentUserId } from '@/lib/session';

interface CompanyContextType {
  clients: Client[];
  activeCompany: Client | null;
  activeEngagement: Engagement | null;
  activeCompanyId: string;
  setActiveCompanyId: (clientId: string) => void;
  engagements: Engagement[];
  onboardingCompleted: boolean;
  setOnboardingCompleted: (val: boolean) => void;
  inactivityTimeoutMinutes: number;
  setInactivityTimeoutMinutes: (mins: number) => void;
  refreshCompanyData: () => void;
  addCompany: (newClient: Client, framework?: string) => Engagement;
  deleteCompany: (clientId: string) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const ACTIVE_CLIENT_STORAGE_KEY = 'blynt_active_client_id';
const ONBOARDING_STORAGE_KEY = 'blynt_onboarding_completed';
const INACTIVITY_STORAGE_KEY = 'blynt_inactivity_timeout_mins';

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [clients, setClients] = useState<Client[]>(() => [...db.clients]);
  const [engagements, setEngagements] = useState<Engagement[]>(() => [...db.engagements]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>('');
  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean>(true);
  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutesState] = useState<number>(15);

  const refreshCompanyData = useCallback(() => {
    setClients([...db.clients]);
    setEngagements([...db.engagements]);
  }, []);

  // Initialize from storage or db view preferences
  useEffect(() => {
    refreshCompanyData();

    // Check onboarding status
    const storedOnboard = typeof window !== 'undefined' ? localStorage.getItem(ONBOARDING_STORAGE_KEY) : null;
    if (storedOnboard !== null) {
      setOnboardingCompletedState(storedOnboard === 'true');
    } else {
      // If user has view_prefs with onboarding completed
      const userId = getCurrentUserId();
      const pref = db.view_prefs.find((p) => p.user_id === userId && p.key === 'general_view');
      if (pref?.value_json?.onboardingCompleted !== undefined) {
        setOnboardingCompletedState(Boolean(pref.value_json.onboardingCompleted));
      } else {
        // First time user check
        setOnboardingCompletedState(db.clients.length > 0);
      }
    }

    // Check timeout preference
    const storedTimeout = typeof window !== 'undefined' ? localStorage.getItem(INACTIVITY_STORAGE_KEY) : null;
    if (storedTimeout) {
      const parsed = parseInt(storedTimeout, 10);
      if (!isNaN(parsed) && parsed > 0) setInactivityTimeoutMinutesState(parsed);
    }

    // Set initial active company from current route engagement or storage
    let initialClientId = '';
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/engagements\/([^/]+)/);
      if (match && match[1] !== 'new') {
        const eng = db.engagements.find((e) => e.id === match[1]);
        if (eng) {
          initialClientId = eng.client_id;
          localStorage.setItem(ACTIVE_CLIENT_STORAGE_KEY, initialClientId);
        }
      }

      if (!initialClientId) {
        const saved = localStorage.getItem(ACTIVE_CLIENT_STORAGE_KEY);
        if (saved && db.clients.some((c) => c.id === saved)) {
          initialClientId = saved;
        }
      }

      // Auto-select first client if none chosen yet but clients exist
      if (!initialClientId && db.clients.length > 0) {
        initialClientId = db.clients[0].id;
        localStorage.setItem(ACTIVE_CLIENT_STORAGE_KEY, initialClientId);
      }
    }
    setActiveCompanyIdState(initialClientId);
  }, [refreshCompanyData]);

  const setActiveCompanyId = useCallback((id: string) => {
    setActiveCompanyIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_CLIENT_STORAGE_KEY, id);
    }
    // Also save to view prefs if available
    const userId = getCurrentUserId();
    if (userId) {
      const pref = db.view_prefs.find((p) => p.user_id === userId && p.key === 'general_view');
      if (pref) {
        pref.value_json.selectedClientId = id;
      }
    }
  }, []);

  // Synchronize active client whenever pathname changes to an engagement route
  useEffect(() => {
    if (pathname && pathname.includes('/engagements/')) {
      const match = pathname.match(/\/engagements\/([^/]+)/);
      if (match && match[1] !== 'new') {
        const eng = db.engagements.find((e) => e.id === match[1]);
        if (eng && eng.client_id !== activeCompanyId) {
          setActiveCompanyId(eng.client_id);
        }
      }
    }
  }, [pathname, activeCompanyId, setActiveCompanyId]);

  const setOnboardingCompleted = useCallback((val: boolean) => {
    setOnboardingCompletedState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, val ? 'true' : 'false');
    }
    const userId = getCurrentUserId();
    if (userId) {
      const pref = db.view_prefs.find((p) => p.user_id === userId && p.key === 'general_view');
      if (pref) {
        pref.value_json.onboardingCompleted = val;
      }
    }
  }, []);

  const setInactivityTimeoutMinutes = useCallback((mins: number) => {
    setInactivityTimeoutMinutesState(mins);
    if (typeof window !== 'undefined') {
      localStorage.setItem(INACTIVITY_STORAGE_KEY, mins.toString());
    }
    const userId = getCurrentUserId();
    if (userId) {
      const pref = db.view_prefs.find((p) => p.user_id === userId && p.key === 'general_view');
      if (pref) {
        pref.value_json.inactivityTimeoutMinutes = mins;
      }
    }
  }, []);

  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return null;
    return clients.find((c) => c.id === activeCompanyId) || null;
  }, [clients, activeCompanyId]);

  const activeEngagement = useMemo(() => {
    if (!activeCompany) return null;
    return (
      engagements.find((e) => e.client_id === activeCompany.id && e.status !== 'locked') ||
      engagements.find((e) => e.client_id === activeCompany.id) ||
      null
    );
  }, [engagements, activeCompany]);

  const addCompany = useCallback(
    (newClient: Client, framework = 'FRS 102 1A') => {
      // Add client to database
      db.clients.unshift(newClient);

      // Create primary engagement
      const periodEnd = newClient.year_end || '2026-12-31';
      const d = new Date(periodEnd);
      const start = new Date(d);
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      const periodStart = start.toISOString().split('T')[0];

      const engId = `eng_${newClient.id.replace('cli_', '')}_fy${d.getFullYear().toString().slice(-2)}`;
      const newEng: Engagement = {
        id: engId,
        client_id: newClient.id,
        firm_id: newClient.firm_id || 'firm_blynt_uk',
        period_start: periodStart,
        period_end: periodEnd,
        framework,
        template_pack_id: 'pack_small_co',
        status: 'planning',
        locked_at: null,
        prior_engagement_id: null,
      };
      db.engagements.unshift(newEng);

      // Auto-create initial engagement workpapers from template pack
      db.createEngagementWorkpapers(newEng.id, newClient.company_type);

      // Refresh internal state
      setClients([...db.clients]);
      setEngagements([...db.engagements]);
      setActiveCompanyId(newClient.id);

      return newEng;
    },
    [setActiveCompanyId]
  );

  const deleteCompany = useCallback(
    (clientId: string) => {
      db.deleteClient(clientId);
      if (activeCompanyId === clientId) {
        const remaining = db.clients.filter((c) => c.id !== clientId);
        const nextId = remaining[0]?.id || '';
        setActiveCompanyId(nextId);
      }
      refreshCompanyData();
    },
    [activeCompanyId, setActiveCompanyId, refreshCompanyData]
  );

  const value = useMemo(
    () => ({
      clients,
      activeCompany,
      activeEngagement,
      activeCompanyId: activeCompany?.id || activeCompanyId,
      setActiveCompanyId,
      engagements,
      onboardingCompleted,
      setOnboardingCompleted,
      inactivityTimeoutMinutes,
      setInactivityTimeoutMinutes,
      refreshCompanyData,
      addCompany,
      deleteCompany,
    }),
    [
      clients,
      activeCompany,
      activeEngagement,
      activeCompanyId,
      setActiveCompanyId,
      engagements,
      onboardingCompleted,
      setOnboardingCompleted,
      inactivityTimeoutMinutes,
      setInactivityTimeoutMinutes,
      refreshCompanyData,
      addCompany,
      deleteCompany,
    ]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
