'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authKeys } from '../constants/auth.keys';
import type { AuthUser } from '../types/auth.types';
import { fetchAllWorkspaces } from '@/features/workspaces/shell/services/workspace.service';
import { apiGet, apiPost, setTokens, setAuthToken } from '@/shared/lib/api';
import { getErrorMessage } from '@/shared/utils/error.util';

interface OAuthExchangeResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

/**
 * Dedicated Hook for OAuthCallbackPage.
 * Securely exchanges single-use authorization code for session tokens
 * via POST body to prevent credential leakage in URL query strings.
 */
export const useOAuthCallback = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function handleAuthCallback() {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const token = urlParams.get('accessToken') || urlParams.get('token');
      const refreshToken = urlParams.get('refreshToken');
      const error = urlParams.get('error');

      if (error) {
        if (error === 'invalid_csrf_state') {
          toast.error('Security alert: Invalid OAuth CSRF state. Please try logging in again.');
        } else {
          toast.error(`Authentication error: ${error}`);
        }
        router.replace('/login');
        return;
      }

      try {
        let authUser: AuthUser;

        // 1. Preferred Secure Flow: Exchange single-use code via POST body
        if (code) {
          const exchangeData = await apiPost<OAuthExchangeResponse>('/auth/oauth/exchange', {
            code,
          });

          if (exchangeData.refreshToken) {
            setTokens(exchangeData.accessToken, exchangeData.refreshToken);
          } else {
            setAuthToken(exchangeData.accessToken);
          }

          authUser = exchangeData.user;
        } else if (token) {
          // Fallback legacy URL params
          if (refreshToken) {
            setTokens(token, refreshToken);
          } else {
            setAuthToken(token);
          }

          const userData = await apiGet<{ user: AuthUser }>('/auth/user');
          authUser = userData.user;
        } else {
          toast.error('No authorization code or token received');
          router.replace('/login');
          return;
        }

        // 2. Seed query cache
        queryClient.setQueryData(authKeys.session(), authUser);

        // 3. Clean URL without refreshing page
        if (window.history.replaceState) {
          window.history.replaceState({}, document.title, '/auth/callback');
        }

        // 4. Fetch workspaces to route user accurately
        try {
          const workspaceData = await fetchAllWorkspaces();
          if (workspaceData.workspaces && workspaceData.workspaces.length > 0) {
            router.replace(`/${workspaceData.workspaces[0].url}`);
          } else {
            router.replace('/create-workspace');
          }
        } catch {
          router.replace('/create-workspace');
        }
      } catch (err: unknown) {
        toast.error(getErrorMessage(err));
        router.replace('/login');
      }
    }

    handleAuthCallback();
  }, [queryClient, router]);
};
