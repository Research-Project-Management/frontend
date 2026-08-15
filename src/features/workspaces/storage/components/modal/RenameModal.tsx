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
import { useRenameItem } from "@/features/workspaces/storage/hooks/use-storage";
import { renameItemSchema } from "@/features/workspaces/storage/schemas/storage.schemas";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';

export default function RenameModal() {
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const { mutateAsync: renameFile, isPending } = useRenameItem();

  useEffect(() => {
    const handleOpen = (e: CustomEvent<StorageItem>) => {
      setFileId(e.detail._id);
      setNewName(e.detail.filename);
      setOpen(true);
    };
    window.addEventListener('open-rename-modal', handleOpen as EventListener);
    return () => window.removeEventListener('open-rename-modal', handleOpen as EventListener);
  }, []);

  const handleRename = async () => {
    if (!fileId) return;

    const result = renameItemSchema.safeParse({ name: newName });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    try {
      await renameFile({ itemId: fileId, name: result.data.name });
      toast.success("Renamed successfully");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to rename");
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
            Rename
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              id="new-name"
              placeholder="New name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  handleRename();
                }
              }}
              disabled={isPending}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="text-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={!newName.trim() || isPending}
            className="cursor-pointer"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
