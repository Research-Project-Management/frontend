'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { hasAuthToken, getAuthToken } from '@/shared/lib/token-storage';
import { isTokenValid } from '@/shared/utils/auth-token.util';

export function HeroCta() {
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authed = Boolean(
      user || (typeof window !== 'undefined' && hasAuthToken() && isTokenValid(getAuthToken()))
    );
    setIsAuthenticated(authed);
  }, [user]);

  return (
    <div className='flex flex-col sm:flex-row gap-2.5 justify-center pt-2'>
      <Link
        href={isAuthenticated ? '/home' : '/register'}
        className='group flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-13 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0'
      >
        {isAuthenticated ? 'Go to workspace' : 'Start for free'}
        <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-0.5 shrink-0' aria-hidden='true' />
      </Link>
      <Link
        href={isAuthenticated ? '/home' : '/login'}
        className='flex h-9 items-center justify-center rounded-md border border-border bg-card shadow-hairline px-4 text-13 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0'
      >
        {isAuthenticated ? 'Open projects' : 'Sign in'}
      </Link>
    </div>
  );
}
