'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authKeys } from '../constants/auth.keys';
import type { AuthUser } from '../types/auth.types';
import { fetchAllWorkspaces } from '@/features/workspaces/shell/services/workspace.service';
import { apiPost, setAuthToken } from '@/shared/lib/api';
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

      if (!code) {
        toast.error('No authorization code received. Direct token passing via URL is disallowed.');
        router.replace('/login');
        return;
      }

      try {
        // Exchange single-use code via POST body (HttpOnly refresh cookie is set automatically)
        const exchangeData = await apiPost<OAuthExchangeResponse>('/auth/oauth/exchange', {
          code,
        });

        setAuthToken(exchangeData.accessToken);
        const authUser = exchangeData.user;

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
