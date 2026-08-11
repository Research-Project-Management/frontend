'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui';
import { useWorkspaces } from '@/features/workspaces/shell/hooks/use-workspace';

export default function DashboardPage() {
  const router = useRouter();
  const { workspaces, isLoading } = useWorkspaces();

  const redirectTarget = useMemo(() => {
    if (isLoading || !workspaces) return null;
    return workspaces.length > 0 ? `/${workspaces[0].url}` : '/create-workspace';
  }, [isLoading, workspaces]);

  useEffect(() => {
    if (!redirectTarget) return;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  return <Skeleton className="h-48 w-full rounded-xl" />;
}
