import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { getProfile, logout as logoutRequest } from './api';
import type { AuthUser } from './api';
import { clearAuth, getUser, saveUser } from './auth';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshSession: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => getUser());
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    if (nextUser) {
      saveUser(nextUser);
    } else {
      clearAuth();
    }

    setUserState(nextUser);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
      return profile;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const profile = await getProfile();

        if (!cancelled) {
          setUser(profile);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      setUser,
      refreshSession,
      logout,
    }),
    [user, isLoading, setUser, refreshSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
