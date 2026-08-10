'use client';

import { use } from 'react';
import { Task } from '@/features/workspaces/projects/project-id/tasks';
import { useProjectCycles } from '@/features/workspaces/projects/project-id/cycles';
import { deriveStatus } from '@/features/workspaces/projects/project-id/cycles';

interface Props {
  params: Promise<{ projectId: string; cycleId: string }>;
}

export default function CycleDetailPage({ params }: Props) {
  const { projectId, cycleId } = use(params);
  const { data: cyclesData } = useProjectCycles(projectId);
  const currentCycle = cyclesData?.cycles.find((c: any) => c._id === cycleId);
  const isReadOnly = currentCycle ? deriveStatus(currentCycle) === 'completed' : false;

  return <Task cycleId={cycleId} isReadOnly={isReadOnly} />;
}
