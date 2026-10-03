'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getSafeRedirectUrl } from '@/shared/utils/auth-token.util';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  const isForce = searchParams.get('force') === 'true';

  useEffect(() => {
    if (!isLoading && user && !isForce) {
      const redirectParam = searchParams.get('redirect');
      const targetUrl = getSafeRedirectUrl(redirectParam, '/home');
      router.replace(targetUrl);
    }
  }, [isLoading, user, isForce, searchParams, router]);

  // If already authenticated and not forcing account switch, display clean redirect state
  if (!isLoading && user && !isForce) {
    return (
      <main
        className="flex min-h-dvh items-center justify-center bg-background"
        suppressHydrationWarning
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary shrink-0" />
        <span className="sr-only">Redirecting to workspace...</span>
      </main>
    );
  }

  return <>{children}</>;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-dvh items-center justify-center bg-background"
          suppressHydrationWarning
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary shrink-0" />
          <span className="sr-only">Loading...</span>
        </main>
      }
    >
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
