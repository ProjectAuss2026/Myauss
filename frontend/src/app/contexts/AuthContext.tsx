import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clearStoredAuth, fetchWithAuth, getStoredToken, refreshAccessToken, setStoredToken } from '../lib/authFetch';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  membershipStatus: string | null;
  studentId?: null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True when the user's role is 'ADMIN'. Derived from user.role. */
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  /** Store token + user from external auth flows (e.g. email verification) */
  setUserFromToken: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rehydrate session on app load
  useEffect(() => {
    const initAuth = async () => {
      let token = getStoredToken();
      if (!token) token = await refreshAccessToken();
      if (!token) return setIsLoading(false);

      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          // Token expired or invalid — clear
          clearStoredAuth();
        }
      } catch {
        // Fallback: use cached user if backend is unreachable
        const cached = localStorage.getItem('user');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            localStorage.removeItem('user');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data.error || 'Login failed. Please check your credentials.';
      const err: any = new Error(message);
      setError(message);
      throw err;
    }

    setStoredToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const setUserFromToken = useCallback((token: string, userData: AuthUser) => {
    setStoredToken(token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    const token = getStoredToken();
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
    clearStoredAuth();
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        /**
         * Backend enforces this independently on all protected admin routes.
         */
        isAdmin: user?.role === 'ADMIN' || user?.role === 'OWNER',
        isLoading,
        error,
        login,
        setUserFromToken,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
