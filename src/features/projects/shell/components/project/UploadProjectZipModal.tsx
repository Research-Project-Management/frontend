'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FolderArchive,
  FileCode2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  isZipFile,
  parseZipArchive,
  extractAndImportZipToProject,
  type ExtractedZipProject,
  type ImportZipProgress,
} from '@/features/editor/utils/import-zip.util';

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
  const [extractedProject, setExtractedProject] = useState<ExtractedZipProject | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Upload & Extraction Progress
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportZipProgress | null>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setExtractedProject(null);
    setIsParsing(false);
    setProjectName('');
    setParseError(null);
    setIsImporting(false);
    setProgress(null);
    setIsDraggingOver(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isImporting) return; // Prevent closing mid-import
    onOpenChange(false);
    setTimeout(resetState, 200);
  }, [isImporting, onOpenChange, resetState]);

  const handleFile = useCallback(async (file: File) => {
    if (!isZipFile(file)) {
      setParseError('Please select a valid .zip archive file.');
      return;
    }

    setParseError(null);
    setSelectedFile(file);
    setIsParsing(true);

    try {
      const parsed = await parseZipArchive(file);
      if (parsed.totalFiles === 0) {
        setParseError('The selected archive is empty or contains no recognized project files.');
        setExtractedProject(null);
        return;
      }

      setExtractedProject(parsed);
      setProjectName(parsed.name);
    } catch (err: any) {
      console.error('[UploadProjectZipModal] Parse error:', err);
      setParseError(err?.message || 'Failed to read ZIP archive. The file might be corrupted.');
      setExtractedProject(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        handleFile(droppedFiles[0]);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        handleFile(files[0]);
      }
      e.target.value = '';
    },
    [handleFile],
  );

  const handleStartImport = async () => {
    if (!extractedProject || isImporting) return;

    const trimmedName = projectName.trim() || extractedProject.name || 'Imported Project';
    setIsImporting(true);

    try {
      const result = await extractAndImportZipToProject({
        extracted: extractedProject,
        projectName: trimmedName,
        onProgress: (p) => setProgress(p),
      });

      toast.success(`Project "${trimmedName}" created and imported successfully!`);
      handleClose();
      onSuccess?.(result);

      // Navigate to the editor for this project's root document
      router.push(`/editor/${result.rootPageId}`);
    } catch (err: any) {
      console.error('[UploadProjectZipModal] Import failed:', err);
      toast.error(err?.message || 'Failed to import project files.');
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
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl select-none">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FolderArchive className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                Upload Project
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Upload a zipped project (.zip) from your computer
              </DialogDescription>
            </div>
          </div>
          {!isImporting && (
            <button
              type="button"
              onClick={handleClose}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Ongoing Import Progress View */}
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
                  Unpacking files, creating project tree, and configuring LaTeX root document.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50 mt-2">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, percentProgress)}%` }}
                />
              </div>
              <span className="text-11 font-mono text-muted-foreground">
                {progress?.current ?? 0} / {progress?.total ?? 0} items ({percentProgress}%)
              </span>
            </div>
          ) : !extractedProject ? (
            /* Upload Drop Area */
            <div className="space-y-3">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none',
                  isDraggingOver
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30 bg-muted/10',
                )}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="size-8 text-primary animate-spin" />
                    <p className="text-xs font-medium text-foreground">Reading archive contents...</p>
                  </div>
                ) : (
                  <>
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center text-foreground/70 mb-3 shadow-inner">
                      <Upload className="size-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Drag & drop a <span className="font-semibold text-primary">.zip</span> archive here
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Supports archives from Overleaf, arXiv, GitHub, or local LaTeX bundles
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 text-xs gap-1.5 h-8 pointer-events-none"
                    >
                      <span>Select a .zip file</span>
                    </Button>
                  </>
                )}
              </div>

              {parseError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : (
            /* Selected & Analyzed Project View */
            <div className="space-y-4">
              {/* Archive Info Card */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate max-w-[260px]">
                        {selectedFile?.name}
                      </p>
                      <p className="text-11 text-muted-foreground">
                        {formatBytes(extractedProject.totalSize)} · {extractedProject.totalFiles} usable files
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetState}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change file
                  </Button>
                </div>

                {/* File breakdown badges */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-11 bg-muted text-foreground font-medium">
                    <FileCode2 className="size-3 text-primary" />
                    <span>{extractedProject.textFiles.length} source file(s)</span>
                  </span>
                  {extractedProject.assetFiles.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-11 bg-muted text-foreground font-medium">
                      <ImageIcon className="size-3 text-amber-500" />
                      <span>{extractedProject.assetFiles.length} asset(s)</span>
                    </span>
                  )}
                  {extractedProject.mainFilePath && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-11 bg-primary/10 text-primary font-medium">
                      <FileText className="size-3" />
                      <span>Main: {extractedProject.mainFilePath}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Project Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Project Name
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="h-9 text-xs"
                  autoFocus
                />
                <p className="text-11 text-muted-foreground">
                  This project will be initialized in your personal workspace.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isImporting}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleStartImport}
            disabled={!extractedProject || isImporting || !projectName.trim()}
            className="h-8 text-xs font-semibold gap-1.5 shadow-none cursor-pointer"
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
