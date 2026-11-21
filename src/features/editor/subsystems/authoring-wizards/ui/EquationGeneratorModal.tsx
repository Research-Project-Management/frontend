'use client';

/**
 * EquationGeneratorModal.tsx
 *
 * AI Equation Generator (Overleaf AI Assist parity, text-to-LaTeX).
 * Location: `features/editor/subsystems/authoring-wizards/ui/EquationGeneratorModal.tsx`
 *
 * Flow: describe an equation in natural language → AI returns LaTeX → live KaTeX preview
 * with an editable source → insert into the editor at the cursor.
 */

import React, { useMemo, useState } from 'react';
import { Bot, Loader2, Sigma } from 'lucide-react';
import katex from 'katex';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

export interface EquationGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latexCode: string) => void;
  initialPrompt?: string;
}

function stripEquationEnvironment(latex: string): string {
  const match = latex.match(/^\\begin\{equation\*?\}\s*([\s\S]*?)\s*\\end\{equation\*?\}$/);
  return match ? match[1] : latex;
}

export function EquationGeneratorModal({
  open,
  onOpenChange,
  onInsert,
  initialPrompt = '',
}: EquationGeneratorModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [latex, setLatex] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = React.useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const equation = await pagesService.ai.generateLatexEquation(prompt.trim());
      if (!equation) {
        toast.error('AI could not generate an equation. Try rephrasing your description.', {
          id: 'ai-equation-gen',
        });
        return;
      }
      setLatex(equation);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to generate equation with AI', {
        id: 'ai-equation-gen',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating]);

  const previewHtml = useMemo(() => {
    if (!latex.trim()) return '';
    try {
      return katex.renderToString(stripEquationEnvironment(latex.trim()), {
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
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Sigma className="size-4" />
            AI Equation Generator
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground mt-0.5">
            Describe an equation in plain language and get the LaTeX code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 min-h-0 overflow-y-auto pr-1">
          <label className="text-11 font-medium text-ai flex items-center gap-1.5" htmlFor="equation-prompt">
            <Bot className="size-3.5" />
            Describe your equation
          </label>
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
            aria-label="Describe the equation for AI generation"
            placeholder="e.g. 'Softmax of z_i over all j' or 'Integral of x squared from 0 to 1'. Press Ctrl+Enter to generate..."
            rows={3}
            className="w-full p-2 text-xs rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-ai focus:border-ai/40"
          />

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
                rows={4}
                className="w-full p-2 text-xs font-mono rounded-md border border-border bg-background resize-none outline-none focus:ring-1 focus:ring-border"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !prompt.trim()}
            className="h-7 px-3 bg-ai text-ai-foreground hover:bg-ai-hover shadow-none cursor-pointer gap-1.5"
          >
            {isGenerating ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
            <span>{isGenerating ? 'Generating...' : latex ? 'Regenerate' : 'Generate'}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleInsert}
            disabled={!latex.trim()}
            className="h-7 px-3 cursor-pointer"
          >
            Insert into document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EquationGeneratorModal;
