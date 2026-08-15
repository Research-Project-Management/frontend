import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { quicklinkSchema } from "../../schemas/home.schema";
import type { QuicklinkFormData } from "../../types/home.types";

interface QuicklinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: QuicklinkFormData) => void;
  initialData?: QuicklinkFormData;
}

export function QuicklinkModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: QuicklinkModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuicklinkFormData>({
    resolver: zodResolver(quicklinkSchema),
    defaultValues: initialData || { url: "", title: "" },
  });

  useEffect(() => {
    if (open) {
      reset(initialData || { url: "", title: "" });
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = (data: QuicklinkFormData) => {
    onSubmit(data);
    reset();
    onOpenChange(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleClose();
      else onOpenChange(true);
    }}>
      <DialogContent className="sm:max-w-[500px] p-0 border-0 shadow-xl overflow-hidden rounded-md" showCloseButton={false}>
        <div className="px-5 pt-5 pb-2">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-foreground">
              {initialData ? "Edit Quicklink" : "Add Quicklink"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col">
          <div className="space-y-4 px-5 pb-5">
            <div className="space-y-1.5">
              <div className="flex flex-col">
                <Label htmlFor="url" className="text-[13px] font-medium text-foreground">URL</Label>
                <span className="text-[11px] text-muted-foreground">Required</span>
              </div>
              <Input
                id="url"
                placeholder="Type or paste a URL"
                className="w-full h-9 bg-background border-border focus-visible:border-foreground/30 focus-visible:ring-1 focus-visible:ring-foreground/10 text-[13px] transition-colors"
                {...register("url")}
              />
              {errors.url && (
                <p className="text-[11px] text-destructive">{errors.url.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-col">
                <Label htmlFor="title" className="text-[13px] font-medium text-foreground">Display title</Label>
                <span className="text-[11px] text-muted-foreground">Optional</span>
              </div>
              <Input
                id="title"
                placeholder="What you'd like to see this link as"
                className="w-full h-9 bg-background border-border focus-visible:border-foreground/30 focus-visible:ring-1 focus-visible:ring-foreground/10 text-[13px] transition-colors"
                {...register("title")}
              />
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-border bg-white flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-8 px-4 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-8 px-4 text-xs font-medium transition-colors"
            >
              {initialData ? "Save changes" : "Add Quicklink"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
