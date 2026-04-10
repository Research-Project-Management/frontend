import { useParams } from "react-router";
import { useProjectDetails, type Project } from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import Loading from "~/components/ui/Loading";
import ProjectTeam from "../team/Team";

export default function TeamSettings() {
  const { projectId, workspaceId } = useParams();

  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const { isLoading: isWorkspaceLoading } = useWorkspace(workspaceId!);

  const project = projectData?.project as Project;

  if (isProjectLoading || isWorkspaceLoading) return <Loading />;
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
