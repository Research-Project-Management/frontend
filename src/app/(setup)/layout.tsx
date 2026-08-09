'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui';
import { useAuth } from '@/features/auth';

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return <>{children}</>;
}
