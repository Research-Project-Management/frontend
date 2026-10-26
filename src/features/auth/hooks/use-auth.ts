'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { isApiError } from '@/shared/types/api.types';
import { hasAuthToken, getAuthToken } from '@/shared/lib/api';
import { isTokenValid } from '@/shared/utils/auth-token.util';
import { getUser, logoutUser } from '../services/auth.service';
import { authKeys } from '../constants/auth.keys';
import type { AuthState, AuthUser } from '../types/auth.types';
import { isAuth } from '../types/auth.types';

export interface UseAuthReturn {
  // ── Session State (Discriminated Union) ──────────────────────────
  readonly state: AuthState;
  readonly user: AuthUser | null;
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly isError: boolean;
  readonly error: string | null;

  // ── Session Actions ───────────────────────────────────────────────
  readonly logout: () => void;
  readonly logoutAsync: () => Promise<void>;
  readonly isLoggingOut: boolean;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Lightweight, High-Performance Session Hook.
 * Adheres to SRP & ISP: Only subscribes to the user session query.
 * Perfect for the 60+ UI components that only read session state.
 *
 * @example
 * ```tsx
 * const { state, user, isAuthenticated, logout } = useAuth();
 * if (state.status === 'loading') return <Spinner />;
 * ```
 */
function getCachedUserFallback(): AuthUser | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!hasAuthToken() || !isTokenValid(getAuthToken())) return undefined;
  try {
    const raw = localStorage.getItem('flux_cached_user');
    return raw ? (JSON.parse(raw) as AuthUser) : undefined;
  } catch {
    return undefined;
  }
}

let hasClientMountedAuth = false;

export const useAuth = (): UseAuthReturn => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isHydrated, setIsHydrated] = useState(() => hasClientMountedAuth);

  useEffect(() => {
    hasClientMountedAuth = true;
    setIsHydrated(true);
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: authKeys.session(),
    queryFn: getUser,
    placeholderData: () => (hasClientMountedAuth ? getCachedUserFallback() : undefined),
    staleTime: 5 * 60 * 1_000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, err) => {
      // Do not retry explicit 401/403 authorization rejections
      if (isApiError(err) && (err.statusCode === 401 || err.statusCode === 403)) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
    },
    onError: () => {
      queryClient.clear();
      router.replace('/login');
      toast.error('Something went wrong. Please try again.');
    },
  });

  const cachedFallback = isHydrated ? getCachedUserFallback() : undefined;

  let state: AuthState;
  if (isLoading && !cachedFallback) {
    state = { status: 'loading', user: null, error: null };
  } else if (data || cachedFallback) {
    state = { status: 'authenticated', user: (data ?? cachedFallback)!, error: null };
  } else if (hasAuthToken() && isTokenValid(getAuthToken())) {
    // Session query might have encountered transient network glitch while token still exists
    let fallbackUser: AuthUser | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('flux_cached_user');
        fallbackUser = raw ? (JSON.parse(raw) as AuthUser) : null;
      } catch {
        fallbackUser = null;
      }
    }

    if (fallbackUser) {
      state = {
        status: 'authenticated',
        user: fallbackUser,
        error: null,
      };
    } else {
      state = {
        status: 'unauthenticated',
        user: null,
        error: error instanceof Error ? error.message : null,
      };
    }
  } else {
    state = {
      status: 'unauthenticated',
      user: null,
      error: error instanceof Error ? error.message : null,
    };
  }

  return {
    state,
    user: state.user,
    isLoading: state.status === 'loading',
    isAuthenticated: isAuth(state),
    isError,
    error: state.error,

    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refetch,
  };
};
