'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import EditorSkeleton from '@/features/editor/core/shell/EditorSkeleton';

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  // If unauthenticated, block rendering and redirect to marketing
  if (!isLoading && !user) {
    return null;
  }

  // Show instant workbench skeleton while session is being verified
  if (isLoading) {
    return <EditorSkeleton />;
  }

  return (
    <ErrorBoundary
      variant="full"
      featureName="Document Editor"
      description="An issue occurred while rendering the document editor."
    >
      <div className="h-dvh max-h-dvh w-full flex flex-col relative overflow-hidden" suppressHydrationWarning>
        <Suspense fallback={<EditorSkeleton />}>
          {children}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
