'use client';

import { useState, useCallback, useEffect } from "react";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Progress } from "@/shared/components/ui";
import DuplicateFileDialog from "./DuplicateFileDialog";
import { useWorkspaceStorage } from "../hooks/use-workspace-storage";
import type { StorageUploadItem } from "../hooks/use-workspace-storage";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  workspaceId?: string;
  initialFiles?: File[];
};

export default function UploadDialog({
  open,
  onOpenChange,
  parentId,
  workspaceId,
  initialFiles,
}: UploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);

  const {
    queue,
    setQueue,
    addFilesToQueue,
    processQueue,
    duplicateFile,
    resolveDuplicate,
  } = useWorkspaceStorage(workspaceId ?? "");

  // Pre-populate with files dropped onto the explorer area
  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      addFilesToQueue(initialFiles, parentId ?? null);
    }
  }, [open, initialFiles, addFilesToQueue, parentId]);

  // Start processing whenever queue has pending items and no duplicate prompt is open
  useEffect(() => {
    if (queue.some(q => q.status === 'pending') && !duplicateFile) {
      processQueue();
    }
  }, [queue, processQueue, duplicateFile]);

  // Auto-close dialog if all uploads are done and no error occurred
  useEffect(() => {
    if (
      queue.length > 0 &&
      queue.every(q => q.status === 'success' || q.status === 'skipped')
    ) {
      const timer = setTimeout(() => {
        onOpenChange(false);
        setQueue([]);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [queue, onOpenChange, setQueue]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFilesToQueue(Array.from(e.dataTransfer.files), parentId ?? null);
    }
  }, [addFilesToQueue, parentId]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFilesToQueue(Array.from(e.target.files), parentId ?? null);
      }
    },
    [addFilesToQueue, parentId],
  );

  const removeFile = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, [setQueue]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const STATUS_ICON: Record<StorageUploadItem["status"], React.ReactNode> = {
    pending: null,
    "duplicate-check": <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    uploading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    success: (
      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
        <svg
          className="h-3 w-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    ),
    error: (
      <div className="h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
        <X className="h-3 w-3 text-white" />
      </div>
    ),
    skipped: (
      <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
        <X className="h-3 w-3 text-muted-foreground" />
      </div>
    ),
  };

  const isUploading = queue.some(
    (f) => f.status === "uploading" || f.status === "duplicate-check" || f.status === "pending"
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!isUploading) {
            onOpenChange(v);
            if (!v) setQueue([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Drag and drop files here, or click to select files.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
            mt-4 rounded-xl border-2 border-dashed p-8 transition-colors
            flex flex-col items-center justify-center gap-4
            ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }
          `}
          >
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Click or drag files here</p>
              <p className="text-xs text-muted-foreground mt-1">
                Support for all file types
              </p>
            </div>
            <input
              type="file"
              multiple
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>

          {queue.length > 0 && (
            <div className="mt-6 max-h-[240px] overflow-y-auto pr-2 space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-all"
                >
                  {item.status === "uploading" && (
                    <div
                      className="absolute inset-0 bg-primary/5 transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  )}
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                        {item.status === "uploading" && (
                          <span className="ml-1 text-primary">
                            • {item.progress}%
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="ml-1 text-destructive">
                            • Upload failed
                          </span>
                        )}
                        {item.status === "skipped" && (
                          <span className="ml-1 text-muted-foreground">
                            • Skipped
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {STATUS_ICON[item.status]}
                      {(item.status === "success" || item.status === "error" || item.status === "skipped") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => removeFile(item.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {item.status === "uploading" && (
                    <Progress
                      value={item.progress}
                      className="mt-3 h-1.5 w-full bg-primary/10"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setQueue([]);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!isUploading) {
                  onOpenChange(false);
                  setQueue([]);
                }
              }}
              disabled={isUploading || queue.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Done"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateFileDialog
        open={!!duplicateFile}
        onOpenChange={(open) => {
          if (!open) {
            resolveDuplicate("cancel");
          }
        }}
        filename={duplicateFile?.file.name ?? ""}
        onAction={resolveDuplicate}
      />
    </>
  );
}
