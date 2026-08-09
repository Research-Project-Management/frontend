'use client';

import { use } from 'react';
import { PagesDashboard } from '@/features/workspaces/projects';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default function ProjectPagesPage({ params }: Props) {
  const { projectId } = use(params);
  return <PagesDashboard projectId={projectId} />;
}
