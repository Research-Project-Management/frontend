import { useParams } from "react-router";
import { useProjectDetails, type Project } from "~/query/project";
import { useWorkspace, useWorkspaceProjects } from "~/query/workspace";
import Loading from "~/components/ui/Loading";
import ProjectTeam from "../team/Team";
import { useMemo } from "react";

export default function TeamSettings() {
  const { projectId, workspaceId } = useParams();

  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const { isLoading: isWorkspaceLoading } = useWorkspace(workspaceId!);
  const { projects, isLoading: isProjectsLoading } = useWorkspaceProjects(workspaceId!);

  const project = useMemo(() => {
    // 1. Try data from direct fetch
    const p = (projectData?.project || projectData) as Project;
    if (p && p._id) return p;

    // 2. Fallback to projects list from workspace
    if (projects) {
      return projects.find((p: any) => p._id === projectId || p.url === projectId) as Project;
    }
    return null;
  }, [projectData, projects, projectId]);

  if ((isProjectLoading && !project) || isWorkspaceLoading || (isProjectsLoading && !projects)) return <Loading />;
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
