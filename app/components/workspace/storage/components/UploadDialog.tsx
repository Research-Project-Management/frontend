import { useState, useCallback } from "react";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { useUploadFile } from "~/query/storage";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "project" | "workspace";
  projectId?: string | null;
  parentId?: string | null;
  workspaceId?: string;
};

type FileWithProgress = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

export default function UploadDialog({
  open,
  onOpenChange,
  scope,
  projectId,
  parentId,
  workspaceId,
}: UploadDialogProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const uploadMutation = useUploadFile();

  const closeWithAnimation = (onClosed?: () => void) => {
    setIsClosing(true);
    window.setTimeout(() => {
      onOpenChange(false);
      setIsClosing(false);
      onClosed?.();
    }, 180);
  };

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

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const filesWithProgress: FileWithProgress[] = newFiles.map((file) => ({
      file,
      progress: 0,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...filesWithProgress]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    let hasError = false;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "uploading" as const, progress: 0 } : f
          )
        );

        // Simulate progress (in real app, you'd track actual upload progress)
        const progressInterval = setInterval(() => {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i && f.progress < 90
                ? { ...f, progress: f.progress + 10 }
                : f
            )
          );
        }, 200);

        await uploadMutation.mutateAsync({
          file: files[i].file,
          scope,
          projectId: projectId || undefined,
          workspaceId,
          parentId,
        });

        clearInterval(progressInterval);

        // Update status to success
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success" as const, progress: 100 } : f
          )
        );
      } catch (error) {
        hasError = true;
        // Update status to error
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : f
          )
        );
      }
    }

    // Close dialog after all uploads complete
    if (!hasError && files.length > 0) {
      window.setTimeout(() => {
        closeWithAnimation(() => setFiles([]));
      }, 260);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const hasFiles = files.length > 0;
  const isUploading = files.some((f) => f.status === "uploading");
  const allComplete = files.every((f) => f.status === "success" || f.status === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-2xl transition-all duration-200 ${
          isClosing ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
        }`}
      >
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Drag and drop files here or click to browse
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop files here, or click to select files
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isUploading || isClosing}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={isUploading || isClosing}
            >
              Browse Files
            </Button>
          </div>

          {/* File List */}
          {hasFiles && (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {files.map((fileItem, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(fileItem.file.size)}
                    </p>
                    {fileItem.status === "uploading" && (
                      <Progress value={fileItem.progress} className="h-1 mt-2" />
                    )}
                    {fileItem.status === "error" && (
                      <p className="text-xs text-destructive mt-1">
                        {fileItem.error}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {fileItem.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isUploading || isClosing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {fileItem.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {fileItem.status === "success" && (
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
                    )}
                    {fileItem.status === "error" && (
                      <div className="h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
                        <X className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              closeWithAnimation(() => setFiles([]));
            }}
            disabled={isUploading || isClosing}
          >
            Cancel
          </Button>
          <Button
            onClick={uploadFiles}
            disabled={!hasFiles || isUploading || allComplete || isClosing}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload ${files.length} ${files.length === 1 ? "file" : "files"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
