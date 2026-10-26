'use client';

/**
 * FigureWizardModal.tsx
 *
 * Modal for LaTeX figure insertion (UI Shell / Modals Layer):
 * - State and validation managed with React Hook Form + Zod
 * - Live preview with configurable dimensions, caption, and label
 * Location: `features/editor/ui/modals/FigureWizardModal.tsx`
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Check,
  Copy,
  FileImage,
  Loader2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { useEditorStorage } from '@/features/editor/ui/hooks/useStorage';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { figureWizardSchema, type FigureWizardFormValues } from '@/features/editor/domain/types/forms.types';
import { IMAGE_EXTENSIONS } from '@/features/editor/core';

export interface FigureWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPageId: string | null;
  onInsert: (latexCode: string) => void;
}

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
  const { items: files, isLoading, uploadFile } = useEditorStorage(parentPageId, undefined, undefined, {
    enabled: open,
  });

  // Filter for image files
  const imageFiles = React.useMemo(() => {
    if (!files) return [];
    return files.filter((f) => {
      if (f.isFolder) return false;
      const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
      return IMAGE_EXTENSIONS.has(ext) || (f.mimeType && f.mimeType.startsWith('image/'));
    });
  }, [files]);

  const form = useForm<FigureWizardFormValues>({
    resolver: zodResolver(figureWizardSchema),
    defaultValues: {
      selectedFilename: '',
      caption: 'Figure caption',
      label: 'fig:my_figure',
      width: '0.8\\linewidth',
      angle: '0',
      placement: 'htbp',
      centering: true,
    },
  });

  const { watch, setValue, register } = form;
  const values = watch();

  const handleSelectImage = useCallback(
    (filename: string) => {
      setValue('selectedFilename', filename, { shouldValidate: true });
      const stem = filename
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      setValue('label', `fig:${stem}`);
    },
    [setValue],
  );

  const generatedLatex = useMemo(() => {
    const imgName = values.selectedFilename || 'example-image.png';

    let code = `\\begin{figure}[${values.placement}]\n`;
    if (values.centering) {
      code += `  \\centering\n`;
    }
    const anglePart = values.angle && values.angle !== '0' ? `, angle=${values.angle}` : '';
    code += `  \\includegraphics[width=${values.width}${anglePart}]{${imgName}}\n`;
    if (values.caption) {
      code += `  \\caption{${values.caption}}\n`;
    }
    if (values.label) {
      code += `  \\label{${values.label}}\n`;
    }
    code += `\\end{figure}\n`;
    return code;
  }, [
    values.selectedFilename,
    values.placement,
    values.centering,
    values.width,
    values.caption,
    values.label,
    values.angle,
  ]);

  const insertFigure = useCallback(() => {
    onInsert(generatedLatex);
    onOpenChange(false);
  }, [onInsert, generatedLatex, onOpenChange]);

  const copyFigureCode = useCallback(() => {
    navigator.clipboard.writeText(generatedLatex);
    toast.info('LaTeX code copied to clipboard', { id: 'copy-figure-latex' });
  }, [generatedLatex]);

  // Auto-select first image if none selected
  useEffect(() => {
    if (imageFiles.length > 0 && !values.selectedFilename) {
      handleSelectImage(imageFiles[0].filename);
    }
  }, [imageFiles, values.selectedFilename, handleSelectImage]);

  // Upload handler
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const processIncomingFiles = useCallback(
    async (fileList: File[]) => {
      const validImages = fileList.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return IMAGE_EXTENSIONS.has(ext) || f.type.startsWith('image/');
      });
      if (validImages.length === 0) {
        toast.error('Only image and vector graphic files (.png, .jpg, .pdf, .svg, .eps) are supported');
        return;
      }
      if (!parentPageId) return;

      try {
        for (const file of validImages) {
          await uploadFile.mutateAsync({ file, pageId: parentPageId, parentId: null });
        }
        handleSelectImage(validImages[0].name);
        toast.success(`Uploaded and selected ${validImages[0].name}`, { id: 'figure-wizard-upload' });
      } catch {
        // Handled by uploadFile
      }
    },
    [parentPageId, uploadFile, handleSelectImage],
  );

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = e.target.files;
    if (!pickedFiles || pickedFiles.length === 0) return;
    try {
      await processIncomingFiles(Array.from(pickedFiles));
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
        await processIncomingFiles(dropped);
      }
    },
    [processIncomingFiles],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        await processIncomingFiles(pastedFiles);
      }
    },
    [processIncomingFiles],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPaste={handlePaste}
        className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-6 gap-3 text-xs bg-background border border-border shadow-raised-200 rounded-md"
      >
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Insert LaTeX Figure
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground mt-0.5">
            Select an image from your project files, drag & drop, paste from clipboard, or upload a new graphic.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body Pane */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.eps"
            aria-label="Upload figure image"
            className="hidden"
            onChange={handleFilePicked}
          />

          {/* Section 1: Image Selector Gallery */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'space-y-2 rounded-md transition-colors',
            isDragging && 'ring-2 ring-primary ring-offset-2 bg-primary/5 p-1'
          )}
        >
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
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'h-32 rounded-md border border-dashed bg-muted/20 flex flex-col items-center justify-center gap-2 text-center p-4 transition-colors cursor-pointer',
                isDragging ? 'border-primary bg-primary/10' : 'border-border'
              )}
            >
              <FileImage className={cn('size-8', isDragging ? 'text-primary' : 'text-muted-foreground/40')} />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">
                  {isDragging ? 'Drop figure image here' : 'No images in project yet'}
                </p>
                <p className="text-11 text-muted-foreground">
                  Drag & drop here, paste image from clipboard, or click to upload.
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
                      'group relative rounded-md border p-1.5 flex flex-col items-center gap-1.5 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border',
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

          {/* Custom path or URL input (Overleaf Parity) */}
          <div className="pt-2">
            <label className="text-11 font-medium text-muted-foreground mb-1 block">
              Image filename, relative path, or URL
            </label>
            <Input
              value={values.selectedFilename}
              onChange={(e) => handleSelectImage(e.target.value)}
              aria-label="Image filename, relative path, or URL"
              placeholder="e.g. plot.png, figures/chart.pdf, or https://..."
              className="h-8 text-xs font-mono rounded-md border-border bg-background"
            />
          </div>
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
                    'h-7 px-2 text-11 font-medium rounded-sm border truncate text-center transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1 after:content-[\'\']',
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
                aria-label="Figure caption"
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
                aria-label="Figure label"
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
                      'min-h-[28px] px-2 py-0.5 text-11 font-mono rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1 after:content-[\'\']',
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

            {/* Overleaf Parity: Rotation angle */}
            <div className="flex items-center gap-2">
              <label className="text-11 font-medium text-muted-foreground">
                Rotate:
              </label>
              <div className="flex items-center gap-1">
                {['0', '90', '180', '270'].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setValue('angle', deg, { shouldValidate: true })}
                    className={cn(
                      'min-h-[28px] px-2 py-0.5 text-11 font-mono rounded-sm border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1 after:content-[\'\']',
                      (values.angle ?? '0') === deg
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {deg}°
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
      </div>

      <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyFigureCode}
            className="gap-1.5 h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            <Copy className="size-3.5" />
            Copy Code
          </Button>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground outline-none focus-visible:ring-1 focus-visible:ring-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={insertFigure}
              className="gap-1.5 h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
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
