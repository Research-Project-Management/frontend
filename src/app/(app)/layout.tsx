'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';

const Topbar = dynamic(
  () => import('@/features/workspaces/shell/components/Topbar'),
  { ssr: true, loading: () => null }
);

const Sidebar = dynamic(
  () => import('@/features/workspaces/shell/components/Sidebar'),
  { ssr: true, loading: () => null }
);

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
        pathname && pathname !== '/'
          ? `/login?redirect=${encodeURIComponent(pathname)}`
          : '/login';
      router.replace(redirectUrl);
    }
  }, [isLoading, user, router, pathname]);

  // If unauthenticated, prevent rendering app shell and redirect to login
  if (!isLoading && !user) {
    return null;
  }

  // Show loading indicator while session is being verified
  if (isLoading) {
    return (
      <div className='flex h-dvh w-full items-center justify-center bg-background'>
        <Loader2 className='h-8 w-8 animate-spin text-primary shrink-0' />
      </div>
    );
  }

  if (isPaperReader) {
    return (
      <div className='h-dvh w-full overflow-hidden bg-background'>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </div>
    );
  }

  return (
    <div className='h-dvh flex flex-col overflow-clip bg-muted'>
      <Suspense fallback={null}>
        <Topbar />
      </Suspense>
      <div className='flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row'>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
        <div className='order-1 flex-1 min-w-0 rounded-md border border-border bg-background overflow-hidden md:order-2 flex flex-col relative'>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
