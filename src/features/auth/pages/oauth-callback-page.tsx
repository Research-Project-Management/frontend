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
    <main className='flex min-h-dvh items-center justify-center bg-background' suppressHydrationWarning>
      <div className='flex flex-col items-center gap-4' suppressHydrationWarning>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
        <span className='sr-only'>Completing sign in...</span>
        <p className='text-sm text-muted-foreground'>Completing sign in...</p>
      </div>
    </main>
  );
};

export default OAuthCallbackPage;
