'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  Loader2,
  X,
  FileCode2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { pageKeys } from '../../hooks/use-page';

interface ImportDocumentModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: string;
  initialFormat?: 'docx' | 'md';
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function ImportDocumentModal({
  isOpen,
  setIsOpen,
  projectId,
  initialFormat = 'docx',
}: ImportDocumentModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [format, setFormat] = useState<'docx' | 'md'>(initialFormat);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat);
      setSelectedFile(null);
    }
  }, [isOpen, initialFormat]);

  const acceptExtensions =
    format === 'docx'
      ? '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : '.md,.markdown,text/markdown,text/plain';

  const handleFileChange = (file?: File) => {
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (format === 'docx' && !ext.endsWith('.docx')) {
      toast.error('Please upload a valid Microsoft Word document.');
      return;
    }
    if (format === 'md' && !ext.endsWith('.md') && !ext.endsWith('.markdown')) {
      toast.error('Please upload a valid Markdown document.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds the 25 MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !projectId) return;

    setIsSubmitting(true);
    const toastId = toast.loading(`Converting and importing ${selectedFile.name}...`);

    try {
      const result = await manuscriptService.exportImport.convertDocument(
        projectId,
        selectedFile,
        format,
      );

      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success('Document converted and imported successfully', { id: toastId });
      setIsOpen(false);
      setSelectedFile(null);

      if (result?.rootDocId) {
        router.push(`/projects/${projectId}/pages/${result.rootDocId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] p-6 bg-background border border-border/80 shadow-raised-200 rounded-md gap-4">
        <DialogHeader>
          <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
            {format === 'docx' ? 'Import Word Document' : 'Import Markdown Document'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload and convert Word or Markdown documents into project files.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden native input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptExtensions}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleFileChange(file);
          }}
        />

        {/* Drag and Drop Zone */}
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border border-dashed rounded-md p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border/80 hover:border-border hover:bg-muted/30'
            )}
          >
            <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center text-foreground">
              <UploadCloud className="size-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-12 font-semibold text-foreground">
                Click to browse or drag and drop
              </span>
              <p className="text-11 text-muted-foreground">
                {format === 'docx' ? 'Microsoft Word document up to 25 MB' : 'Markdown document up to 25 MB'}
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-md p-3.5 bg-muted/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-md bg-background border border-border flex items-center justify-center shrink-0">
                <FileCode2 className="size-4.5 text-foreground" />
              </div>
              <div className="min-w-0">
                <span className="text-12 font-medium text-foreground block truncate">
                  {selectedFile.name}
                </span>
                <span className="text-11 text-muted-foreground">
                  {formatBytes(selectedFile.size)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFile(null)}
              aria-label="Remove selected file"
              className="size-7 p-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedFile || isSubmitting}
            onClick={handleSubmit}
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none gap-1.5 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                <span>Importing...</span>
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportDocumentModal;
