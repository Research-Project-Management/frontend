'use client';

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateFolder } from "@/features/workspaces/storage/hooks/use-storage";
import { createFolderSchema, type CreateFolderInput } from "@/features/workspaces/storage/schemas/storage.schema";
import { SingleInputModal } from "./SingleInputModal";

type CreateFolderModalProps = {
  workspaceId: string;
  parentId?: string | null;
};

export default function CreateFolderModal({ workspaceId, parentId }: CreateFolderModalProps) {
  const [open, setOpen] = useState(false);
  const createFolderMutation = useCreateFolder();

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
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
    <SingleInputModal
      open={open}
      onOpenChange={setOpen}
      title="Create New Folder"
      placeholder="Folder name"
      submitLabel="Create"
      value={folderName || ""}
      onChange={(val) => setValue("name", val, { shouldValidate: true })}
      onSubmit={handleSubmit(onFormSubmit)}
      isLoading={createFolderMutation.isPending}
      errorMessage={errors.name?.message}
      inputId="folder-name"
    />
  );
}
