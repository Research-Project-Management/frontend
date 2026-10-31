"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Library, Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Form } from "@/shared/components/ui/form";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import {
  collectionFormSchema,
  type CollectionFormValues,
} from "@/features/library/domain/types/library.types";
import type { Collection } from "@/features/library/domain/types/library.types";

interface CreateCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CollectionFormValues) => Promise<void> | void;
  isPending?: boolean;
  collections?: Collection[];
  defaultParentId?: string | null;
  rootLabel?: string;
  rootType?: "user" | "project";
  mode?: "create" | "rename";
  editingCollectionId?: string;
  initialName?: string;
  initialDescription?: string;
  initialColor?: string;
}

export default function CreateCollectionModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  collections = [],
  defaultParentId = null,
  rootLabel = "My Library",
  rootType = "user",
  mode = "create",
  editingCollectionId,
  initialName = "",
  initialDescription = "",
  initialColor = "",
}: CreateCollectionModalProps) {
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      name: initialName,
      description: initialDescription,
      color: initialColor,
      parentId: defaultParentId ?? null,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset({
        name: initialName,
        description: initialDescription,
        color: initialColor,
        parentId: defaultParentId ?? null,
      });
    }
  }, [open, defaultParentId, initialName, initialDescription, initialColor, reset]);

  const onValidSubmit = async (data: CollectionFormValues) => {
    const rawParent =
      data.parentId === "root" || !data.parentId ? null : data.parentId;
    try {
      await onSubmit({
        name: data.name.trim() || "Untitled",
        description: data.description?.trim() || "",
        color: data.color || "",
        parentId: rawParent,
      });
      onOpenChange(false);
      reset();
    } catch {
      // Handled by parent mutation error toast
    }
  };

  const isRename = mode === "rename";

  // Filter out the collection being edited and any of its descendants so it cannot be moved into itself
  const eligibleParentCollections = useMemo(() => {
    if (!editingCollectionId) return collections;
    const forbiddenIds = new Set<string>([editingCollectionId]);
    let added = true;
    while (added) {
      added = false;
      for (const col of collections) {
        if (col.parentId && forbiddenIds.has(col.parentId) && !forbiddenIds.has(col.id)) {
          forbiddenIds.add(col.id);
          added = true;
        }
      }
    }
    return collections.filter((col) => !forbiddenIds.has(col.id));
  }, [collections, editingCollectionId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isPending) return; onOpenChange(v); }}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[520px] p-6 bg-background border border-border shadow-raised-200 rounded-md"
      >
        <DialogHeader>
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            {isRename ? "Rename Collection" : "New Collection"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isRename
              ? "Rename or update this collection."
              : "Create a new collection to organize your library items."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label
                htmlFor="collection-name"
                className="text-11 font-medium text-foreground"
              >
                Name
              </Label>
              <Input
                id="collection-name"
                placeholder="Collection name"
                autoFocus
                onFocus={(e) => e.target.select()}
                className="h-8 text-13 text-foreground bg-background hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring rounded-md border-border placeholder:text-muted-foreground"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-11 text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Create In Field (Dropdown Select) */}
            <div className="space-y-1.5">
              <Label className="text-11 font-medium text-foreground">
                Create in
              </Label>
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || "root"}
                    onValueChange={(val) =>
                      field.onChange(val === "root" ? null : val)
                    }
                  >
                    <SelectTrigger className="w-full h-8 text-13 text-foreground justify-between rounded-md border-border bg-background hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring cursor-pointer">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                      {/* Root Library */}
                      <SelectItem
                        value="root"
                        className="rounded-md text-13 py-1.5 px-2"
                      >
                        <div className="flex items-center gap-2">
                          {rootType === "project" ? (
                            <Folder
                              className="size-4 text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <Library
                              className="size-4 text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                          )}
                          <span className="text-foreground">{rootLabel}</span>
                        </div>
                      </SelectItem>

                      {/* Existing Collections */}
                      {eligibleParentCollections.map((col) => (
                        <SelectItem
                          key={col.id}
                          value={col.id}
                          className="rounded-md text-13 py-1.5 px-2"
                        >
                          <div className="flex items-center gap-2 pl-2">
                            <Folder
                              className="size-4 shrink-0 text-foreground"
                              strokeWidth={1.5}
                            />
                            <span className="truncate text-foreground">
                              {col.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Footer with Cancel next to Create Collection on the right */}
            <DialogFooter className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md shadow-none"
              >
                {isPending
                  ? isRename
                    ? "Saving..."
                    : "Creating..."
                  : isRename
                    ? "Save Changes"
                    : "Create Collection"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
