'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ErrorBoundary } from '@/shared/components/ui';

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

  // Show loading indicator while session is being verified
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading workspace..."
        className="flex h-dvh w-full items-center justify-center bg-background"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary shrink-0" />
        <span className="sr-only">Loading workspace...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary
      variant="full"
      featureName="Document Editor"
      description="An issue occurred while rendering the document editor."
    >
      {children}
    </ErrorBoundary>
  );
}
