import TopBar from "../layout/TopBar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import ProfileSection from "./sections/ProfileSection";
import GeneralForm from "./sections/GeneralForm";
import DangerZone from "./sections/DangerZone";
import DeleteModal from "./components/deleteModal";

import { useWorkspace } from "~/hooks";
import {
  useUpdateWorkspace,
  useDeleteWorkspace,
  useWorkspaces,
} from "~/query/workspace";
import { Skeleton } from "~/components/ui/skeleton";
import { useUpload } from "~/hooks/useUpload";
import { Avatar } from "../../layout/Avatar";

export default function GeneralPage() {
  const navigate = useNavigate();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const { workspace, isLoading, isError } = useWorkspace();
  const { workspaces } = useWorkspaces();
  const { uploadAvatar, isUploading: isUploadingAvatar } = useUpload();

  const updateMutation = useUpdateWorkspace();
  const deleteMutation = useDeleteWorkspace();

  useEffect(() => {
    if (workspace?.workspace?.avatar) {
      setCurrentAvatar(workspace.workspace.avatar);
    }
  }, [workspace?.workspace?.avatar]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <div className="flex-1 px-8 py-8 space-y-6 max-w-3xl">
          <div className="flex items-center gap-5">
            <Skeleton className="size-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Workspace not found
      </div>
    );
  }

  const ws = workspace.workspace;

  const handleAvatarUpload = async (file: File) => {
    try {
      const finalAvatarUrl = await uploadAvatar(file);
      setCurrentAvatar(finalAvatarUrl);

      updateMutation.mutate(
        { id: ws._id, data: { avatar: finalAvatarUrl } },
        {
          onSuccess: () => {
            toast.success("Avatar updated");
          },
          onError: (err: any) => {
            toast.error(err?.message || "Failed to update avatar");
            setCurrentAvatar(ws.avatar || null);
          },
        }
      );
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload avatar. Please try again.");
      setCurrentAvatar(ws.avatar || null);
    }
  };

  const handleUpdate = (values: {
    name: string;
    url?: string;
    avatar?: string | null;
    companySize?: string;
    timezone?: string;
  }) => {
    const payload: typeof values = { ...values };
    if (payload.avatar === null) {
      delete payload.avatar;
    }

    updateMutation.mutate(
      { id: ws._id, data: payload },
      {
        onSuccess: () => toast.success("Workspace updated"),
        onError: (err: any) =>
          toast.error(err?.message || "Failed to update workspace"),
      }
    );
  };

  const handleDelete = () => {
    const shouldRedirectToCreate = (workspaces?.length || 0) === 1;

    deleteMutation.mutate(ws._id, {
      onSuccess: () => {
        toast.success("Workspace deleted");
        navigate(shouldRedirectToCreate ? "/create" : "/");
      },
      onError: (err: any) =>
        toast.error(err?.message || "Failed to delete workspace"),
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="General"
        description="Manage your workspace profile, settings, and preferences."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 space-y-8 max-w-3xl">
          <ProfileSection
            name={ws.name}
            url={ws.url}
            avatar={currentAvatar || ws.avatar}
            onAvatarUpload={handleAvatarUpload}
            isUploadingAvatar={isUploadingAvatar}
          />

          <hr className="border-border" />

          <GeneralForm
            id={ws._id}
            name={ws.name}
            url={ws.url}
            avatar={ws.avatar}
            companySize={ws.companySize}
            timezone={ws.timezone}
            onSubmit={handleUpdate}
            isSubmitting={updateMutation.isPending}
          />

          <hr className="border-border" />

          <DangerZone onDelete={() => setIsDeleteOpen(true)} />

          <DeleteModal
            isOpen={isDeleteOpen}
            onClose={() => setIsDeleteOpen(false)}
            onConfirm={() => {
              setIsDeleteOpen(false);
              handleDelete();
            }}
            title="Delete workspace?"
            description="Are you sure you want to delete this workspace? This action cannot be undone."
            confirmText="Delete"
            cancelText="Dismiss"
            loading={deleteMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
