import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@/shared/components/ui";
import { Check } from "lucide-react";
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

const COLUMN_PALETTE = [
  { id: "white", value: "#FFFFFF", border: true },
  { id: "slate", value: "#64748b" },
  { id: "blue", value: "#3B82F6" },
  { id: "green", value: "#10B981" },
  { id: "amber", value: "#F59E0B" },
  { id: "red", value: "#EF4444" },
  { id: "purple", value: "#A855F7" },
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
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border-0 shadow-2xl rounded-sm">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-[18px] font-bold text-foreground">
              {mode === "create" ? "New Column" : "Edit Column"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="column-name" className="text-[13px] font-medium text-muted-foreground">
                Column Name
              </Label>
              <Input
                id="column-name"
                placeholder="Enter column title..."
                autoFocus
                className="h-10 text-[14px] font-medium text-foreground rounded-md border-border bg-background shadow-none focus-visible:ring-0 focus-visible:border-primary transition-all"
                {...register("sectionName")}
              />
              {errors.sectionName && (
                <p className="text-xs text-destructive">{errors.sectionName.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label className="text-[13px] font-medium text-muted-foreground">
                Accent Color
              </Label>
              <div className="flex items-center gap-3">
                {COLUMN_PALETTE.map((color) => {
                  const isSelected = selectedColor?.toLowerCase() === color.value.toLowerCase();
                  return (
                    <button
                      key={color.id}
                      onClick={() => setValue("selectedColor", color.value, { shouldDirty: true })}
                      type="button"
                      className={`
                        relative w-7 h-7 rounded-full transition-all duration-200 focus:outline-none cursor-pointer flex items-center justify-center
                        ${color.border ? "border border-border" : "border border-transparent"}
                        ${isSelected ? "ring-2 ring-offset-2 ring-primary scale-100" : "hover:scale-110 opacity-80 hover:opacity-100"}
                      `}
                      style={{ backgroundColor: color.value }}
                      aria-label={`Select ${color.id} color`}
                    >
                      {isSelected && (
                        <Check className={`size-3.5 ${color.id === 'white' ? 'text-foreground' : 'text-white'}`} strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-muted/30 flex flex-row items-center justify-end gap-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-[13px] font-medium text-muted-foreground hover:bg-muted shadow-none rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-6 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-none rounded-md transition-all duration-200 active:scale-[0.98]"
              disabled={!watch("sectionName")?.trim() || isLoading}
            >
              {isLoading ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Column" : "Save Changes")}
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
  title?: string;
  message?: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

export function DeleteColumnModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete column",
  message = "Are you sure you want to delete this column? This action cannot be undone.",
  confirmLabel = "Delete",
  isLoading = false,
}: DeleteColumnModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogOverlay
        className="absolute inset-0 z-50 bg-foreground/15 backdrop-blur-[0.5px]
          data-[state=open]:animate-in data-[state=open]:fade-in-0
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      />
      <DialogContent className="max-w-[560px] p-0 overflow-hidden z-[51]">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 shrink-0">
              <WarningIcon className="h-5 w-5 text-red-600" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {message}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-gray-50/30">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-xs font-medium"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading}
              className="h-9 px-4 text-xs font-medium bg-red-600 hover:bg-red-700 text-white border-none shadow-xs"
            >
              {isLoading ? "Deleting..." : confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WarningIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// Aliases for compatibility
export const CreateModal = ColumnFormModal;
export const DeleteModal = DeleteColumnModal;
