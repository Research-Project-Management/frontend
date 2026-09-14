'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';

export default function WorkspaceViewsRedirectPage() {
  const router = useRouter();
  const { projects = [], isLoading } = useProjects();

  useEffect(() => {
    if (isLoading) return;
    if (projects && projects.length > 0) {
      router.replace(`/projects/${projects[0].id}/views`);
    } else {
      router.replace('/projects');
    }
  }, [projects, isLoading, router]);

  return null;
}
