'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ErrorBoundary } from '@/shared/components/ui';

const Topbar = dynamic(
  () => import('@/features/shell/components/Topbar'),
  { ssr: true, loading: () => null }
);

const Sidebar = dynamic(
  () => import('@/features/shell/components/Sidebar'),
  { ssr: true, loading: () => null }
);

import { useAiCompanionStore } from '@/features/ai/store';

const AiCompanionSidebar = dynamic(
  () => import('@/features/ai/components/companion/AiCompanionSidebar'),
  { ssr: false, loading: () => null }
);

function AiCompanionSlot() {
  const isOpen = useAiCompanionStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <AiCompanionSidebar />;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const isPaperReader = pathname.includes('/library/papers/');

  useEffect(() => {
    if (!isLoading && !user) {
      const redirectUrl =
        pathname && pathname !== '/' && !pathname.startsWith('/login')
          ? `/login?redirect=${encodeURIComponent(pathname)}`
          : '/login';
      router.replace(redirectUrl);
    }
  }, [isLoading, user, router, pathname]);

  useEffect(() => {
    document.documentElement.classList.add('overflow-hidden');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  // If unauthenticated, prevent rendering app shell and redirect to login
  if (!isLoading && !user) {
    return null;
  }

  // Show loading indicator while session is being verified
  if (isLoading) {
    return (
      <div className='flex h-dvh w-full items-center justify-center bg-background' suppressHydrationWarning>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
      </div>
    );
  }

  if (isPaperReader) {
    return (
      <div className='h-dvh w-full overflow-hidden bg-background' suppressHydrationWarning>
        <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Document Reader">
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className='h-dvh max-h-dvh flex flex-col overflow-hidden bg-muted' suppressHydrationWarning>
      <ErrorBoundary fallback={null} featureName="Toolbar">
        <Suspense fallback={null}>
          <Topbar />
        </Suspense>
      </ErrorBoundary>
      <div className='flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row'>
        <ErrorBoundary fallback={null} featureName="Sidebar">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
        </ErrorBoundary>
        <div className='order-1 flex-1 min-w-0 rounded-md border border-border bg-background overflow-hidden md:order-2 flex flex-col relative'>
          <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Page Content">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </div>
        {!pathname.startsWith('/ai') && (
          <ErrorBoundary fallback={null} featureName="AI Companion">
            <Suspense fallback={null}>
              <AiCompanionSlot />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
