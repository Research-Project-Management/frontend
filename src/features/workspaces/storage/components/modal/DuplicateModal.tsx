import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";

export type UploadMode = "replace" | "keep-both";

export type DuplicateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  onConfirm: (mode: UploadMode) => void;
  isUploading?: boolean;
};

export default function DuplicateModal({
  isOpen,
  onClose,
  filename,
  onConfirm,
  isUploading = false,
}: DuplicateModalProps) {
  const [uploadMode, setUploadMode] = useState<UploadMode>("replace");

  const handleConfirm = () => {
    onConfirm(uploadMode);
  };

  useEffect(() => {
    if (!isOpen || isUploading) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm(uploadMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUploading, uploadMode, onConfirm]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-md p-6 overflow-hidden gap-0 border-border bg-popover shadow-xl"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-[1.125rem] leading-snug font-semibold text-foreground">
            File already exists
          </DialogTitle>
        </DialogHeader>

        <div className="text-[14.4px] text-muted-foreground space-y-5">
          <p className="leading-relaxed">
            An item named <strong className="font-medium text-foreground break-all">"{filename}"</strong> already exists in this folder.
          </p>

          <RadioGroup
            value={uploadMode}
            onValueChange={(value) => setUploadMode(value as UploadMode)}
            className="flex flex-col gap-3"
          >
            {/* Replace Option */}
            <Label
              htmlFor="replace"
              className={`flex items-center space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${uploadMode === "replace"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-muted/50"
                }`}
            >
              <RadioGroupItem value="replace" id="replace" />
              <div className="flex flex-col w-full">
                <span className="font-medium text-foreground text-[14.4px]">
                  Replace existing file
                </span>
              </div>
            </Label>

            {/* Keep Both Option */}
            <Label
              htmlFor="keep-both"
              className={`flex items-center space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${uploadMode === "keep-both"
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-muted/50"
                }`}
            >
              <RadioGroupItem value="keep-both" id="keep-both" />
              <div className="flex flex-col w-full">
                <span className="font-medium text-foreground text-[14.4px]">
                  Keep both files
                </span>
              </div>
            </Label>
          </RadioGroup>
        </div>

        <DialogFooter className="mt-6 sm:space-x-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isUploading}
            className="h-9 px-4 font-medium text-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isUploading}
            className="h-9 px-5 font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
