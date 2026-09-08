'use client';

import { Loader2 } from 'lucide-react';
import { useOAuthCallback } from '../hooks/use-oauth-callback';

/**
 * OAuthCallbackPage
 *
 * Handles redirect after Google / GitHub OAuth.
 * Delegates token parsing, caching, and routing to `useOAuthCallback`.
 */
const OAuthCallbackPage = () => {
  useOAuthCallback();

  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='flex flex-col items-center gap-4'>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
        <p className='text-sm text-muted-foreground'>Completing sign in...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
