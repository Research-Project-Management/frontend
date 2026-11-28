'use client';

/**
 * TableAiTab.tsx
 *
 * Tab panel for generating LaTeX tables via AI prompt and optional screenshot upload.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface TableAiTabProps {
  onApplyRaw: (latexOutput: string) => boolean;
  onFallbackImport: (latexOutput: string) => boolean;
  onSuccess: () => void;
}

export function TableAiTab({
  onApplyRaw,
  onFallbackImport,
  onSuccess,
}: TableAiTabProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [image, setImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearImage = useCallback(() => {
    setImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (image?.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, [image]);

  const handleImagePick = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, etc.)', {
        id: 'ai-table-image',
      });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl };
    });
  };

  const handleGenerate = useCallback(async () => {
    if ((!prompt.trim() && !image) || isGenerating) return;
    setIsGenerating(true);
    try {
      const parts: string[] = [];
      if (prompt.trim()) parts.push(prompt.trim());
      if (image) parts.push(`[Attached table image: ${image.file.name}]`);

      const output = await pagesService.ai.generateLatexTable(parts.join('\n\n'));
      const imported = onApplyRaw(output) || onFallbackImport(output);
      if (imported) {
        toast.success('Generated table with AI', { id: 'ai-table-gen' });
        setPrompt('');
        clearImage();
        onSuccess();
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to generate table with AI', {
        id: 'ai-table-gen',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, image, isGenerating, onApplyRaw, onFallbackImport, clearImage, onSuccess]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
      <div className="space-y-1.5">
        <label htmlFor="ai-table-prompt" className="text-11 font-medium text-foreground block">
          Describe the table
        </label>
        <textarea
          id="ai-table-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder="Describe columns, rows, or paste unformatted text (Ctrl+Enter to generate)..."
          rows={4}
          className="w-full p-2.5 text-xs rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-ai focus:border-ai/40"
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-11 font-medium text-foreground block">
          Table image (optional)
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImagePick(e.target.files?.[0])}
        />
        {image ? (
          <div className="flex items-center justify-between gap-3 p-2.5 border border-border rounded-md bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className="size-12 rounded-sm object-cover border border-border shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {image.file.name}
                </p>
                <p className="text-11 text-muted-foreground">
                  {Math.max(1, Math.round(image.file.size / 1024))} KB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearImage}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
              aria-label="Remove uploaded image"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleImagePick(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              'w-full flex flex-col items-center justify-center gap-1.5 p-4 rounded-md border border-dashed transition-colors cursor-pointer text-center',
              isDragOver
                ? 'border-ai bg-ai/10'
                : 'border-border bg-muted/15 hover:bg-muted/30',
            )}
          >
            <Upload className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              Drop a screenshot of a table or click to upload
            </span>
            <span className="text-11 text-muted-foreground">PNG, JPG, WebP</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleGenerate()}
          disabled={isGenerating || (!prompt.trim() && !image)}
          className="h-8 px-3 text-xs bg-ai text-ai-foreground hover:bg-ai-hover font-medium cursor-pointer gap-1.5 shadow-none"
        >
          {isGenerating && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}
          <span>{isGenerating ? 'Generating...' : 'Generate Table'}</span>
        </Button>
      </div>
    </div>
  );
}
