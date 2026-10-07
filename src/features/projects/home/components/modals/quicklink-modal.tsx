import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[500px] p-0 border border-border overflow-hidden rounded-md shadow-raised-200 bg-popover"
        showCloseButton={false}
      >
        <div className="px-5 pt-5 pb-2">
          <DialogHeader>
            <DialogTitle className="text-16 font-semibold text-foreground">
              {initialData ? "Edit Quicklink" : "Add Quicklink"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Add or edit a quicklink bookmark for this project.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col">
          <div className="space-y-4 px-5 pb-5">
            <div className="space-y-1.5">
              <div className="flex flex-col">
                <Label htmlFor="url" className="text-13 font-medium text-foreground">URL</Label>
                <span className="text-11 text-muted-foreground">Required</span>
              </div>
              <Input
                id="url"
                placeholder="Type or paste a URL"
                className="w-full h-8 bg-background border-border focus-visible:border-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none text-13 transition-colors shadow-none"
                {...register("url")}
              />
              {errors.url && (
                <p className="text-12 text-destructive">{errors.url.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-col">
                <Label htmlFor="title" className="text-13 font-medium text-foreground">Display title</Label>
                <span className="text-11 text-muted-foreground">Optional</span>
              </div>
              <Input
                id="title"
                placeholder="What you'd like to see this link as"
                className="w-full h-8 bg-background border-border focus-visible:border-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none text-13 transition-colors shadow-none"
                {...register("title")}
              />
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-border bg-muted flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="relative h-8 px-4 text-13 font-medium shadow-none cursor-pointer focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="relative h-8 px-4 text-13 font-medium shadow-none transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
            >
              {initialData ? "Save changes" : "Add Quicklink"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
