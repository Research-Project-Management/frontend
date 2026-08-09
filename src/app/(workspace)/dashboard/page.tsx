'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui';
import { useWorkspaces } from '@/features/workspaces';

export default function DashboardPage() {
  const router = useRouter();
  const { workspaces, isLoading } = useWorkspaces();

  useEffect(() => {
    if (isLoading) return;

    if (workspaces && workspaces.length > 0) {
      router.replace(`/${workspaces[0].url}`);
    } else {
      router.replace('/create-workspace');
    }
  }, [workspaces, isLoading, router]);

  return <Skeleton className="h-48 w-full rounded-xl" />;
}
