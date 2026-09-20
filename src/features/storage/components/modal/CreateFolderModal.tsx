'use client';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateFolder } from "@/features/storage/hooks/use-storage";
import { createFolderSchema, type CreateFolderInput } from "@/features/storage/schemas/storage.schema";
import { useStorageUIStore } from "@/features/storage/store/storage-ui.store";
import { SingleInputModal } from "./SingleInputModal";

type CreateFolderModalProps = {
  projectId?: string;
  parentId?: string | null;
};

export default function CreateFolderModal({ projectId, parentId }: CreateFolderModalProps) {
  const isOpen = useStorageUIStore((s) => s.isCreateFolderOpen);
  const close = useStorageUIStore((s) => s.closeCreateFolderModal);
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
      projectId,
      parentId: parentId || null,
    },
  });

  const folderName = watch("name");

  useEffect(() => {
    if (isOpen) {
      reset({
        name: "",
        projectId,
        parentId: parentId || null,
      });
    }
  }, [isOpen, projectId, parentId, reset]);

  const onFormSubmit = async (data: CreateFolderInput) => {
    try {
      await createFolderMutation.mutateAsync(data);
      toast.success(`Created folder "${data.name}"`);
      close();
      reset();
    } catch (error) {
      toast.error("Failed to create folder");
      console.error(error);
    }
  };

  return (
    <SingleInputModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
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
