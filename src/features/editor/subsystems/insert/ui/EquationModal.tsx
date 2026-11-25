'use client';

/**
 * EquationModal.tsx
 *
 * AI-assisted LaTeX equation insertion dialog with text prompt,
 * optional formula image upload / drag-and-drop, and live KaTeX preview.
 */

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Check, Loader2, Upload, X } from 'lucide-react';
import katex from 'katex';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface EquationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexCode: string) => void;
  initialPrompt?: string;
}

function stripEquationEnv(latex: string): string {
  const match = latex.match(/^\\begin\{equation\*?\}\s*([\s\S]*?)\s*\\end\{equation\*?\}$/);
  return match ? match[1] : latex;
}

export function EquationModal({
  open,
  onOpenChange,
  onInsert,
  initialPrompt = '',
}: EquationModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [latex, setLatex] = useState('');
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
        id: 'ai-equation-image',
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
      if (image) parts.push(`[Attached equation image: ${image.file.name}]`);

      const equation = await pagesService.ai.generateLatexEquation(parts.join('\n\n'));
      if (!equation) {
        toast.error('Could not generate an equation. Try rephrasing.', {
          id: 'ai-equation-gen',
        });
        return;
      }
      setLatex(equation);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to generate equation', {
        id: 'ai-equation-gen',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, image, isGenerating]);

  const previewHtml = useMemo(() => {
    if (!latex.trim()) return '';
    try {
      return katex.renderToString(stripEquationEnv(latex.trim()), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return '';
    }
  }, [latex]);

  const handleInsert = () => {
    if (!latex.trim()) return;
    onInsert(`${latex.trim()}\n`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-5 gap-3 text-xs bg-background border border-border shadow-raised-200 rounded-md">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Create Equation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 min-h-0 overflow-y-auto pr-0.5">
          <textarea
            id="equation-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleGenerate();
              }
            }}
            aria-label="Describe equation"
            placeholder="Describe an equation... (Ctrl+Enter)"
            rows={3}
            className="w-full p-2.5 text-xs rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-ai focus:border-ai/40"
          />

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
                  className="size-11 rounded-sm object-cover border border-border shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{image.file.name}</p>
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
                'w-full flex items-center justify-center gap-2 p-3 rounded-md border border-dashed transition-colors cursor-pointer text-xs text-muted-foreground',
                isDragOver
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-muted/15 hover:bg-muted/30 hover:text-foreground',
              )}
            >
              <Upload className="size-3.5" />
              <span>Drop formula image or click to upload</span>
            </button>
          )}

          {latex && (
            <div className="space-y-2">
              <div
                data-testid="equation-preview"
                className="p-3 border border-border rounded-md bg-muted/20 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              <textarea
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                aria-label="Generated LaTeX source"
                rows={3}
                className="w-full p-2 text-xs font-mono rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-1 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || (!prompt.trim() && !image)}
            className="h-8 px-3 text-xs bg-ai text-ai-foreground hover:bg-ai-hover font-medium cursor-pointer gap-1.5 shadow-none"
          >
            {isGenerating && (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            )}
            <span>{isGenerating ? 'Generating...' : latex ? 'Regenerate' : 'Generate'}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleInsert}
              disabled={!latex.trim()}
              className="h-8 px-3 text-xs gap-1.5 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Insert</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EquationModal;
