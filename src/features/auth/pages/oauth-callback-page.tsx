'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { queryKeys } from '@/shared/constants';
import { apiGet, setTokens, setAuthToken } from '@/shared/lib/api';

/**
 * OAuthCallbackPage
 *
 * Handles redirect after Google / GitHub OAuth.
 * Reads accessToken / refreshToken from URL parameters, saves them,
 * and routes the user into their workspace.
 */
const OAuthCallbackPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('accessToken') || urlParams.get('token');
      const rt = urlParams.get('refreshToken');
      if (token) {
        if (rt) {
          setTokens(token, rt);
        } else {
          setAuthToken(token);
        }
      }
    }

    // Invalidate cached session so useAuth refetches with the new token
    queryClient
      .invalidateQueries({ queryKey: queryKeys.auth.session })
      .then(() => {
        // Fetch workspaces to determine routing
        apiGet<{ workspaces: any[] }>('/api/workspace')
          .then(data => {
            if (data.workspaces && data.workspaces.length > 0) {
              router.replace(`/${data.workspaces[0].url}`);
            } else {
              router.replace('/create-workspace');
            }
          })
          .catch(() => {
            router.replace('/create-workspace');
          });
      })
      .catch(() => {
        router.replace('/login');
      });
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
