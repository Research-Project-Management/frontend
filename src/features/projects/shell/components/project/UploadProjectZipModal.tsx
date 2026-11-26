'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/shared/lib/logger';
import {
  Upload,
  FolderArchive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import {
  isZipFile,
  inferArchiveProjectName,
  importZipToProject,
  type ImportZipProgress,
} from '@/features/editor/subsystems/explorer';

export interface UploadProjectZipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { projectId: string; rootPageId: string }) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function UploadProjectZipModal({
  open,
  onOpenChange,
  onSuccess,
}: UploadProjectZipModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportZipProgress | null>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setProjectName('');
    setFileError(null);
    setIsImporting(false);
    setProgress(null);
    setIsDraggingOver(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    onOpenChange(false);
    setTimeout(resetState, 200);
  }, [isImporting, onOpenChange, resetState]);

  const handleFile = useCallback((file: File) => {
    if (!isZipFile(file)) {
      setFileError('Please select a valid .zip archive file.');
      return;
    }
    if (file.size === 0) {
      setFileError('The selected archive is empty.');
      return;
    }

    setFileError(null);
    setSelectedFile(file);
    setProjectName(inferArchiveProjectName(file));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      if (picked) handleFile(picked);
      e.target.value = '';
    },
    [handleFile],
  );

  const handleStartImport = async () => {
    if (!selectedFile || isImporting) return;

    const trimmedName = projectName.trim() || inferArchiveProjectName(selectedFile);
    setIsImporting(true);

    try {
      const result = await importZipToProject({
        zipFile: selectedFile,
        projectName: trimmedName,
        onProgress: setProgress,
      });

      toast.success(`Project "${trimmedName}" created and imported successfully!`);
      handleClose();
      onSuccess?.(result);

      if (result.rootPageId) {
        const isPersonal = !result.projectId || result.projectId === 'personal';
        router.push(
          isPersonal
            ? `/pages/${result.rootPageId}`
            : `/projects/${result.projectId}/pages/${result.rootPageId}`,
        );
      }
    } catch (err: unknown) {
      logger.error('[UploadProjectZipModal] Import failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to import project files.');
      setIsImporting(false);
    }
  };

  const percentProgress = progress
    ? progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 50
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-lg select-none">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FolderArchive className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
                Upload Project
              </DialogTitle>
              <DialogDescription className="text-13 text-muted-foreground mt-0.5">
                Upload a zipped project (.zip) from your computer
              </DialogDescription>
            </div>
          </div>
          {!isImporting && (
            <button
              type="button"
              onClick={handleClose}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {isImporting ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-sm font-semibold text-foreground">
                  {progress?.message || 'Importing project...'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Validating archive entries, unpacking project tree, and detecting root LaTeX document.
                </p>
              </div>

              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50 mt-2">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(15, percentProgress)}%` }}
                />
              </div>
            </div>
          ) : !selectedFile ? (
            <div className="space-y-3">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none',
                  isDraggingOver
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10',
                )}
              >
                <div className="size-12 rounded-full bg-muted flex items-center justify-center text-foreground/70 mb-3 shadow-inner">
                  <Upload className="size-5" />
                </div>
                <p className="text-13 font-medium text-foreground">
                  Drag & drop a <span className="font-semibold text-primary">.zip</span> archive here
                </p>
                <p className="text-12 text-muted-foreground mt-1 max-w-xs">
                  Supports archives from Overleaf, arXiv, GitHub, or local LaTeX bundles
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 text-12 gap-1.5 h-8 pointer-events-none"
                >
                  <span>Select a .zip file</span>
                </Button>
              </div>

              {fileError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-12">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-md bg-success/10 text-success flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-12 font-medium text-foreground truncate max-w-[260px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-11 text-muted-foreground">
                        {formatBytes(selectedFile.size)} · Ready to unpack on server
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetState}
                    className="h-7 px-2 text-12 text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Change file
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-12 font-medium text-foreground block">
                  Project Name
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="h-8 text-13"
                  autoFocus
                />
                <p className="text-11 text-muted-foreground">
                  Root LaTeX document and directory hierarchy will be configured automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isImporting}
            className="h-8 px-3 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleStartImport}
            disabled={!selectedFile || isImporting || !projectName.trim()}
            className="h-8 px-3.5 text-12 font-medium gap-1.5 shadow-none cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="size-3.5 shrink-0" />
                <span>Upload Project</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UploadProjectZipModal;
