import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Check, AlertTriangle } from "lucide-react";
import { columnFormSchema, type ColumnFormSchema } from "../../schemas/task.schema";

// ── Column Form Modal (Create / Edit) ───────────────────────────────────────

export type SectionData = ColumnFormSchema;

export interface ColumnFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SectionData) => void;
  mode?: "create" | "edit";
  initialData?: Partial<SectionData>;
  isLoading?: boolean;
}

export const COLUMN_PALETTE = [
  { id: "indigo", value: "#6366F1", label: "Indigo" },
  { id: "sky", value: "#0EA5E9", label: "Sky" },
  { id: "amber", value: "#F59E0B", label: "Amber" },
  { id: "yellow", value: "#EAB308", label: "Yellow" },
  { id: "emerald", value: "#22C55E", label: "Emerald" },
  { id: "rose", value: "#F43F5E", label: "Rose" },
  { id: "purple", value: "#A855F7", label: "Purple" },
  { id: "teal", value: "#14B8A6", label: "Teal" },
  { id: "orange", value: "#F97316", label: "Orange" },
  { id: "slate", value: "#64748B", label: "Slate" },
];

export function ColumnFormModal({
  isOpen,
  onClose,
  onSubmit,
  mode = "create",
  initialData,
  isLoading = false,
}: ColumnFormModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ColumnFormSchema>({
    resolver: zodResolver(columnFormSchema),
    defaultValues: {
      sectionName: initialData?.sectionName || "",
      selectedColor: initialData?.selectedColor || COLUMN_PALETTE[0].value,
    },
  });

  const selectedColor = watch("selectedColor");

  useEffect(() => {
    if (isOpen) {
      reset({
        sectionName: initialData?.sectionName || "",
        selectedColor: initialData?.selectedColor || COLUMN_PALETTE[0].value,
      });
    }
  }, [isOpen, initialData, reset]);

  const onFormSubmit = (data: ColumnFormSchema) => {
    onSubmit({
      sectionName: data.sectionName.trim(),
      selectedColor: data.selectedColor,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border border-border shadow-2xl rounded-xl">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="text-base font-bold text-foreground">
              {mode === "create" ? "New Status / Column" : "Edit Status / Column"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {mode === "create"
                ? "Add a new status column to organize tasks in this project."
                : "Update the status name and color identifier."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="column-name" className="text-xs font-semibold text-foreground">
                Status Name
              </Label>
              <Input
                id="column-name"
                placeholder="e.g., In QA, Blocked, Ready to Deploy..."
                autoFocus
                className="h-10 text-sm font-medium text-foreground rounded-lg border-border bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
                {...register("sectionName")}
              />
              {errors.sectionName && (
                <p className="text-xs text-destructive">{errors.sectionName.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Accent Color</span>
                <span
                  className="size-3.5 rounded-full inline-block border border-border/60"
                  style={{ backgroundColor: selectedColor }}
                />
              </Label>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {COLUMN_PALETTE.map((color) => {
                  const isSelected = selectedColor?.toLowerCase() === color.value.toLowerCase();
                  return (
                    <button
                      key={color.id}
                      onClick={() => setValue("selectedColor", color.value, { shouldDirty: true })}
                      type="button"
                      title={color.label}
                      className={`
                        relative w-7 h-7 rounded-full transition-all duration-200 focus:outline-none cursor-pointer flex items-center justify-center
                        border border-black/10 dark:border-white/10
                        ${isSelected ? "ring-2 ring-offset-2 ring-primary scale-110 shadow-sm" : "hover:scale-110 opacity-80 hover:opacity-100"}
                      `}
                      style={{ backgroundColor: color.value }}
                      aria-label={`Select ${color.label} color`}
                    >
                      {isSelected && (
                        <Check className="size-3.5 text-white drop-shadow-sm" strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-muted/30 flex flex-row items-center justify-end gap-2.5 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-xs font-medium text-muted-foreground hover:bg-muted shadow-none rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-9 px-5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-lg transition-all"
              disabled={!watch("sectionName")?.trim() || isLoading}
            >
              {isLoading ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Status" : "Save Changes")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Column Modal ─────────────────────────────────────────────────────

export interface DeleteColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  columnTitle?: string;
  fallbackColumnTitle?: string;
  isLoading?: boolean;
}

export function DeleteColumnModal({
  isOpen,
  onClose,
  onConfirm,
  columnTitle = "this column",
  fallbackColumnTitle = "Backlog",
  isLoading = false,
}: DeleteColumnModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
      <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-border shadow-2xl rounded-xl z-50">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="size-5" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">
                Delete Status Column
              </DialogTitle>
              <DialogDescription className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground font-semibold">&ldquo;{columnTitle}&rdquo;</strong>?
                {fallbackColumnTitle && (
                  <span className="block mt-1 text-foreground/80">
                    Any existing tasks in this status will be safely moved to <strong className="text-foreground font-semibold">&ldquo;{fallbackColumnTitle}&rdquo;</strong>.
                  </span>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-3.5 bg-muted/30 border-t border-border flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="h-8 px-3.5 text-xs font-medium rounded-lg"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className="h-8 px-4 text-xs font-medium shadow-xs rounded-lg"
          >
            {isLoading ? "Deleting..." : "Delete Status"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Aliases for compatibility
export const CreateModal = ColumnFormModal;

export const DeleteModal = DeleteColumnModal;
