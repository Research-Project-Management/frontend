'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  FileCode,
  Bot,
  Loader2,
  Wand2,
  Lightbulb,
} from 'lucide-react';
import type { CompileError } from '@/features/editor/store/compiler.store';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

export interface DockProblemsTabProps {
  filteredErrors: CompileError[];
  searchFilter: string;
}

export const DockProblemsTab = React.memo(function DockProblemsTab({
  filteredErrors,
  searchFilter,
}: DockProblemsTabProps) {
  const [fixingLine, setFixingLine] = useState<number | null>(null);

  const handleJumpToProblem = (line?: number | null, file?: string) => {
    if (!line) return;
    editorCommandBus.dispatch({
      type: 'navigation:jump-to-line',
      filePath: file || undefined,
      fileId: file || undefined,
      line,
      highlight: 'error',
    });
  };

  const handle1ClickAiFix = (e: React.MouseEvent, err: CompileError) => {
    e.stopPropagation();
    const line = err.line ?? 1;
    setFixingLine(line);

    editorCommandBus.dispatch({
      type: 'ai:autofix-diagnostic',
      diagnostic: {
        id: `diag-${Date.now()}`,
        message: err.message,
        line,
        file: err.file || 'main.tex',
        severity: err.severity === 'warning' ? 'warning' : 'error',
        context: err.context,
        suggestion: err.suggestion,
        fixedSnippet: err.fixedSnippet,
        originalSnippet: err.originalSnippet,
      },
    });

    setTimeout(() => {
      setFixingLine(null);
    }, 1500);
  };

  const handleAskAiToFix = (e: React.MouseEvent, err: CompileError) => {
    e.stopPropagation();
    editorCommandBus.dispatch({
      type: 'editor:suggest-fix',
      error: {
        message: err.message,
        line: err.line ?? undefined,
        file: err.file ?? undefined,
        context: err.context ?? undefined,
      },
    });
    // Open AI Sidebar panel immediately so the user sees the solution
    editorCommandBus.dispatch({
      type: 'sidebar:open-panel',
      panel: 'AI',
    });
  };

  if (filteredErrors.length === 0) {
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="flex flex-col items-center justify-center h-full text-foreground p-6 select-none">
          <div className="size-9 rounded-full bg-success/15 text-success flex items-center justify-center mb-2">
            <Check className="size-5 shrink-0" />
          </div>
          <p className="text-13 font-semibold text-foreground">
            {searchFilter
              ? 'No problems matching your filter'
              : 'No problems detected in the workspace'}
          </p>
          <p className="text-12 text-muted-foreground mt-0.5">
            {searchFilter
              ? 'Try refining or clearing your filter query.'
              : 'LaTeX source parsed cleanly with zero diagnostic errors.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto pb-10">
      <table className="w-full text-left font-sans text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-medium uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
            <th className="py-2 px-3 w-12 text-center">Type</th>
            <th className="py-2 px-3 w-40 sm:w-48">Location</th>
            <th className="py-2 px-3">Description</th>
            <th className="py-2 px-3 w-32 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredErrors.map((err, idx) => {
            const isError = err.severity === 'error' || !err.severity;
            const cleanMessage = (err.message || '').replace(/[\u2014\u2013]/g, '-');
            const cleanContext = (err.context || '').replace(/[\u2014\u2013]/g, '-');
            return (
              <tr
                key={`${err.file || 'main'}-${err.line ?? 1}-${idx}`}
                onClick={() => handleJumpToProblem(err.line, err.file)}
                className="border-b border-border/40 hover:bg-muted/25 transition-colors cursor-pointer group"
              >
                {/* Severity Type */}
                <td className="py-2 px-3 text-center align-top">
                  {isError ? (
                    <AlertCircle className="size-3.5 text-destructive inline shrink-0" />
                  ) : (
                    <AlertTriangle className="size-3.5 text-warning inline shrink-0" />
                  )}
                </td>

                {/* File & Line Location */}
                <td className="py-2 px-3 align-top">
                  <span className="flex items-center gap-1.5 font-mono text-xs">
                    <FileCode className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="truncate font-medium text-foreground max-w-[130px] sm:max-w-[170px]">
                      {err.file || 'main.tex'}
                    </span>
                    <span className="text-primary font-semibold shrink-0">
                      :{err.line ?? 1}
                    </span>
                  </span>
                </td>

                {/* Error Description & Context - Clean unnested monospace excerpt */}
                <td className="py-2 px-3 align-top min-w-0">
                  <span className="font-medium text-foreground leading-normal block text-xs">
                    {cleanMessage}
                  </span>
                  {cleanContext && (
                    <pre className="font-mono text-xs text-foreground/80 bg-muted/25 px-2.5 py-1.5 rounded-sm mt-1.5 leading-relaxed whitespace-pre-wrap select-text overflow-x-auto font-normal">
                      {cleanContext}
                    </pre>
                  )}
                  {err.suggestion && (
                    <div className="flex items-start gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 rounded px-2.5 py-1.5 mt-1.5 leading-relaxed">
                      <Lightbulb className="size-3.5 mt-0.5 shrink-0 text-warning" />
                      <span>{err.suggestion}</span>
                    </div>
                  )}
                </td>

                {/* AI Fix CTA Action Buttons */}
                <td className="py-2 px-3 text-right align-top w-40 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handle1ClickAiFix(e, err)}
                      disabled={fixingLine === (err.line ?? 1)}
                      title="1-Click AI Fix: Generate inline ghost diff directly in CodeMirror (Tab to accept)"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-success/10 hover:bg-success/20 text-success border border-success/20 hover:border-success/30 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {fixingLine === (err.line ?? 1) ? (
                        <Loader2 className="size-3 animate-spin shrink-0" />
                      ) : (
                        <Wand2 className="size-3 shrink-0" />
                      )}
                      <span className="font-semibold">1-Click Fix</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleAskAiToFix(e, err)}
                      title="Open full AI Error Assist in companion sidebar"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-ai/10 hover:bg-ai/20 text-ai border border-ai/20 hover:border-ai/30 transition-colors cursor-pointer shrink-0"
                    >
                      <Bot className="size-3 shrink-0" />
                      <span>Ask AI</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

