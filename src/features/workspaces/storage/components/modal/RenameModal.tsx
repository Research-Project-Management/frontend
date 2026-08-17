'use client';

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { renameItemSchema, type RenameItemInput } from "@/features/workspaces/storage/schemas/storage.schema";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';

export default function RenameModal() {
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const { mutateAsync: renameFile, isPending } = useRenameItem();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RenameItemInput>({
    resolver: zodResolver(renameItemSchema),
    defaultValues: {
      name: "",
    },
  });

  const newName = watch("name");

  useEffect(() => {
    const handleOpen = (e: CustomEvent<StorageItem>) => {
      setFileId(e.detail._id);
      reset({ name: e.detail.filename });
      setOpen(true);
    };
    window.addEventListener('open-rename-modal', handleOpen as EventListener);
    return () => window.removeEventListener('open-rename-modal', handleOpen as EventListener);
  }, [reset]);

  const onFormSubmit = async (data: RenameItemInput) => {
    if (!fileId) return;

    try {
      await renameFile({ itemId: fileId, name: data.name });
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
        <form onSubmit={handleSubmit(onFormSubmit)}>
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
                disabled={isPending}
                autoFocus
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!newName?.trim() || isPending}
              className="cursor-pointer"
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

