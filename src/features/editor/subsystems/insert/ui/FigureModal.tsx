'use client';

/**
 * FigureModal.tsx
 *
 * Minimal figure insertion dialog aligned with Overleaf:
 * - Project image picker, folder-targeted upload, drag-and-drop, clipboard paste, and path input
 * - Width presets/custom input, Center toggle, Caption, and Label
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, Check, FileImage, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import { useEditorStorage } from '@/features/editor/subsystems/explorer/hooks/useStorage';
import { useAuthorizedImageSrc } from '@/features/editor/core/hooks/useAuthorizedImageSrc';
import {
  figureWizardSchema,
  type FigureWizardFormValues,
} from '@/features/editor/domain/types/core.types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import { IMAGE_EXTENSIONS } from '@/features/editor/core';

function FigureThumb({ url, alt }: { url?: string | null; alt: string }) {
  const src = useAuthorizedImageSrc(url);
  if (!src) {
    return <FileImage className="size-6 text-muted-foreground" />;
  }
  return <img src={src} alt={alt} className="w-full h-full object-contain" />;
}

function resolveRelativePath(
  item: EditorStorageItem,
  folderMap: Map<string, EditorStorageItem>,
): string {
  if (typeof item.path === 'string' && item.path.trim()) {
    return item.path.trim().replace(/^\/+/, '');
  }
  const parts: string[] = [item.filename];
  let parentId = item.parentId;
  const visited = new Set<string>([item.id]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = folderMap.get(parentId);
    if (!parent) break;
    parts.unshift(parent.filename);
    parentId = parent.parentId;
  }
  return parts.join('/');
}

export interface FigureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPageId: string | null;
  onInsert: (latexCode: string) => void;
}

const WIDTH_PRESETS = [
  { id: '0.5\\linewidth', label: '50%' },
  { id: '0.8\\linewidth', label: '80%' },
  { id: '1.0\\linewidth', label: '100%' },
  { id: '\\textwidth', label: 'Full' },
];

export function FigureModal({
  open,
  onOpenChange,
  parentPageId,
  onInsert,
}: FigureModalProps) {
  const { items: files, isLoading, uploadFile } = useEditorStorage(
    parentPageId,
    undefined,
    undefined,
    { enabled: open },
  );

  const folders = useMemo(
    () => (files ? files.filter((f) => f.isFolder) : []),
    [files],
  );

  const folderMap = useMemo(() => {
    const map = new Map<string, EditorStorageItem>();
    for (const folder of folders) {
      map.set(folder.id, folder);
    }
    return map;
  }, [folders]);

  const images = useMemo(() => {
    if (!files) return [];
    return files.filter((f) => {
      if (f.isFolder) return false;
      const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
      return (
        IMAGE_EXTENSIONS.has(ext) ||
        Boolean(f.mimeType && f.mimeType.startsWith('image/'))
      );
    });
  }, [files]);

  const [folderId, setFolderId] = useState<string>('');

  const form = useForm<FigureWizardFormValues>({
    resolver: zodResolver(figureWizardSchema),
    defaultValues: {
      selectedFilename: '',
      caption: '',
      label: '',
      width: '0.8\\linewidth',
      angle: '0',
      placement: 'htbp',
      centering: true,
    },
  });

  const { watch, setValue, register } = form;
  const values = watch();
  const imagePath = values.selectedFilename.trim();
  const hasValidPath = Boolean(imagePath);

  const handleSelect = useCallback(
    (relativePath: string) => {
      setValue('selectedFilename', relativePath, { shouldValidate: true });
      const baseName = relativePath.split('/').pop() || relativePath;
      const stem = baseName
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      if (stem) {
        setValue('label', `fig:${stem}`);
      }
    },
    [setValue],
  );

  const latex = useMemo(() => {
    if (!imagePath) return '';

    const width = values.width.trim() || '0.8\\linewidth';
    let code = `\\begin{figure}[${values.placement || 'htbp'}]\n`;
    if (values.centering) {
      code += `  \\centering\n`;
    }
    code += `  \\includegraphics[width=${width}]{${imagePath}}\n`;
    if (values.caption.trim()) {
      code += `  \\caption{${values.caption.trim()}}\n`;
    }
    if (values.label.trim()) {
      code += `  \\label{${values.label.trim()}}\n`;
    }
    code += `\\end{figure}\n`;
    return code;
  }, [
    imagePath,
    values.placement,
    values.centering,
    values.width,
    values.caption,
    values.label,
  ]);

  const handleInsert = useCallback(() => {
    if (!imagePath || !latex) return;
    onInsert(latex);
    onOpenChange(false);
  }, [imagePath, latex, onInsert, onOpenChange]);

  useEffect(() => {
    if (images.length > 0 && !values.selectedFilename) {
      handleSelect(resolveRelativePath(images[0], folderMap));
    }
  }, [images, folderMap, values.selectedFilename, handleSelect]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleUploadFiles = useCallback(
    async (fileList: File[]) => {
      const validImages = fileList.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return IMAGE_EXTENSIONS.has(ext) || f.type.startsWith('image/');
      });
      if (validImages.length === 0) {
        toast.error(
          'Only image and vector graphic files (.png, .jpg, .pdf, .svg, .eps) are supported',
        );
        return;
      }
      if (!parentPageId) return;

      const targetParentId = folderId || null;
      const targetFolder = targetParentId ? folderMap.get(targetParentId) : undefined;
      const prefix = targetFolder ? resolveRelativePath(targetFolder, folderMap) : '';

      try {
        for (const file of validImages) {
          await uploadFile.mutateAsync({
            file,
            pageId: parentPageId,
            parentId: targetParentId,
          });
        }
        const selectedPath = prefix
          ? `${prefix}/${validImages[0].name}`
          : validImages[0].name;
        handleSelect(selectedPath);
        toast.success(`Uploaded ${selectedPath}`, { id: 'figure-upload' });
      } catch {
        // Handled by uploadFile
      }
    },
    [parentPageId, folderId, folderMap, uploadFile, handleSelect],
  );

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;
    try {
      await handleUploadFiles(Array.from(picked));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files || []);
      if (dropped.length > 0) {
        await handleUploadFiles(dropped);
      }
    },
    [handleUploadFiles],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) pasted.push(file);
        }
      }
      if (pasted.length > 0) {
        await handleUploadFiles(pasted);
      }
    },
    [handleUploadFiles],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPaste={handlePaste}
        className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-5 gap-3 text-xs bg-background border border-border shadow-raised-200 rounded-md"
      >
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Insert Figure
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.eps"
            aria-label="Upload figure image"
            className="hidden"
            onChange={handleFilePicked}
          />

          {/* Image Source */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'space-y-2.5 rounded-md transition-colors',
              isDragging && 'ring-2 ring-primary ring-offset-2 bg-primary/5 p-1',
            )}
          >
            <div className="flex flex-wrap items-center justify-end gap-2">
              {folders.length > 0 && (
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  aria-label="Target folder for upload"
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">/</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      /{resolveRelativePath(folder, folderMap)}
                    </option>
                  ))}
                </select>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFile.isPending}
                className="gap-1.5 h-7 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground"
              >
                {uploadFile.isPending ? (
                  <Loader2 className="size-3 animate-spin text-primary motion-reduce:animate-none" />
                ) : (
                  <Upload className="size-3" />
                )}
                <span>Upload</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="h-28 rounded-md border border-border bg-muted/20 flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" />
              </div>
            ) : images.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'h-28 rounded-md border border-dashed bg-muted/20 flex flex-col items-center justify-center gap-1.5 text-center p-4 transition-colors cursor-pointer',
                  isDragging ? 'border-primary bg-primary/10' : 'border-border',
                )}
              >
                <FileImage
                  className={cn(
                    'size-7',
                    isDragging ? 'text-primary' : 'text-muted-foreground/50',
                  )}
                />
                <p className="text-xs font-medium text-foreground">
                  {isDragging ? 'Drop image here' : 'No images yet'}
                </p>
                <p className="text-11 text-muted-foreground">
                  Drop, paste, or click to upload
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1.5 border border-border rounded-md bg-muted/10">
                {images.map((img) => {
                  const path = resolveRelativePath(img, folderMap);
                  const isSelected = values.selectedFilename === path;
                  return (
                    <div
                      key={img.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(path)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(path);
                        }
                      }}
                      className={cn(
                        'group relative rounded-md border p-1.5 flex flex-col items-center gap-1.5 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background border-border hover:bg-muted/40',
                      )}
                    >
                      <div className="w-full h-16 rounded-sm bg-muted flex items-center justify-center overflow-hidden">
                        <FigureThumb url={img.url} alt={img.filename} />
                      </div>
                      <span
                        title={path}
                        className="w-full truncate text-11 text-center font-mono font-medium text-foreground"
                      >
                        {img.filename}
                      </span>

                      {isSelected && (
                        <div className="absolute top-1 right-1 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="size-2.5" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <label
                htmlFor="figure-image-path"
                className="text-11 font-medium text-muted-foreground w-14 shrink-0"
              >
                Path
              </label>
              <Input
                id="figure-image-path"
                value={values.selectedFilename}
                onChange={(e) =>
                  setValue('selectedFilename', e.target.value, { shouldValidate: true })
                }
                placeholder="figures/plot.png"
                className="h-8 text-xs font-mono rounded-md border-border bg-background flex-1"
              />
            </div>
          </div>

          {/* Display Settings */}
          <div className="space-y-2.5 pt-2.5 border-t border-border">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="figure-width-input"
                className="text-11 font-medium text-muted-foreground w-14 shrink-0"
              >
                Width
              </label>
              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {WIDTH_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.id}
                    onClick={() => setValue('width', p.id, { shouldValidate: true })}
                    className={cn(
                      'h-7 px-2.5 text-11 font-medium rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      values.width === p.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <Input
                  id="figure-width-input"
                  {...register('width')}
                  placeholder="8cm"
                  className="h-7 w-32 text-xs font-mono bg-background"
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer shrink-0 ml-auto">
                <Checkbox
                  checked={values.centering}
                  onCheckedChange={(c) => setValue('centering', Boolean(c))}
                />
                <span>Center</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="figure-caption-input"
                  className="text-11 font-medium text-muted-foreground w-14 shrink-0"
                >
                  Caption
                </label>
                <Input
                  id="figure-caption-input"
                  {...register('caption')}
                  placeholder="Caption"
                  className="h-8 text-xs rounded-md border-border bg-background flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="figure-label-input"
                  className="text-11 font-medium text-muted-foreground shrink-0"
                >
                  Label
                </label>
                <Input
                  id="figure-label-input"
                  {...register('label')}
                  placeholder="fig:label"
                  className="h-8 text-xs font-mono rounded-md border-border bg-background flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleInsert}
            disabled={!hasValidPath}
            className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Insert</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FigureModal;
