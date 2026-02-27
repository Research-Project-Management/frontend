import TopBar from "../layout/TopBar";
import { Calculator } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import ProfileSection from "./sections/ProfileSection";
import GeneralForm from "./sections/GeneralForm";
import DangerZone from "./sections/DangerZone";
import DeleteModal from "./components/deleteModal";

import { useWorkspace } from "~/hooks";
import { useUpdateWorkspace, useDeleteWorkspace } from "~/query/workspace";

export default function GeneralPage() {
  const navigate = useNavigate();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(
    null
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { workspace, isLoading, isError } = useWorkspace();

  const updateMutation = useUpdateWorkspace();
  const deleteMutation = useDeleteWorkspace();

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError || !workspace)
    return <div className="p-6">Workspace not found</div>;
  const ws = workspace.workspace;

  // Initialize avatar on mount/workspace change
  if (currentAvatar === null && ws.avatar) {
    setCurrentAvatar(ws.avatar);
  }

  const handleAvatarUpload = async (file: File) => {
    try {
      setIsUploadingAvatar(true);
      setAvatarFile(file);

      // Get presigned URL
      const presignResponse = await fetch(
        import.meta.env.VITE_API_URL + "/api/files/presign",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fileName: `avatars/${Date.now()}-${file.name}`,
          }),
        }
      );

      if (!presignResponse.ok) throw new Error("Failed to get upload URL");

      const { url: presignedUrl, path } = await presignResponse.json();

      // Upload to presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload file");

      const finalAvatarUrl = `${import.meta.env.VITE_API_URL}/api/files/${path}`;
      setCurrentAvatar(finalAvatarUrl);
      setIsUploadingAvatar(false);

      // Update workspace with new avatar
      updateMutation.mutate(
        { id: ws._id, data: { avatar: finalAvatarUrl } },
        {
          onSuccess: () => {
            toast.success("Avatar updated");
            setAvatarFile(null);
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
      setIsUploadingAvatar(false);
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
    deleteMutation.mutate(ws._id, {
      onSuccess: () => {
        toast.success("Workspace deleted");
        navigate("/");
      },
      onError: (err: any) =>
        toast.error(err?.message || "Failed to delete workspace"),
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="General" Icon={Calculator} />
      <div className="flex-1 py-9 mx-auto space-y-6 w-full max-w-225 flex flex-col overflow-hidden">
        <ProfileSection
          name={ws.name}
          url={ws.url}
          avatar={currentAvatar || ws.avatar}
          onAvatarUpload={handleAvatarUpload}
          isUploadingAvatar={isUploadingAvatar}
        />
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
  );
}
