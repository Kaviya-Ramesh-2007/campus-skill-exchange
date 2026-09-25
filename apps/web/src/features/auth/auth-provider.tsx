'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from '@campus-skill-exchange/contracts';
import { ApiClientError, apiRequest } from '../../services/api-client';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (input: LoginRequest) => Promise<AuthUser>;
  register: (input: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest<AuthUser>('/auth/me');
      setUser(response);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        setUser(null);
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Authentication status is unavailable.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The initial session check intentionally synchronizes external auth state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const login = useCallback(async (input: LoginRequest) => {
    setError(null);
    try {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: input,
      });
      setUser(response.user);
      return response.user;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to sign in.';
      setError(message);
      throw requestError;
    }
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    setError(null);
    try {
      const response = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: input,
      });
      setUser(response.user);
      return response.user;
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Unable to create the account.';
      setError(message);
      throw requestError;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, error, refresh, login, register, logout }),
    [error, isLoading, login, logout, refresh, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
