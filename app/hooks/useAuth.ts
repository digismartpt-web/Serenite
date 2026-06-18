import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

const SecureStore = Platform.OS === 'web'
  ? {
      getItemAsync:    async (k: string): Promise<string | null> => { try { return localStorage.getItem(k) } catch { return null } },
      setItemAsync:    async (k: string, v: string): Promise<void> => { try { localStorage.setItem(k, v) } catch { } },
      deleteItemAsync: async (k: string): Promise<void> => { try { localStorage.removeItem(k) } catch { } },
    }
  : require('expo-secure-store');

import { API_BASE } from '../constants/api';
const SECURE_TOKEN    = 'serenite_auth_token';

// ─── Types ────────────────────────────────────────────────────

export interface AuthUser {
  id:               string;
  firstName:        string;
  lastName:         string;
  email:            string;
  phone?:           string;
  role:             'parent' | 'child' | 'solo';
  parentType?:      'papa' | 'maman' | 'beau-pere' | 'belle-mere';
  status?:          'separated' | 'divorced';
  childrenCount:    number;
  language:         string;
  themeId:          string;
  calendarColor:    string;
  calendarColorText: string;
  emailVerified:    boolean;
  createdAt:        string;
}

interface UseAuthReturn {
  user:        AuthUser | null;
  token:       string | null;
  loading:     boolean;
  isAuth:      boolean;
  refreshUser: () => Promise<void>;
  logout:      () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (jwt: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user as AuthUser);
      } else {
        // Token invalide ou expiré
        await SecureStore.deleteItemAsync(SECURE_TOKEN);
        setToken(null);
        setUser(null);
      }
    } catch {
      // Erreur réseau — on garde le token, l'utilisateur peut être offline
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const jwt = await SecureStore.getItemAsync(SECURE_TOKEN);
      if (jwt) {
        setToken(jwt);
        await fetchUser(jwt);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchUser]);

  useEffect(() => { load(); }, []);

  const refreshUser = useCallback(async () => {
    if (token) await fetchUser(token);
  }, [token, fetchUser]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(SECURE_TOKEN);
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    loading,
    isAuth: !!token,
    refreshUser,
    logout,
  };
}
