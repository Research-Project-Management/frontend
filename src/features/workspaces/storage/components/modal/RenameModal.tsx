'use client';

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRenameItem } from "@/features/workspaces/storage/hooks/use-storage";
import { renameItemSchema, type RenameItemInput } from "@/features/workspaces/storage/schemas/storage.schema";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { SingleInputModal } from "./SingleInputModal";

export default function RenameModal() {
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const { mutateAsync: renameFile, isPending } = useRenameItem();

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
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
      setFileId(e.detail.id);
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
    <SingleInputModal
      open={open}
      onOpenChange={setOpen}
      title="Rename"
      placeholder="New name"
      submitLabel="Save"
      value={newName || ""}
      onChange={(val) => setValue("name", val, { shouldValidate: true })}
      onSubmit={handleSubmit(onFormSubmit)}
      isLoading={isPending}
      errorMessage={errors.name?.message}
      inputId="name"
      testId="rename-input"
    />
  );
}
