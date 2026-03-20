import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { FileIcon, AlertTriangle } from "lucide-react";

type DuplicateAction = "overwrite" | "keep-both" | "cancel";

type DuplicateFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  onAction: (action: DuplicateAction) => void;
};

export default function DuplicateFileDialog({
  open,
  onOpenChange,
  filename,
  onAction,
}: DuplicateFileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            File already exists
          </DialogTitle>
          <DialogDescription>
            A file named <span className="font-medium text-foreground">"{filename}"</span> already
            exists in this location. What would you like to do?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <FileIcon className="size-8 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{filename}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onAction("cancel")}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => onAction("keep-both")}
            className="w-full sm:w-auto"
          >
            Keep Both
          </Button>
          <Button
            onClick={() => onAction("overwrite")}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            Overwrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { DuplicateAction };
