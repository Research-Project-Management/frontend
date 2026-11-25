'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import AppLoading from './loading';

import Topbar from '@/features/shell/components/Topbar';
import Sidebar from '@/features/shell/components/Sidebar';
import { useWebWorkspaceShell } from '@/features/shell/hooks/use-web-bff';
import ProjectLayout from '@/features/projects/shell/components/ProjectLayout';

import { useAiCompanionStore } from '@/features/ai';

const StickyDock = dynamic(() => import('@/features/shell/components/StickyDock'), {
  ssr: false,
});

const CompanionDrawer = dynamic(
  () => import('@/features/ai').then((m) => m.CompanionDrawer),
  { ssr: false, loading: () => null }
);

const PROJECT_WORKSPACE_PREFIXES = [
  '/home',
  '/projects',
  '/drafts',
  '/stickies',
  '/your-work',
  '/storage',
];

function isProjectWorkspaceRoute(pathname: string): boolean {
  if (
    pathname === '/projects/pages' ||
    /^\/projects\/[^/]+\/pages(\/|$)/.test(pathname) ||
    /^\/projects\/[^/]+\/settings(\/|$)/.test(pathname)
  ) {
    return false;
  }
  return PROJECT_WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function AiCompanionSlot() {
  const isOpen = useAiCompanionStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <CompanionDrawer />;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  useWebWorkspaceShell(Boolean(user));
  const isPaperReader = pathname.includes('/library/papers/');
  const isProjectWorkspace = isProjectWorkspaceRoute(pathname);

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
      <div className='h-dvh w-full flex flex-row overflow-hidden bg-background relative' suppressHydrationWarning>
        <div className='flex-1 min-w-0 h-full flex flex-col overflow-hidden relative'>
          <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Document Reader">
            <Suspense fallback={<AppLoading />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </div>
        <ErrorBoundary fallback={null} featureName="Quick Tools Hub">
          <StickyDock mode="floating" />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className='h-dvh max-h-dvh flex flex-col bg-muted relative overflow-hidden' suppressHydrationWarning>
      <ErrorBoundary fallback={null} featureName="Toolbar">
        <Topbar />
      </ErrorBoundary>
      <div className='flex w-full flex-1 min-h-0 flex-col md:flex-row relative'>
        <ErrorBoundary fallback={null} featureName="Sidebar">
          <Sidebar />
        </ErrorBoundary>
        <div className='order-1 flex-1 min-w-0 rounded-md border border-border bg-background md:order-2 md:mr-2 md:mb-2 flex flex-col relative min-h-0 overflow-hidden'>
          {isProjectWorkspace ? (
            <ProjectLayout>
              <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Page Content">
                <Suspense fallback={<AppLoading />}>
                  {children}
                </Suspense>
              </ErrorBoundary>
            </ProjectLayout>
          ) : (
            <ErrorBoundary resetKeys={[pathname]} variant="full" featureName="Page Content">
              <Suspense fallback={<AppLoading />}>
                {children}
              </Suspense>
            </ErrorBoundary>
          )}
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
