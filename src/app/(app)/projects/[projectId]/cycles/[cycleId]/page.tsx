'use client';

import { use } from 'react';
import Page from '@/features/workspaces/projects/project-id/work-items/pages/Page';
import { useProjectCycles, deriveStatus } from '@/features/workspaces/projects/project-id/cycles/hooks/use-cycle';

interface Props {
  params: Promise<{ projectId: string; cycleId: string }>;
}

export default function CycleDetailPage({ params }: Props) {
  const { projectId, cycleId } = use(params);
  const { data: cyclesData } = useProjectCycles(projectId);
  const currentCycle = cyclesData?.cycles.find((c: any) => c.id === cycleId);
  const isReadOnly = currentCycle ? deriveStatus(currentCycle) === 'completed' : false;

  return <Page cycleId={cycleId} isReadOnly={isReadOnly} />;
}
