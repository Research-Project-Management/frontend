'use client';

import { useParams } from "next/navigation";
import { useProjectDetails, type Project } from "@/features/workspaces";
import { useWorkspace, useWorkspaceProjects } from '@/features/workspaces';
import { Skeleton } from '@/shared/components/ui';
import ProjectTeam from "../../team/components/Team";
import { useMemo } from "react";

export default function TeamSettings() {
  const { projectId, workspaceId } = useParams() as { projectId: string, workspaceId: string };

  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const { isLoading: isWorkspaceLoading } = useWorkspace(workspaceId!);
  const { projects, isLoading: isProjectsLoading } = useWorkspaceProjects(workspaceId!);

  const pData = projectData as any;
  const project = useMemo(() => {
    // 1. Try data from direct fetch
    const p = (pData?.project || pData) as Project;
    if (p && p._id) return p;

    // 2. Fallback to projects list from workspace
    if (projects) {
      return projects.find((p: any) => p._id === projectId || p.url === projectId) as Project;
    }
    return null;
  }, [projectData, projects, projectId]);

  if ((isProjectLoading && !project) || isWorkspaceLoading || (isProjectsLoading && !projects)) {
    return <div className="p-6 space-y-4"><Skeleton className="h-24 w-full rounded-xl" /></div>;
  }
  if (!project) return <div className="p-6">Project not found</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-hidden w-full">
        <div className="max-w-3xl mx-auto w-full h-full">
          <ProjectTeam />
        </div>
      </div>
    </div>
  );
}

