'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui';
import { useWorkspaces } from '@/features/workspaces/shell/hooks/use-workspace';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data, isLoading: isWorkspacesLoading } = useWorkspaces();

  const workspaces: any[] = data?.workspaces ?? [];

  const isLoading = isAuthLoading || isWorkspacesLoading;

  const redirectTarget = useMemo(() => {
    if (isLoading) return null;
    if (!user) return '/login';
    return workspaces.length > 0 ? `/${workspaces[0].url}` : '/create-workspace';
  }, [isLoading, user, workspaces]);

  useEffect(() => {
    if (!redirectTarget) return;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Skeleton className="h-48 w-96 rounded-lg" />
    </div>
  );
}
