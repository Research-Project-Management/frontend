import { useState } from "react";
import { API_URL } from "~/lib/api";
import { useNavigate } from "react-router";
import { useWorkspaces } from "../../query/workspace";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteModal from "~/components/workspace/settings/general/components/deleteModal";

interface Workspace {
  _id: string;
  name: string;
  url: string;
  avatar: string;
  members: Array<{ user: any; role: string }>;
}

export default function ManageWorkspaces() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspaces, isLoading } = useWorkspaces();

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const updateWorkspace = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; avatar?: string };
    }) => {
      const response = await fetch(
        import.meta.env.VITE_API_URL + `/api/workspace/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) throw new Error("Failed to update workspace");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setEditingWorkspace(null);
      setEditAvatarFile(null);
    },
  });

  const deleteWorkspace = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        API_URL + `/api/workspace/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) {
        let msg = "Failed to delete workspace";
        try {
          const data = await response.json();
          msg = data?.error || data?.message || msg;
        } catch {}
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setDeletingWorkspace(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(err?.message || "Failed to delete workspace");
    },
  });

  const handleEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setEditName(workspace.name);
    setEditUrl(workspace.url);
    setEditAvatar(workspace.avatar);
    setEditAvatarFile(null);
  };

  const handleDelete = (workspace: Workspace) => {
    setDeletingWorkspace(workspace);
    setDeleteError(null);
  };

  const confirmUpdate = async () => {
    if (!editingWorkspace) return;

    try {
      let finalAvatar = editAvatar;

      // Upload avatar if file selected
      if (editAvatarFile) {
        setIsUploadingAvatar(true);

        const presignResponse = await fetch(
          import.meta.env.VITE_API_URL + "/api/files/presign",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              fileName: `avatars/${Date.now()}-${editAvatarFile.name}`,
            }),
          },
        );

        if (!presignResponse.ok) throw new Error("Failed to get upload URL");

        const { url: presignedUrl, path } = await presignResponse.json();

        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": editAvatarFile.type },
          body: editAvatarFile,
        });

        if (!uploadResponse.ok) throw new Error("Failed to upload file");

        finalAvatar = `${import.meta.env.VITE_API_URL}/api/files/${path}`;
        setIsUploadingAvatar(false);
      }

      updateWorkspace.mutate({
        id: editingWorkspace._id,
        data: {
          name: editName,
          ...(finalAvatar && { avatar: finalAvatar }),
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload avatar. Please try again.");
      setIsUploadingAvatar(false);
    }
  };

  const confirmDelete = () => {
    if (!deletingWorkspace) return;
    const shouldRedirectToCreate = (workspaces?.length || 0) === 1;
    setDeleteError(null);
    deleteWorkspace.mutate(deletingWorkspace._id, {
      onSuccess: () => {
        if (shouldRedirectToCreate) {
          navigate("/create");
        }
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
                <img
                  src={workspace.avatar}
                  alt={workspace.name}
                  className="w-20 h-20 rounded-2xl object-cover mb-4"
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
        onOpenChange={(open) => !open && setEditingWorkspace(null)}
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
            {editAvatar && (
              <div className="flex justify-center">
                <img
                  src={editAvatar}
                  alt="Avatar preview"
                  className="w-24 h-24 rounded-2xl object-cover"
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
                    alert("File size must be less than 5MB");
                    return;
                  }

                  setEditAvatarFile(file);
                  const previewUrl = URL.createObjectURL(file);
                  setEditAvatar(previewUrl);
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
            <Button variant="outline" onClick={() => setEditingWorkspace(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmUpdate}
              disabled={isUploadingAvatar || updateWorkspace.isPending}
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
            setDeleteError(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Delete workspace?"
        description={`Are you sure you want to delete "${deletingWorkspace?.name}"? This action cannot be undone.${deleteError ? ` ${deleteError}` : ""}`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleteWorkspace.isPending}
      />
    </div>
  );
}
