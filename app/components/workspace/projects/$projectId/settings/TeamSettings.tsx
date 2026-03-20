import { useParams } from "react-router";
import { useProjectDetails, type Project } from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import Loading from "~/components/ui/Loading";
import TopBar from "~/components/workspace/settings/layout/TopBar";
import ProjectTeam from "../Team";

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
      <TopBar
        title="Team"
        description={`Manage members of "${project.name}" project.`}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ProjectTeam />
      </div>
    </div>
  );
}
