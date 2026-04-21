import { useState, useCallback, useRef } from "react";
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
import { useUploadFile, checkDuplicate, deleteFile } from "~/query/storage";
import { generateUniqueName } from "~/lib/utils";
import DuplicateFileDialog from "./DuplicateFileDialog";
import type { DuplicateAction } from "./DuplicateFileDialog";
import { toast } from "sonner";

type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "project" | "workspace";
  projectId?: string | null;
  parentId?: string | null;
  workspaceId?: string;
};

type FileStatus = "pending" | "uploading" | "success" | "error" | "skipped";

type FileWithProgress = {
  file: File;
  progress: number;
  status: FileStatus;
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
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFilename, setDuplicateFilename] = useState("");

  const uploadMutation = useUploadFile();
  const duplicateResolveRef = useRef<
    ((action: DuplicateAction) => void) | null
  >(null);



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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        addFiles(selectedFiles);
      }
    },
    [],
  );

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

  const promptDuplicate = (filename: string): Promise<DuplicateAction> =>
    new Promise((resolve) => {
      setDuplicateFilename(filename);
      duplicateResolveRef.current = resolve;
      setDuplicateDialogOpen(true);
    });

  const handleDuplicateAction = (action: DuplicateAction) => {
    setDuplicateDialogOpen(false);
    duplicateResolveRef.current?.(action);
    duplicateResolveRef.current = null;
  };

  const handleDuplicateDialogOpenChange = (nextOpen: boolean) => {
    setDuplicateDialogOpen(nextOpen);
    if (!nextOpen && duplicateResolveRef.current) {
      duplicateResolveRef.current("cancel");
      duplicateResolveRef.current = null;
    }
  };

  const uploadFiles = async () => {
    const existingNames = new Set(files.map((f) => f.file.name));
    let hasError = false;
    let successCount = 0;
    let lastSuccessName = "";

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      const originalFile = files[i].file;
      let fileToUpload = originalFile;

      try {
        const { exists, existingFile } = await checkDuplicate(
          originalFile.name,
          parentId ?? null,
          {
            scope,
            projectId: projectId ?? undefined,
            workspaceId,
          },
        );

        if (exists) {
          const action = await promptDuplicate(originalFile.name);

          if (action === "cancel") {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, status: "skipped" as const } : f,
              ),
            );
            continue;
          }

          if (action === "overwrite" && existingFile?._id) {
            try {
              await deleteFile(existingFile._id);
            } catch {
              // Best-effort delete; proceed with upload.
            }
          }

          if (action === "keep-both") {
            const newName = generateUniqueName(
              originalFile.name,
              existingNames,
            );
            fileToUpload = new File([originalFile], newName, {
              type: originalFile.type,
            });
          }
        }
      } catch {
        // If duplicate check fails, proceed with upload.
      }

      let progressInterval: ReturnType<typeof setInterval> | null = null;

      try {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "uploading" as const, progress: 0 } : f,
          ),
        );

        progressInterval = setInterval(() => {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i && f.progress < 90
                ? { ...f, progress: f.progress + 10 }
                : f,
            ),
          );
        }, 200);

        await uploadMutation.mutateAsync({
          file: fileToUpload,
          scope,
          projectId: projectId ?? undefined,
          workspaceId,
          parentId,
        });

        existingNames.add(fileToUpload.name);
        successCount++;
        lastSuccessName = fileToUpload.name;

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success" as const, progress: 100 } : f,
          ),
        );
      } catch (error) {
        hasError = true;
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: "error" as const,
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : f,
          ),
        );
        toast.error(`Failed to upload "${fileToUpload.name}"`);
      } finally {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    }

    if (successCount > 0) {
      if (successCount === 1) {
        toast.success(`Uploaded "${lastSuccessName}"`);
      } else {
        toast.success(`Successfully uploaded ${successCount} files`);
      }
    }

    if (!hasError && files.length > 0) {
      onOpenChange(false);
      setFiles([]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const STATUS_ICON: Record<FileStatus, React.ReactNode> = {
    pending: null,
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
      <div className="h-4 w-4 rounded-full bg-muted-foreground/30 flex items-center justify-center">
        <span className="text-[9px] text-muted-foreground font-bold">-</span>
      </div>
    ),
  };

  const hasFiles = files.length > 0;
  const isUploading = files.some((f) => f.status === "uploading");
  const allComplete = files.every(
    (f) =>
      f.status === "success" || f.status === "error" || f.status === "skipped",
  );
  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Drag and drop files here or click to browse
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                disabled={isUploading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("file-upload")?.click()}
                disabled={isUploading}
              >
                Browse Files
              </Button>
            </div>

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
                        <Progress
                          value={fileItem.progress}
                          className="h-1 mt-2"
                        />
                      )}
                      {fileItem.status === "error" && (
                        <p className="text-xs text-destructive mt-1">
                          {fileItem.error}
                        </p>
                      )}
                      {fileItem.status === "skipped" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Skipped
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {fileItem.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {STATUS_ICON[fileItem.status]}
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
                onOpenChange(false);
                setFiles([]);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={uploadFiles}
              disabled={
                !hasFiles ||
                isUploading ||
                allComplete ||
                pendingCount === 0
              }
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${pendingCount || files.length} ${files.length === 1 ? "file" : "files"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateFileDialog
        open={duplicateDialogOpen}
        onOpenChange={handleDuplicateDialogOpenChange}
        filename={duplicateFilename}
        onAction={handleDuplicateAction}
      />
    </>
  );
}
