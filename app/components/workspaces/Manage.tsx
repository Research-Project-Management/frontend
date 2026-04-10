import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspaces,
} from "../../query/workspace";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import { Pencil, Trash2, Users, ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import DeleteModal from "~/components/workspace/settings/general/components/deleteModal";
import { useUpload } from "~/hooks/useUpload";
import { Avatar } from "../workspace/layout/Avatar";

interface Workspace {
  _id: string;
  name: string;
  url: string;
  avatar: string;
  members: Array<{ user: any; role: string }>;
}

export default function ManageWorkspaces() {
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { uploadAvatar, isUploading: isUploadingAvatar } = useUpload();

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(
    null,
  );
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const updateWorkspace = useUpdateWorkspace();

  const deleteWorkspace = useDeleteWorkspace();

  useEffect(() => {
    return () => {
      if (editAvatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(editAvatarPreview);
      }
    };
  }, [editAvatarPreview]);

  const resetEditState = () => {
    if (editAvatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editAvatarPreview);
    }

    setEditingWorkspace(null);
    setEditName("");
    setEditUrl("");
    setEditAvatar(null);
    setEditAvatarPreview(null);
    setEditAvatarFile(null);
  };

  const editDisplayAvatar = editAvatarPreview || editAvatar;
  const normalizedEditName = editName.trim();
  const hasEditChanges =
    !!editingWorkspace &&
    (normalizedEditName !== editingWorkspace.name.trim() || !!editAvatarFile);

  const handleEdit = (workspace: Workspace) => {
    if (editAvatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editAvatarPreview);
    }

    setEditingWorkspace(workspace);
    setEditName(workspace.name);
    setEditUrl(workspace.url);
    setEditAvatar(workspace.avatar);
    setEditAvatarPreview(null);
    setEditAvatarFile(null);
  };

  const handleDelete = (workspace: Workspace) => {
    setDeletingWorkspace(workspace);
  };

  const confirmUpdate = async () => {
    if (!editingWorkspace) return;
    if (!hasEditChanges) {
      resetEditState();
      return;
    }

    if (!normalizedEditName) {
      toast.error("Workspace name is required");
      return;
    }

    try {
      let finalAvatar = editAvatar;

      if (editAvatarFile) {
        finalAvatar = await uploadAvatar(editAvatarFile);
      }

      updateWorkspace.mutate(
        {
          id: editingWorkspace._id,
          data: {
            name: normalizedEditName,
            ...(finalAvatar ? { avatar: finalAvatar } : {}),
          },
        },
        {
          onSuccess: () => {
            toast.success("Workspace updated");
            resetEditState();
          },
          onError: (error) => {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to update workspace",
            );
          },
        },
      );
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload avatar. Please try again.",
      );
    }
  };

  const confirmDelete = () => {
    if (!deletingWorkspace) return;

    deleteWorkspace.mutate(deletingWorkspace._id, {
      onSuccess: () => {
        setDeletingWorkspace(null);
        toast.success("Workspace deleted successfully");
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to delete workspace",
        );
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-medium text-muted-foreground">
            Loading your workspaces...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">Your Workspaces</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Manage and organize all your workspaces in one place
          </p>
          <Button
            onClick={() => navigate("/create")}
            size="lg"
            className="gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Workspace
          </Button>
        </div>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces?.map((workspace: Workspace) => (
            <Card
              key={workspace._id}
              className="group cursor-pointer select-none p-6 rounded-2xl border-2 hover:border-primary/50 transition-all duration-200"
            >
              {/* Avatar & Info - Centered */}
              <div className="flex flex-col items-center text-center mb-6">
                <Avatar
                  src={workspace.avatar}
                  name={workspace.name}
                  className="w-20 h-20 rounded-2xl mb-4"
                  fallbackType="workspace"
                />
                <h3 className="text-xl font-bold mb-1 truncate w-full">
                  {workspace.name}
                </h3>
                <p className="text-sm text-muted-foreground font-mono truncate w-full">
                  /{workspace.url}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between mb-6 py-3 px-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-medium">
                    {workspace.members?.length || 0}
                  </span>
                  <span className="text-muted-foreground">members</span>
                </div>
                <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                  {workspace.members?.find((m: any) => m.role === "owner")
                    ? "OWNER"
                    : "MEMBER"}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 gap-2 group/btn rounded-xl"
                  onClick={() => navigate(`/${workspace.url}`)}
                >
                  Open
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(workspace)}
                  className="hover:bg-primary/10 hover:text-primary hover:border-primary/50 rounded-xl"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(workspace)}
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingWorkspace}
        onOpenChange={(open) => {
          if (!open && !updateWorkspace.isPending && !isUploadingAvatar) {
            resetEditState();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Workspace</DialogTitle>
            <DialogDescription>
              Update your workspace information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Avatar Preview */}
            {editDisplayAvatar && (
              <div className="flex justify-center">
                <Avatar
                  src={editDisplayAvatar}
                  name={normalizedEditName || editingWorkspace?.name || "Workspace"}
                  className="w-24 h-24 rounded-2xl"
                  fallbackType="workspace"
                />
              </div>
            )}

            {/* Avatar Upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">Avatar</label>
              <input
                type="file"
                id="editAvatarFile"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("File size must be less than 5MB");
                    return;
                  }

                  if (editAvatarPreview?.startsWith("blob:")) {
                    URL.revokeObjectURL(editAvatarPreview);
                  }

                  setEditAvatarFile(file);
                  const previewUrl = URL.createObjectURL(file);
                  setEditAvatarPreview(previewUrl);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document.getElementById("editAvatarFile")?.click()
                }
                className="w-full"
              >
                {isUploadingAvatar ? "Uploading..." : "Upload New Avatar"}
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Workspace Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter workspace name"
                className="text-base"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                URL (read-only)
              </label>
              <Input
                value={editUrl}
                disabled
                className="bg-muted/50 text-base"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetEditState}
              disabled={updateWorkspace.isPending || isUploadingAvatar}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmUpdate}
              disabled={
                isUploadingAvatar || updateWorkspace.isPending || !hasEditChanges
              }
              className="gap-2"
            >
              {isUploadingAvatar
                ? "Uploading..."
                : updateWorkspace.isPending
                  ? "Saving..."
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteModal
        isOpen={!!deletingWorkspace}
        onClose={() => {
          if (!deleteWorkspace.isPending) {
            setDeletingWorkspace(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Delete workspace?"
        description={`Are you sure you want to delete "${deletingWorkspace?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleteWorkspace.isPending}
      />
    </div>
  );
}
