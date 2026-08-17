'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/constants';
import { apiGet, setTokens, setAuthToken } from '@/shared/lib/api';
import { getErrorMessage } from '@/shared/utils/error.util';

/**
 * OAuthCallbackPage
 *
 * Handles redirect after Google / GitHub OAuth.
 * Reads accessToken / refreshToken from URL parameters, saves them,
 * seeds the user session into TanStack Query cache, and routes
 * the user into their workspace or workspace creation screen.
 */
const OAuthCallbackPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function handleAuthCallback() {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('accessToken') || urlParams.get('token');
      const refreshToken = urlParams.get('refreshToken');
      const error = urlParams.get('error');

      if (error) {
        toast.error(`Authentication error: ${error}`);
        router.replace('/login');
        return;
      }

      if (!token) {
        toast.error('No authentication token received');
        router.replace('/login');
        return;
      }

      try {
        // 1. Store tokens immediately
        if (refreshToken) {
          setTokens(token, refreshToken);
        } else {
          setAuthToken(token);
        }

        // 2. Fetch user profile and seed TanStack Query cache
        const userData = await apiGet<{ user: import('../types/auth.types').AuthUser }>('/auth/user');
        const user = userData.user;
        queryClient.setQueryData(queryKeys.auth.session, user);

        // 3. Fetch workspaces to route user accurately
        try {
          const workspaceData = await apiGet<import('@/features/workspaces/shell/services/workspace.service').WorkspaceListResponse>('/api/workspace');
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

  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='flex flex-col items-center gap-4'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
        <p className='text-sm text-muted-foreground'>Completing sign in...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;

