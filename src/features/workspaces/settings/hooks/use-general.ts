import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { GeneralSettingsSchema } from '@/features/workspaces/settings/schemas/settings.schema';
import type { GeneralSettingsFormValues } from '@/features/workspaces/settings/types/settings.types';
import { useUpdateWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useDeleteWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useWorkspaces } from '@/features/workspaces/shell/hooks/use-workspace';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useUpload } from '@/shared/hooks';

export function useGeneral(workspaceId: string) {
  const router = useRouter();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  
  const { workspace, isLoading, isError } = useWorkspace(workspaceId);
  const { workspaces } = useWorkspaces();
  const { uploadFile, isUploading: isUploadingAvatar } = useUpload();

  const updateMutation = useUpdateWorkspace();
  const deleteMutation = useDeleteWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);

  const [host, setHost] = useState("flux.chqv.tech");
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.host);
    }
  }, []);

  const form = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(GeneralSettingsSchema),
    defaultValues: {
      name: "",
      url: "",
      avatar: "",
      teamSize: "2-10",
    },
  });

  useEffect(() => {
    if (workspace) {
      setCurrentAvatar(workspace.avatar || null);
      form.reset({
        name: workspace.name || "",
        url: workspace.url || "",
        avatar: workspace.avatar || "",
        teamSize: (workspace.companySize as GeneralSettingsFormValues["teamSize"]) || "2-10",
      });
    }
  }, [workspace, form]);

  const handleUpdate = (values: GeneralSettingsFormValues) => {
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
          if (values.url && values.url !== workspace?.url) {
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
      const url = await uploadFile(file, 'workspace/avatars');
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

  const hasChanges = 
    form.watch("name") !== (workspace?.name || "") ||
    form.watch("teamSize") !== (workspace?.companySize || "");
    
  return {
    form,
    workspace,
    isLoading,
    isError,
    host,
    currentAvatar,
    isUploadingAvatar,
    fileRef,
    isDeleteOpen,
    setIsDeleteOpen,
    handleUpdate,
    handleAvatarUpload,
    handleDelete,
    isSubmitting: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    hasChanges
  };
}


