// lib/hooks/useAuth.ts

"use client";

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

interface StoredSession {
  user: User;
  loginTime: number;
}

interface AuthApiResponse {
  success: boolean;
  message?: string;
  user?: User;
}

const SESSION_KEY = 'waziqoh_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000;

const EMPTY_AUTH_STATE: AuthState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  isAdmin: false,
};

const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.username === 'string'
    && (candidate.role === 'admin' || candidate.role === 'user')
    && typeof candidate.nama_lengkap === 'string'
    && typeof candidate.status_aktif === 'boolean'
    && typeof candidate.created_at === 'string';
};

const isStoredSession = (value: unknown): value is StoredSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isUser(candidate.user) && typeof candidate.loginTime === 'number';
};

const parseAuthResponse = (value: unknown): AuthApiResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, message: 'Respons autentikasi tidak valid' };
  }
  const candidate = value as Record<string, unknown>;
  return {
    success: candidate.success === true,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    user: isUser(candidate.user) ? candidate.user : undefined,
  };
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    ...EMPTY_AUTH_STATE,
    isLoading: true,
  });

  const checkSession = useCallback(() => {
    try {
      const rawSession = localStorage.getItem(SESSION_KEY);
      if (!rawSession) {
        setState(EMPTY_AUTH_STATE);
        return;
      }

      const parsed: unknown = JSON.parse(rawSession);
      if (!isStoredSession(parsed) || Date.now() - parsed.loginTime > SESSION_DURATION) {
        localStorage.removeItem(SESSION_KEY);
        setState(EMPTY_AUTH_STATE);
        return;
      }

      setState({
        user: parsed.user,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: parsed.user.role === 'admin',
      });
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setState(EMPTY_AUTH_STATE);
    }
  }, []);

  useEffect(() => {
    checkSession();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) checkSession();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [checkSession]);

  const login = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      return { success: false, message: 'Username dan password wajib diisi' };
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password }),
        cache: 'no-store',
      });
      const result = parseAuthResponse(await response.json());

      if (!response.ok || !result.success || !result.user) {
        return {
          success: false,
          message: result.message || 'Username atau password salah',
        };
      }

      const session: StoredSession = {
        user: result.user,
        loginTime: Date.now(),
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setState({
        user: result.user,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: result.user.role === 'admin',
      });

      return { success: true, message: 'Login berhasil' };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: `Terjadi kesalahan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setState(EMPTY_AUTH_STATE);
    window.location.assign('/login');
  };

  return {
    ...state,
    login,
    logout,
    refresh: checkSession,
  };
};
