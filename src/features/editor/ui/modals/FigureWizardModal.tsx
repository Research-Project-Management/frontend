'use client';

/**
 * FigureWizardModal.tsx
 *
 * Canonical Presentational Modal for LaTeX figure insertion (Block 7: UI Shell / Modals Layer):
 * - State and validation managed by `useFigureWizard` (React Hook Form + Zod)
 * - Toasts and clipboard operations encapsulated within the hook
 * - Zero direct toast imports in this presentation component
 * Location: `features/editor/ui/modals/FigureWizardModal.tsx`
 */

import React, { useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Check,
  Copy,
  FileImage,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import { useEditorStorage } from '@/features/editor/hooks/use-storage';
import { resolveFileUrl } from '@/features/editor/utils/editor.util';
import { useFigureWizard } from './hooks/useFigureWizard';

export interface FigureWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPageId: string | null;
  onInsert: (latexCode: string) => void;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf', 'svg', 'eps', 'webp', 'gif']);

const WIDTH_PRESETS = [
  { id: '0.5\\linewidth', label: '50% (0.5\\linewidth)' },
  { id: '0.8\\linewidth', label: '80% (0.8\\linewidth)' },
  { id: '1.0\\linewidth', label: '100% (1.0\\linewidth)' },
  { id: '\\textwidth', label: 'Full Text Width (\\textwidth)' },
  { id: '8cm', label: 'Fixed 8cm' },
];

export function FigureWizardModal({
  open,
  onOpenChange,
  parentPageId,
  onInsert,
}: FigureWizardModalProps) {
  const { files, isLoading, uploadFile } = useEditorStorage(parentPageId, undefined);

  // Filter for image files
  const imageFiles = React.useMemo(() => {
    if (!files) return [];
    return files.filter((f) => {
      if (f.isFolder) return false;
      const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
      return IMAGE_EXTENSIONS.has(ext) || (f.mimeType && f.mimeType.startsWith('image/'));
    });
  }, [files]);

  const {
    form,
    values,
    generatedLatex,
    handleSelectImage,
    insertFigure,
    copyFigureCode,
  } = useFigureWizard({
    onInsert,
    onClose: () => onOpenChange(false),
  });

  const { register, setValue } = form;

  // Auto-select first image if none selected
  useEffect(() => {
    if (imageFiles.length > 0 && !values.selectedFilename) {
      handleSelectImage(imageFiles[0].filename);
    }
  }, [imageFiles, values.selectedFilename, handleSelectImage]);

  // Upload handler
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = e.target.files;
    if (!pickedFiles || pickedFiles.length === 0) return;

    try {
      const fileList = Array.from(pickedFiles);
      if (fileList.length > 0 && parentPageId) {
        for (const file of fileList) {
          await uploadFile.mutateAsync({ file, pageId: parentPageId, parentId: null });
        }
        const uploadedName = fileList[0].name;
        handleSelectImage(uploadedName);
      }
    } catch {
      // Error already handled by uploadFile mutation hook
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 gap-4 text-xs bg-background border border-border shadow-raised-300 rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ImageIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Insert LaTeX Figure
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select an image from your project files or upload a new figure.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.eps"
          className="hidden"
          onChange={handleFilePicked}
        />

        {/* Section 1: Image Selector Gallery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Select Project Image ({imageFiles.length} available)
            </span>
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
              Upload Image
            </Button>
          </div>

          {isLoading ? (
            <div className="h-32 rounded-md border border-border bg-muted/20 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" />
            </div>
          ) : imageFiles.length === 0 ? (
            <div className="h-32 rounded-md border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-center p-4">
              <FileImage className="size-8 text-muted-foreground/40" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">No images in project yet</p>
                <p className="text-11 text-muted-foreground">
                  Click the Upload Image button above to add a PNG, JPG, or PDF graphic.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1.5 border border-border rounded-md bg-muted/10">
              {imageFiles.map((img) => {
                const isSelected = values.selectedFilename === img.filename;
                const url = resolveFileUrl(img.url);
                return (
                  <div
                    key={img.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectImage(img.filename)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectImage(img.filename);
                      }
                    }}
                    className={cn(
                      'group relative rounded-md border p-1.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:border-border hover:bg-muted/40',
                    )}
                  >
                    <div className="w-full h-16 rounded-sm bg-muted flex items-center justify-center overflow-hidden">
                      {url ? (
                        <img
                          src={url}
                          alt={img.filename}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <FileImage className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <span className="w-full truncate text-11 text-center font-mono font-medium text-foreground">
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
        </div>

        {/* Section 2: Figure Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          {/* Width Presets */}
          <div>
            <label className="text-11 font-medium text-muted-foreground mb-1 block">
              Figure Width
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {WIDTH_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setValue('width', p.id, { shouldValidate: true })}
                  className={cn(
                    'h-7 px-2 text-11 font-medium rounded-sm border truncate text-center transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                    values.width === p.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-foreground hover:bg-muted',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Caption & Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Caption
              </label>
              <Input
                {...register('caption')}
                placeholder="Figure caption description"
                className="h-8 text-xs rounded-md border-border bg-background"
              />
            </div>
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Label (for \ref)
              </label>
              <Input
                {...register('label')}
                placeholder="fig:my_figure"
                className="h-8 text-xs font-mono rounded-md border-border bg-background"
              />
            </div>
          </div>

          {/* Placement & Centering */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-11 font-medium text-muted-foreground">
                Placement:
              </label>
              <div className="flex items-center gap-1">
                {['htbp', '!ht', 't', 'b', 'h'].map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setValue('placement', spec, { shouldValidate: true })}
                    className={cn(
                      'px-2 py-0.5 text-11 font-mono rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      values.placement === spec
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted',
                    )}
                  >
                    [{spec}]
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="figure-centering"
                checked={values.centering}
                onCheckedChange={(c) => setValue('centering', Boolean(c))}
              />
              <label
                htmlFor="figure-centering"
                className="text-xs font-medium text-foreground cursor-pointer"
              >
                Center figure (\centering)
              </label>
            </div>
          </div>
        </div>

        {/* Live Code Preview */}
        <div className="border border-border rounded-md bg-muted/10 p-2.5 font-mono text-11 max-h-24 overflow-y-auto select-all">
          <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
            {generatedLatex}
          </pre>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyFigureCode}
            className="gap-1.5 h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <Copy className="size-3.5" />
            Copy Code
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={insertFigure}
              className="gap-1.5 h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Check className="size-3.5" />
              Insert Figure
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FigureWizardModal;
