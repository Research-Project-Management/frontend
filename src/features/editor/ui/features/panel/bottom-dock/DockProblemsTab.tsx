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
} from 'lucide-react';
import type { CompileError } from '../../../store/compiler.store';
import { editorCommandBus } from '../../../coordinators/command-bus';

export interface DockProblemsTabProps {
  filteredErrors: CompileError[];
  searchFilter: string;
}

export function DockProblemsTab({
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
    <div className="h-full w-full overflow-y-auto">
      <table className="w-full text-left font-sans text-12 border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-muted-foreground text-11 font-medium uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
            <th className="py-1.5 px-3 w-12 text-center">Type</th>
            <th className="py-1.5 px-3 w-40 sm:w-48">Location</th>
            <th className="py-1.5 px-3">Description</th>
            <th className="py-1.5 px-3 w-28 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredErrors.map((err, idx) => {
            const isError = err.severity === 'error' || !err.severity;
            return (
              <tr
                key={idx}
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
                  <span className="flex items-center gap-1.5 font-mono text-12">
                    <FileCode className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="truncate font-medium text-foreground max-w-[130px] sm:max-w-[170px]">
                      {err.file || 'main.tex'}
                    </span>
                    <span className="text-primary font-semibold shrink-0">
                      :{err.line ?? 1}
                    </span>
                  </span>
                </td>

                {/* Error Description & Context */}
                <td className="py-2 px-3 align-top min-w-0">
                  <span className="font-medium text-foreground leading-normal block">
                    {err.message}
                  </span>
                  {err.context && (
                    <div className="font-mono text-11 text-foreground/85 bg-muted/40 border border-border/50 rounded-md p-2 mt-1.5 leading-relaxed whitespace-pre-wrap select-text">
                      {err.context}
                    </div>
                  )}
                </td>

                {/* AI Fix CTA Action Buttons */}
                <td className="py-2 px-3 text-right align-top w-36 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handle1ClickAiFix(e, err)}
                      disabled={fixingLine === (err.line ?? 1)}
                      title="1-Click AI Fix: Generate inline ghost diff directly in CodeMirror (Tab to accept)"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-11 font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
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
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-11 font-medium bg-ai/10 hover:bg-ai/20 text-ai border border-ai/20 hover:border-ai/30 transition-colors cursor-pointer shrink-0"
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
}
