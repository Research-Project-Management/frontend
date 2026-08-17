'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui';
import { useAuth } from '@/features/auth';
import { apiGet } from '@/shared/lib/api';

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('accessToken')
          : null;

      if (!user && !token) {
        router.replace('/login');
        return;
      }

      if (user) {
        // If user already has workspaces, skip setup and go directly to their workspace
        apiGet<{ workspaces: any[] }>('/api/workspace')
          .then((data) => {
            if (data.workspaces && data.workspaces.length > 0) {
              router.replace(`/${data.workspaces[0].url}`);
            }
          })
          .catch(() => {
            // No workspaces → stay on setup screen (create-workspace)
          });
      }
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-48 w-96 rounded-lg" />
      </div>
    );
  }

  return <>{children}</>;
}
