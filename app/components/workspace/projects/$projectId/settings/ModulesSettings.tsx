import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  useProjectDetails,
  useUpdateProject,
  type Project,
} from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import Loading from "~/components/ui/Loading";
import { Button } from "~/components/ui/button";
import TopBar from "~/components/workspace/settings/layout/TopBar";

export default function ModulesSettings() {
  const { projectId, workspaceId } = useParams();

  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const {
    isLoading: isWorkspaceLoading,
    yourRole: workspaceRole,
  } = useWorkspace(workspaceId!);

  const project = projectData?.project as Project;
  const userRole = projectData?.yourRole;

  if (isProjectLoading || isWorkspaceLoading) return <Loading />;
  if (!project) return <div className="p-6">Project not found</div>;

  const canManage =
    userRole === "manager" ||
    workspaceRole === "owner" ||
    workspaceRole === "admin";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Modules"
        description="Enable or disable modules for this project."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 max-w-3xl">
          <ModulesList
            project={project}
            canManage={canManage}
            projectId={projectId!}
          />
        </div>
      </div>
    </div>
  );
}

function ModulesList({
  project,
  canManage,
  projectId,
}: {
  project: Project;
  canManage: boolean;
  projectId: string;
}) {
  const availableModules = [
    {
      id: "overview",
      name: "Overview",
      description: "Project overview and statistics",
    },
    { id: "tasks", name: "Tasks", description: "Task management and tracking" },
    {
      id: "cycles",
      name: "Cycles",
      description: "Research cycles, milestones, and deliverables",
    },
    { id: "pages", name: "Pages", description: "Documentation and wiki pages" },
    {
      id: "storage",
      name: "Storage",
      description: "File storage and management",
    },
    {
      id: "stickies",
      name: "Stickies",
      description: "Sticky notes for quick ideas",
    },
    {
      id: "settings",
      name: "Settings",
      description: "Project settings and configuration",
    },
  ];

  const [selectedModules, setSelectedModules] = useState<string[]>(
    project.modules || [],
  );
  const updateProjectMutation = useUpdateProject();

  const toggleModule = (moduleId: string) => {
    if (!canManage) return;

    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId],
    );
  };

  const handleSave = () => {
    updateProjectMutation.mutate(
      { projectId, modules: selectedModules },
      {
        onSuccess: () => {
          toast.success("Modules updated successfully");
        },
        onError: (error: any) => {
          toast.error(error.message || "Failed to update modules");
        },
      },
    );
  };

  const hasChanges =
    JSON.stringify([...selectedModules].sort()) !==
    JSON.stringify([...project.modules].sort());

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {availableModules.map((module) => (
          <div
            key={module.id}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border ${
              selectedModules.includes(module.id)
                ? "bg-primary/5 border-primary/20"
                : "bg-secondary/10 border-transparent hover:bg-secondary/30"
            } ${!canManage ? "cursor-not-allowed opacity-60" : ""}`}
            onClick={() => toggleModule(module.id)}
          >
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                selectedModules.includes(module.id)
                  ? "text-primary"
                  : "text-muted-foreground/30"
              }`}
            >
              {selectedModules.includes(module.id) ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
              )}
            </div>
            <div className="flex-1">
              <h4
                className={`font-medium ${selectedModules.includes(module.id) ? "text-primary" : "text-foreground"}`}
              >
                {module.name}
              </h4>
              <p className="text-sm text-muted-foreground">
                {module.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {updateProjectMutation.isPending
              ? "Saving…"
              : "Update modules"}
          </Button>
        </div>
      )}
    </div>
  );
}
