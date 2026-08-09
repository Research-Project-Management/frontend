'use client';

import React from 'react';
import Loading from '@/shared/components/ui/Loading';
import { useAuth } from '@/features/auth';

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  return <>{children}</>;
}
