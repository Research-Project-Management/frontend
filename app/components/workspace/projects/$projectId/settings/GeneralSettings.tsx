import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  useDeleteProject,
  useProjectDetails,
  useUpdateProject,
  type Project,
} from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import { Loader2 } from "lucide-react";
import Loading from "~/components/ui/Loading";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import DeleteModal from "~/components/workspace/settings/general/components/deleteModal";

export default function GeneralSettings() {
  const navigate = useNavigate();
  const { projectId, workspaceId } = useParams();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteProjectMutation = useDeleteProject();

  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const {
    workspace,
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
        <div className="px-8 py-8 space-y-8 max-w-3xl mx-auto">
          <GeneralForm
            project={project}
            canManage={canManage}
            projectId={projectId!}
          />

          <hr className="border-border" />

          <DangerZone
            canManage={canManage}
            onDelete={() => setIsDeleteOpen(true)}
          />

          <DeleteModal
            isOpen={isDeleteOpen}
            onClose={() => setIsDeleteOpen(false)}
            onConfirm={() => {
              deleteProjectMutation.mutate(
                { projectId: projectId! },
                {
                  onSuccess: () => {
                    setIsDeleteOpen(false);
                    toast.success("Project deleted successfully");
                    navigate(`/${workspaceId}`, { replace: true });
                  },
                  onError: (error: any) => {
                    toast.error(error.message || "Failed to delete project");
                  },
                },
              );
            }}
            title="Delete project?"
            description="Are you sure you want to delete this project? All data including tasks, pages, and files will be permanently removed."
            confirmText="Delete"
            cancelText="Cancel"
            loading={deleteProjectMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}

function GeneralForm({
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="text-sm font-medium text-foreground"
          >
            Project name
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
            placeholder="Enter project name"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="avatar"
            className="text-sm font-medium text-foreground"
          >
            Avatar URL
          </label>
          <Input
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            disabled={!canManage}
            placeholder="https://example.com/avatar.png"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="text-sm font-medium text-foreground"
        >
          Description
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canManage}
          placeholder="Enter project description"
          rows={4}
          className="resize-none"
        />
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
              : "Update project"}
          </Button>
        </div>
      )}
    </div>
  );
}

function DangerZone({
  canManage,
  onDelete,
}: {
  canManage: boolean;
  onDelete: () => void;
}) {
  if (!canManage) return null;

  return (
    <div className="rounded-lg border border-destructive/30 p-6">
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Delete this project
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            This action is irreversible. All tasks, pages, files, and member
            access will be permanently removed.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          className="shrink-0 transition-colors hover:bg-red-700"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
