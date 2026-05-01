import Task from "~/components/workspace/projects/$projectId/Task/Task";
import { useParams } from "react-router";
import { useProjectCycles } from "~/query/cycle";
import { useCycle } from "~/hooks/useCycle";

export function meta() {
  return [{ title: "Cycle Details · Flux" }];
}

export default function CycleDetailPage() {
  const { projectId, cycleId } = useParams();
  const { data: cyclesData } = useProjectCycles(projectId!);
  const currentCycle = cyclesData?.cycles.find(c => c._id === cycleId);
  const { isCycleReadOnly } = useCycle(projectId!);
  
  const isReadOnly = currentCycle ? isCycleReadOnly(currentCycle) : false;

  return <Task cycleId={cycleId} isReadOnly={isReadOnly} />;
}
