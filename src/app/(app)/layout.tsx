'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import AppLoading from './loading';

import Topbar from '@/features/shell/components/Topbar';
import Sidebar from '@/features/shell/components/Sidebar';

import { useAiCompanionStore } from '@/features/ai/store/ai-companion.store';

const AiCompanionSidebar = dynamic(
  () => import('@/features/ai/components/companion/AiCompanionSidebar'),
  { ssr: false, loading: () => null }
);

const FloatingChatWidget = dynamic(
  () => import('@/features/chat/components/FloatingChatWidget'),
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

  // If unauthenticated, prevent rendering app shell and redirect to login
  if (!isLoading && !user) {
    return null;
  }

  if (isPaperReader) {
    return (
      <div className='h-dvh w-full flex flex-col overflow-hidden bg-background' suppressHydrationWarning>
        <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Document Reader">
          <Suspense fallback={<AppLoading />}>
            {children}
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary fallback={null} featureName="Floating Chat">
          <Suspense fallback={null}>
            <FloatingChatWidget />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className='h-dvh max-h-dvh flex flex-col bg-muted relative overflow-hidden' suppressHydrationWarning>
      <ErrorBoundary fallback={null} featureName="Toolbar">
        <Topbar />
      </ErrorBoundary>
      <div className='flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row relative'>
        <ErrorBoundary fallback={null} featureName="Sidebar">
          <Sidebar />
        </ErrorBoundary>
        <div className='order-1 flex-1 min-w-0 rounded-md border border-border bg-background md:order-2 flex flex-col relative min-h-0 overflow-hidden'>
          <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Page Content">
            <Suspense fallback={<AppLoading />}>
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
        {!pathname.startsWith('/chat') && (
          <ErrorBoundary fallback={null} featureName="Floating Chat">
            <Suspense fallback={null}>
              <FloatingChatWidget />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
