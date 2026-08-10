'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useProjectDetails, useUpload } from "@/features/workspaces";
import { useUpdateProject, useDeleteProject } from "@/features/workspaces/projects/shell/services/project.services";
import { Button, Input, Label, Textarea, Skeleton } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import DeleteModal from '@/features/workspaces/settings/components/DeleteModal';
import { Loader2 } from "lucide-react";

export default function GeneralPage() {
  const router = useRouter();
  const { workspaceId, projectId } = useParams() as { workspaceId: string, projectId: string };
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const { uploadAvatar, isUploading } = useUpload();
  
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const p = (projectData as any)?.project || projectData;

  useEffect(() => {
    if (p) {
      setName(p.name || "");
      setDescription(p.description || "");
      setCurrentAvatar(p.avatar || null);
    }
  }, [p]);

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-64 w-full rounded-xl" /></div>;
  }

  if (isError || !p) {
    return <div className="p-8 text-zinc-500">Error loading project.</div>;
  }

  const handleUpdate = () => {
    updateMutation.mutate({
      projectId,
      name,
      description,
      avatar: currentAvatar || undefined
    }, {
      onSuccess: () => toast.success("Project updated successfully")
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(file);
      setCurrentAvatar(url);
      updateMutation.mutate({ projectId, avatar: url });
      toast.success("Avatar updated");
    } catch (err) {
      toast.error("Failed to upload avatar");
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate({ projectId }, {
      onSuccess: () => {
        toast.success("Project deleted");
        router.push(`/${workspaceId}`);
      },
      onError: () => toast.error("Failed to delete project")
    });
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-8 h-full bg-white">
      <div>
        <h2 className="text-[17px] font-semibold text-zinc-900">Project Details</h2>
        <p className="text-[13px] text-zinc-400 mt-1">
          Manage your project's identity and basic information.
        </p>
      </div>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <Avatar className="h-16 w-16 border rounded-sm">
            <AvatarImage src={currentAvatar || ""} className="object-cover" />
            <AvatarFallback className="rounded-sm bg-zinc-100 text-zinc-500">
              {name.charAt(0) || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label htmlFor="avatar-upload" className="cursor-pointer">
              <div className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded-sm inline-flex items-center justify-center transition-colors">
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                Change Avatar
              </div>
            </Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
            {currentAvatar && (
              <div 
                className="text-xs text-red-500 cursor-pointer hover:underline mt-1 inline-block"
                onClick={() => {
                  setCurrentAvatar(null);
                  updateMutation.mutate({ projectId, avatar: "" });
                }}
              >
                Remove avatar
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-zinc-700">Project Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="max-w-md h-9 text-[13px] rounded-sm border-zinc-200"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-medium text-zinc-700">Description</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-xl text-[13px] min-h-[100px] rounded-sm border-zinc-200 resize-none"
            />
          </div>

          <Button 
            onClick={handleUpdate} 
            disabled={updateMutation.isPending}
            className="h-8.5 rounded-sm px-4 text-xs font-medium"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="pt-8 border-t border-zinc-100 mt-12">
        <h3 className="text-sm font-semibold text-red-600 mb-1">Danger Zone</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Once you delete a project, there is no going back. Please be certain.
        </p>
        <Button 
          variant="destructive" 
          onClick={() => setIsDeleteOpen(true)}
          className="h-8.5 rounded-sm text-xs font-medium"
        >
          Delete Project
        </Button>
      </div>

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        description="Are you absolutely sure you want to delete this project? This action cannot be undone and will permanently remove all related data."
        confirmText="Delete permanently"
        cancelText="Cancel"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
