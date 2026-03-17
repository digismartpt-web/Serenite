import React, {
  createContext, useContext, useState, useCallback,
} from 'react';

// ─── Types ────────────────────────────────────────────────────

export type ParentType = 'papa' | 'maman' | 'beau-pere' | 'belle-mere';
export type ParentStatus = 'separated' | 'divorced';

export interface OnboardingData {
  // Step 1
  language: string;

  // Step 2 — Identité
  firstName:  string;
  lastName:   string;
  email:      string;
  phone:      string;
  address?:   string;
  birthDate?: Date;

  // Step 3 — Situation
  parentType?:   ParentType;
  parentStatus?: ParentStatus;
  childrenCount: number;

  // Step 4 — PIN (mémoire uniquement, jamais persisté)
  pin?:              string;
  biometricsEnabled: boolean;
}

interface OnboardingContextValue {
  data: OnboardingData;
  patch: (updates: Partial<OnboardingData>) => void;
  reset: () => void;
}

// ─── Valeurs initiales ────────────────────────────────────────

const INITIAL: OnboardingData = {
  language:          'fr',
  firstName:         '',
  lastName:          '',
  email:             '',
  phone:             '',
  childrenCount:     1,
  biometricsEnabled: false,
};

// ─── Context ──────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(INITIAL);

  const patch = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setData(INITIAL);
  }, []);

  return (
    <OnboardingContext.Provider value={{ data, patch, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

/** Hook sécurisé — lance une erreur claire si utilisé hors du Provider. */
export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding doit être utilisé dans <OnboardingProvider>');
  }
  return ctx;
}
