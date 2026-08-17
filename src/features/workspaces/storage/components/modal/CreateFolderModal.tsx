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
import { useCreateFolder } from "@/features/workspaces/storage/hooks/use-storage";
import { createFolderSchema, type CreateFolderInput } from "@/features/workspaces/storage/schemas/storage.schema";

type CreateFolderModalProps = {
  workspaceId: string;
  parentId?: string | null;
};

export default function CreateFolderModal({ workspaceId, parentId }: CreateFolderModalProps) {
  const [open, setOpen] = useState(false);
  const createFolderMutation = useCreateFolder();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateFolderInput>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: {
      name: "",
      workspaceId,
      parentId: parentId || null,
    },
  });

  const folderName = watch("name");

  useEffect(() => {
    const handleOpen = () => {
      reset({
        name: "",
        workspaceId,
        parentId: parentId || null,
      });
      setOpen(true);
    };
    window.addEventListener('open-create-folder', handleOpen);
    return () => window.removeEventListener('open-create-folder', handleOpen);
  }, [workspaceId, parentId, reset]);

  const onFormSubmit = async (data: CreateFolderInput) => {
    try {
      await createFolderMutation.mutateAsync(data);
      toast.success(`Created folder "${data.name}"`);
      setOpen(false);
      reset();
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
        <form onSubmit={handleSubmit(onFormSubmit)}>
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
                disabled={createFolderMutation.isPending}
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
              disabled={createFolderMutation.isPending}
              className="text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!folderName?.trim() || createFolderMutation.isPending}
              className="cursor-pointer"
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

