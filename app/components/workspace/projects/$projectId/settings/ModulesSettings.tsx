import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  useProjectDetails,
  useUpdateProject,
  type Project,
} from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import { Loader2, CheckCircle2 } from "lucide-react";
import Loading from "~/components/ui/Loading";
import { Button } from "~/components/ui/button";

type ProjectModuleKey =
  | "overview"
  | "tasks"
  | "cycles"
  | "pages"
  | "storage"
  | "stickies"
  | "settings";

const MODULE_ORDER: ProjectModuleKey[] = [
  "overview",
  "pages",
  "tasks",
  "cycles",
  "storage",
  "stickies",
  "settings",
];

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




      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 max-w-3xl mx-auto">
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
  const availableModules: {
    id: ProjectModuleKey;
    name: string;
    description: string;
    locked?: boolean;
  }[] = [
    {
      id: "overview",
      name: "Overview",
      description: "Project overview and statistics",
      locked: true,
    },
    { id: "pages", name: "Pages", description: "Documentation and wiki pages" },
    { id: "tasks", name: "Tasks", description: "Task management and tracking" },
    {
      id: "cycles",
      name: "Cycles",
      description: "Research cycles, milestones, and deliverables",
    },
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
      locked: true,
    },
  ];

  const normalizedProjectModules = useMemo(() => {
    const selectedModules = new Set(project.modules || []);
    selectedModules.add("overview");
    selectedModules.add("settings");
    return MODULE_ORDER.filter((moduleId) => selectedModules.has(moduleId));
  }, [project.modules]);
  const [selectedModules, setSelectedModules] = useState<ProjectModuleKey[]>(
    normalizedProjectModules,
  );
  const updateProjectMutation = useUpdateProject();

  useEffect(() => {
    setSelectedModules(normalizedProjectModules);
  }, [normalizedProjectModules]);

  const toggleModule = (moduleId: ProjectModuleKey) => {
    if (!canManage) return;
    if (moduleId === "overview" || moduleId === "settings") return;

    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : MODULE_ORDER.filter((currentModuleId) =>
            new Set([...prev, moduleId]).has(currentModuleId),
          ),
    );
  };

  const handleSave = () => {
    updateProjectMutation.mutate(
      {
        projectId,
        modules: MODULE_ORDER.filter((moduleId) =>
          selectedModules.includes(moduleId),
        ),
      },
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
    JSON.stringify(selectedModules) !== JSON.stringify(normalizedProjectModules);

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {availableModules.map((module) => (
          <div
            key={module.id}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 border ${
              selectedModules.includes(module.id)
                ? "bg-primary/5 border-primary/20"
                : "bg-secondary/10 border-transparent hover:bg-secondary/30"
            } ${(!canManage || module.id === 'overview' || module.id === 'settings') ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
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
