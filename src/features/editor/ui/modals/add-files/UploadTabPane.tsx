'use client';

import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { readEntriesRecursively } from './add-files.utils';

export interface UploadTabPaneProps {
  onPickItems?: (items: { file: File; name: string }[]) => void;
  onClose: () => void;
}

export function UploadTabPane({
  onPickItems,
  onClose,
}: UploadTabPaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleNativeFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    onClose();
    onPickItems?.(picked.map((f) => ({ file: f, name: f.name })));
  };

  const handleNativeFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    onClose();
    onPickItems?.(
      picked.map((f) => ({
        file: f,
        name: (f as any).webkitRelativePath || f.name,
      })),
    );
  };

  const handleModalDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dtItems = e.dataTransfer.items;
    const allItems: { file: File; name: string }[] = [];
    const folderEntries: FileSystemDirectoryEntry[] = [];
    const plainFiles: File[] = [];

    if (dtItems?.length) {
      for (let i = 0; i < dtItems.length; i++) {
        const entry = dtItems[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          folderEntries.push(entry as FileSystemDirectoryEntry);
        } else if (entry?.isFile) {
          const file = e.dataTransfer.files[i];
          if (file) plainFiles.push(file);
        }
      }
    } else {
      plainFiles.push(...Array.from(e.dataTransfer.files));
    }

    plainFiles.forEach((f) => allItems.push({ file: f, name: f.name }));

    for (const dir of folderEntries) {
      const folderFiles = await readEntriesRecursively(dir, dir.name);
      for (const { file, relativePath } of folderFiles) {
        allItems.push({ file, name: relativePath });
      }
    }

    if (allItems.length > 0) {
      onClose();
      onPickItems?.(allItems);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Hidden inputs for upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleNativeFilesPicked}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleNativeFolderPicked}
        {...({ webkitdirectory: '', directory: '' } as any)}
      />

      <div className="space-y-4 pt-1">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
          }}
          onDrop={handleModalDrop}
          className={cn(
            'border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center gap-3 transition-colors text-center cursor-pointer',
            isDraggingOver
              ? 'border-primary bg-primary/5'
              : 'border-border/80 hover:border-foreground/30 bg-muted/10',
          )}
        >
          <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Upload className="size-5" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-12 font-medium text-foreground">
              Drag and drop files here, or
            </p>
            <p className="text-11 text-muted-foreground">
              Maximum file size: 50MB. LaTeX files, images, PDFs, and folders are supported.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none"
            >
              Select files
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
            >
              Select a folder
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-border mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
