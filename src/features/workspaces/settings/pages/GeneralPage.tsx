'use client';

import TopBar from '../components/TopBar';
import { Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import ProfileSection from '../components/ProfileSection';
import GeneralForm from '../components/GeneralForm';
import DangerZone from '../components/DangerZone';
import DeleteModal from '../components/DeleteModal';

import { useDocumentTitle } from '@/features/workspaces/settings/hooks/use-document-title';
import { useUpdateWorkspace, useDeleteWorkspace, useWorkspaces, useWorkspace } from '@/features/workspaces';
import { Skeleton } from '@/shared/components/ui';
import { useUpload } from '@/features/workspaces';

export default function GeneralPage() {
  useDocumentTitle("General Settings");
  const router = useRouter();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const { workspaceId } = useParams() as { workspaceId: string };
  const { workspace, isLoading, isError } = useWorkspace(workspaceId);
  const { workspaces } = useWorkspaces();
  const { uploadAvatar, isUploading: isUploadingAvatar } = useUpload();

  const updateMutation = useUpdateWorkspace();
  const deleteMutation = useDeleteWorkspace();

  useEffect(() => {
    if (workspace?.avatar) {
      setCurrentAvatar(workspace.avatar);
    }
  }, [workspace?.avatar]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar
          title="General Settings"
          Icon={Settings}
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar
          title="General Settings"
          Icon={Settings}
        />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Error loading workspace settings.
        </div>
      </div>
    );
  }

  const handleUpdate = (values: {
    name: string;
    url?: string;
    avatar?: string | null;
    teamSize?: string;
  }) => {
    updateMutation.mutate(
      {
        id: workspaceId,
        data: {
          name: values.name,
          url: values.url,
          avatar: currentAvatar,
          companySize: values.teamSize,
        },
      },
      {
        onSuccess: () => {
          toast.success("Workspace updated successfully");
          if (values.url && values.url !== workspace.url) {
            router.push(`/${values.url}/settings`);
          }
        },
        onError: () => {
          toast.error("Failed to update workspace");
        },
      }
    );
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const url = await uploadAvatar(file);
      setCurrentAvatar(url);
      updateMutation.mutate({
        id: workspaceId,
      data: { avatar: url },
      });
      toast.success("Avatar updated successfully");
    } catch (error) {
      toast.error("Failed to upload avatar");
    }
  };

  const handleAvatarRemove = () => {
    setCurrentAvatar(null);
    updateMutation.mutate({
      id: workspaceId,
      data: { avatar: null },
    });
    toast.success("Avatar removed");
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      workspaceId,
      {
        onSuccess: () => {
          toast.success("Workspace deleted");
          if (workspaces && workspaces.length > 0) {
            const nextWs = workspaces.find((w: any) => w._id !== workspaceId);
            if (nextWs) {
              router.push(`/${nextWs.url}`);
            } else {
              router.push("/");
            }
          } else {
            router.push("/");
          }
        },
        onError: () => {
          toast.error("Failed to delete workspace");
        },
      }
    );
  };

  const ws = workspace;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="General Settings"
        Icon={Settings}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-8 pb-12">
          
          <ProfileSection url=''
            name={ws.name}
            avatar={currentAvatar}
            
            
          />

          <hr className="border-border" />

          <GeneralForm
            id={ws._id}
            name={ws.name}
            url={ws.url}
            avatar={ws.avatar}
            teamSize={ws.companySize}
            onSubmit={handleUpdate}
          />

          <hr className="border-border" />

          <DangerZone onDelete={() => setIsDeleteOpen(true)} />

        </div>
      </div>

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace? This action cannot be undone."
      />
    </div>
  );
}
