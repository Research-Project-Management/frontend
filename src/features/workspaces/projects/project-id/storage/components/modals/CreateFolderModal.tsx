'use client';

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { useCreateFolder } from "@/features/workspaces/projects/project-id/storage/hooks/use-storage";
import { createFolderSchema } from "@/features/workspaces/projects/project-id/storage/schemas/storage.schema";

type CreateFolderModalProps = {
  projectId: string;
  parentId?: string | null;
};

export default function CreateFolderModal({ projectId, parentId }: CreateFolderModalProps) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const createFolderMutation = useCreateFolder();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-create-folder', handleOpen);
    return () => window.removeEventListener('open-create-folder', handleOpen);
  }, []);

  const handleCreate = async () => {
    const result = createFolderSchema.safeParse({ name: folderName, projectId, parentId });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    try {
      await createFolderMutation.mutateAsync(result.data);
      toast.success(`Created folder "${result.data.name}"`);
      setOpen(false);
      setFolderName("");
    } catch (error) {
      toast.error("Failed to create folder");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Create New Folder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              id="folder-name"
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) {
                  handleCreate();
                }
              }}
              disabled={createFolderMutation.isPending}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={createFolderMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || createFolderMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
