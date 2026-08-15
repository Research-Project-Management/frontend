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
import { useCreateFolder } from "@/features/workspaces/storage/hooks/use-storage";
import { createFolderSchema } from "@/features/workspaces/storage/schemas/storage.schemas";

type CreateFolderModalProps = {
  workspaceId: string;
  parentId?: string | null;
};

export default function CreateFolderModal({ workspaceId, parentId }: CreateFolderModalProps) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const createFolderMutation = useCreateFolder();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-create-folder', handleOpen);
    return () => window.removeEventListener('open-create-folder', handleOpen);
  }, []);

  const handleCreate = async () => {
    const result = createFolderSchema.safeParse({ name: folderName, workspaceId, parentId });
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
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-md bg-popover"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
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
            className="text-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || createFolderMutation.isPending}
            className="cursor-pointer"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
