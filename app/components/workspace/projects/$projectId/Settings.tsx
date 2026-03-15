import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  useProjectDetails,
  useUpdateProject,
  type Project,
} from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Users,
  Layout,
  Info,
  CheckCircle2,
} from "lucide-react";
import Loading from "~/components/ui/Loading";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import ProjectTeam from "./Team";
import Header from "../layout/Header";

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="w-full">
    <div className="mb-6">
      <h2 className="text-primary/50 font-semibold text-lg">{title}</h2>
      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}
    </div>
    <div className="relative">{children}</div>
  </div>
);

export default function ProjectSettings() {
  const { projectId, workspaceId: workspaceUrl } = useParams();
  const [activeTab, setActiveTab] = useState("general");

  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const {
    workspace,
    isLoading: isWorkspaceLoading,
    yourRole: workspaceRole,
  } = useWorkspace(workspaceUrl!);

  const project = projectData?.project as Project;
  const userRole = projectData?.yourRole;

  if (isProjectLoading || isWorkspaceLoading) return <Loading />;
  if (!project) return <div className="p-6">Project not found</div>;

  const canManageSettings =
    userRole === "manager" ||
    workspaceRole === "owner" ||
    workspaceRole === "admin";

  return (
    <div className="flex flex-col h-full">
      <Header title="Project Settings" Icon={SettingsIcon} />

      <div className="flex-1 p-6  flex flex-col items-center overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto space-y-8">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-secondary/30 mb-8">
              <TabsTrigger value="general">
                <Info className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="team">
                <Users className="h-4 w-4 mr-2" />
                Team
              </TabsTrigger>
              <TabsTrigger value="modules">
                <Layout className="h-4 w-4 mr-2" />
                Modules
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <GeneralSettings
                project={project}
                canManage={canManageSettings}
                projectId={projectId!}
              />
            </TabsContent>

            <TabsContent value="team">
              <div className="min-h-[400px]">
                <ProjectTeam />
              </div>
            </TabsContent>

            <TabsContent value="modules">
              <ModulesSettings
                project={project}
                canManage={canManageSettings}
                projectId={projectId!}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function GeneralSettings({
  project,
  canManage,
  projectId,
}: {
  project: Project;
  canManage: boolean;
  projectId: string;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [avatar, setAvatar] = useState(project.avatar || "");

  const updateProjectMutation = useUpdateProject();

  const handleSave = () => {
    updateProjectMutation.mutate(
      { projectId, name, description, avatar },
      {
        onSuccess: () => {
          toast.success("Project settings updated successfully");
        },
        onError: (error: any) => {
          toast.error(error.message || "Failed to update project settings");
        },
      },
    );
  };

  const hasChanges =
    name !== project.name ||
    description !== project.description ||
    avatar !== (project.avatar || "");

  return (
    <Section
      title="General Information"
      description="Update your project's basic information"
    >
      <div className="space-y-6 ">
        <div className="space-y-2">
          <Label htmlFor="name">Project Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
            placeholder="Enter project name"
            className="bg-background border border-input hover:border-primary/50 focus:border-primary transition-colors"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canManage}
            placeholder="Enter project description"
            rows={4}
            className="bg-background border border-input hover:border-primary/50 focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            disabled={!canManage}
            placeholder="https://example.com/avatar.png"
            className="bg-background border border-input hover:border-primary/50 focus:border-primary transition-colors"
          />
        </div>

        {canManage && (
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function ModulesSettings({
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
    JSON.stringify(selectedModules.sort()) !==
    JSON.stringify(project.modules.sort());

  return (
    <Section
      title="Project Modules"
      description="Enable or disable modules for this project"
    >
      <div className="grid gap-3 ">
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
        <div className="flex justify-end pt-8 l">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </Section>
  );
}
