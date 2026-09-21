import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AppTabId } from '../types';

export interface TabMetadata {
  id: AppTabId;
  label: string;
  synonyms: string[];
  confirmation: string;
  description: string;
}

export const TAB_DIRECTORY: Record<AppTabId, TabMetadata> = {
  webNavigator: {
    id: 'webNavigator',
    label: 'Web Navigator',
    synonyms: [
      'web', 
      'web_navigator', 
      'webnavigator', 
      'web navigator', 
      'browser', 
      'live browser', 
      'iframe', 
      'website',
      'saima',
      'portal',
      'home',
      'dashboard',
      'reports',
      'dataModel',
      'distributors',
      'pdfInsights',
      'paymentPlans'
    ],
    confirmation: 'Web Navigator is active with 70/30 Focus Mode.',
    description: 'Exclusive 70/30 Focus Mode with Live Website streaming and Dual-Grounded Copilot.'
  },
  home: {
    id: 'home',
    label: 'Web Navigator',
    synonyms: ['home', 'overview'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  },
  dashboard: {
    id: 'dashboard',
    label: 'Web Navigator',
    synonyms: ['dashboard', 'analytics'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  },
  reports: {
    id: 'reports',
    label: 'Web Navigator',
    synonyms: ['reports', 'records'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  },
  dataModel: {
    id: 'dataModel',
    label: 'Web Navigator',
    synonyms: ['dataModel'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  },
  distributors: {
    id: 'distributors',
    label: 'Web Navigator',
    synonyms: ['distributors'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  },
  pdfInsights: {
    id: 'pdfInsights',
    label: 'Web Navigator',
    synonyms: ['pdfInsights'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  },
  paymentPlans: {
    id: 'paymentPlans',
    label: 'Web Navigator',
    synonyms: ['paymentPlans'],
    confirmation: 'Web Navigator is active.',
    description: 'Single-page Web Navigator architecture.'
  }
};

export function normalizeTabId(input: string): AppTabId | null {
  return 'webNavigator';
}

interface NavigationContextValue {
  currentTab: AppTabId;
  navigateToTab: (tab: AppTabId, triggeredBy?: 'click' | 'voice' | 'link') => void;
  navigationHistory: { tab: AppTabId; timestamp: number; triggeredBy: string }[];
  isNavigating: boolean;
  lastConfirmation: string | null;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<AppTabId>('webNavigator');
  const [navigationHistory, setNavigationHistory] = useState<{ tab: AppTabId; timestamp: number; triggeredBy: string }[]>([
    { tab: 'webNavigator', timestamp: Date.now(), triggeredBy: 'initial' }
  ]);
  const [lastConfirmation, setLastConfirmation] = useState<string | null>(null);

  const navigateToTab = useCallback((tab: AppTabId, triggeredBy: 'click' | 'voice' | 'link' = 'click') => {
    setCurrentTab('webNavigator');
    setLastConfirmation('Web Navigator active');
    setNavigationHistory(prev => [...prev.slice(-20), { tab: 'webNavigator', timestamp: Date.now(), triggeredBy }]);
  }, []);

  const value = useMemo(() => ({
    currentTab,
    navigateToTab,
    navigationHistory,
    isNavigating: false,
    lastConfirmation,
  }), [currentTab, navigateToTab, navigationHistory, lastConfirmation]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
}
