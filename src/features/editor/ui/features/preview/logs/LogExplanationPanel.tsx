'use client';

import React from 'react';
import { Copy } from 'lucide-react';
import { copySnippetToClipboard } from '../hooks/useLogViewerActions';
import type { ErrorExplanationDto } from '@/features/editor/domain/types';

export interface LogExplanationPanelProps {
  explanation: ErrorExplanationDto;
}

export function LogExplanationPanel({ explanation }: LogExplanationPanelProps) {
  return (
    <div
      role="region"
      aria-label="LaTeX Error Guide"
      onClick={(e) => e.stopPropagation()}
      className="ml-6 mt-2 pl-3.5 pr-2 py-2 border-l border-primary/40 text-xs space-y-2.5 select-text"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-13 text-foreground tracking-tight">
          {explanation.title || 'LaTeX Error Guide'}
        </h4>
      </div>

      {explanation.explanation && (
        <p className="text-xs text-foreground/90 leading-relaxed font-normal">
          {explanation.explanation}
        </p>
      )}

      {explanation.commonCauses && explanation.commonCauses.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <span className="font-medium text-xs text-foreground/80">Common Causes:</span>
          <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
            {explanation.commonCauses.map((cause: string, cIdx: number) => (
              <li key={cIdx}>{cause}</li>
            ))}
          </ul>
        </div>
      )}

      {explanation.suggestedFix && (
        <div className="space-y-1 pt-0.5">
          <span className="font-medium text-xs text-foreground/80">Suggested Fix:</span>
          <p className="text-xs text-muted-foreground pl-3 py-1 border-l border-border/60 font-mono leading-relaxed">
            {explanation.suggestedFix}
          </p>
        </div>
      )}

      {explanation.exampleSnippet && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-xs text-foreground/80">Example Snippet:</span>
            <button
              type="button"
              onClick={() => copySnippetToClipboard(explanation.exampleSnippet)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <Copy className="size-3" />
              <span>Copy</span>
            </button>
          </div>
          <pre className="font-mono text-xs pl-3 py-1 border-l border-border/60 text-foreground overflow-x-auto leading-relaxed bg-transparent">
            {explanation.exampleSnippet}
          </pre>
        </div>
      )}
    </div>
  );
}
