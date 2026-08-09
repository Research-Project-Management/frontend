'use client';

import { use } from 'react';
import { Task } from '@/features/tasks';
import { useProjectCycles } from '@/features/cycles';
import { deriveStatus } from '@/features/cycles';

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
