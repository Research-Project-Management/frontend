'use client';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRenameItem } from "@/features/storage/hooks/use-storage";
import { renameItemSchema, type RenameItemInput } from "@/features/storage/schemas/storage.schema";
import { useStorageUIStore } from "@/features/storage/store/storage-ui.store";
import { SingleInputModal } from "./SingleInputModal";

export default function RenameModal() {
  const renamingItem = useStorageUIStore((s) => s.renamingItem);
  const close = useStorageUIStore((s) => s.closeRenameModal);
  const isOpen = Boolean(renamingItem);
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
    if (renamingItem) {
      reset({ name: renamingItem.filename || renamingItem.name || "" });
    }
  }, [renamingItem, reset]);

  const onFormSubmit = async (data: RenameItemInput) => {
    if (!renamingItem) return;

    try {
      await renameFile({ itemId: renamingItem.id, name: data.name });
      toast.success("Renamed successfully");
      close();
    } catch (error) {
      toast.error("Failed to rename");
      console.error(error);
    }
  };

  return (
    <SingleInputModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
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
