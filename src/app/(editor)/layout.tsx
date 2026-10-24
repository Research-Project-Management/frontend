'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import EditorSkeleton from '@/features/editor/core/shell/EditorSkeleton';

let hasHydratedEditor = false;

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = React.useState(() => hasHydratedEditor);

  useEffect(() => {
    hasHydratedEditor = true;
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !user) {
      router.replace('/');
    }
  }, [mounted, isLoading, user, router]);

  // Before mount or while verifying session, render consistent skeleton matching SSR
  if (!mounted || isLoading || !user) {
    return <EditorSkeleton />;
  }

  return (
    <ErrorBoundary
      variant="full"
      featureName="Document Editor"
      description="An issue occurred while rendering the document editor."
    >
      <div className="h-dvh max-h-dvh w-full flex flex-col relative" suppressHydrationWarning>
        <Suspense fallback={<EditorSkeleton />}>
          {children}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
