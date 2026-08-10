'use client';

import { use } from 'react';
import { DraftPage } from '@/features/workspaces/projects';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default function ProjectPagesPage({ params }: Props) {
  const { projectId } = use(params);
  return <DraftPage projectId={projectId} />;
}
