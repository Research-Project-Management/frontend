'use client';

/**
 * SuggestionCard.tsx
 *
 * Renders AS the assistant message bubble — avatar is handled by the parent.
 * Contains: explanation, diff preview, Keep / Dismiss / Retry buttons.
 */

import React, { useState } from 'react';
import { Check, X, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import {
  AiPatchEngine,
  type AiEditResponse,
  type AiEditOperation,
  type ConflictItem,
} from '@/features/editor/utils/ai.util';
import { renderMarkdown } from '@/features/editor/utils/markdown.util';
import ConflictDialog from './ConflictDialog';

function DiffViewer({
  oldText,
  newText,
  startLine,
}: {
  oldText: string;
  newText: string;
  startLine: number;
}) {
  const oldLines = oldText ? oldText.split('\n').filter((l) => l.trim()) : [];
  const newLines = newText ? newText.split('\n') : [];

  if (oldLines.length === 0 && newLines.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/55 bg-muted/20 text-[11px]">
      <div className="flex min-h-7 items-center gap-2 border-b border-border/45 bg-muted/35 px-2.5">
        <span className="select-none font-sans text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          Diff
        </span>
        {startLine > 0 && (
          <span className="ml-auto rounded-full border border-border/45 bg-background/70 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground/60">
            line {startLine}
          </span>
        )}
      </div>

      <div className="max-h-56 overflow-auto font-mono">
        {oldLines.map((line, i) => (
          <div
            key={`r${i}`}
            className="grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)] border-b border-red-500/10 bg-red-500/7 text-red-500/80 last:border-b-0"
          >
            <span className="select-none py-1.5 text-center font-semibold">-</span>
            <span className="select-none border-r border-red-500/15 py-1.5 pr-2 text-right text-[10px] text-red-500/40">
              {startLine + i}
            </span>
            <span className="px-2.5 py-1.5 leading-relaxed line-through decoration-red-500/40 whitespace-pre-wrap break-all">
              {line || ' '}
            </span>
          </div>
        ))}

        {newLines.map((line, i) => (
          <div
            key={`a${i}`}
            className="grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)] border-b border-emerald-500/10 bg-emerald-500/7 text-emerald-600 last:border-b-0 dark:text-emerald-300"
          >
            <span className="select-none py-1.5 text-center font-semibold">+</span>
            <span className="select-none border-r border-emerald-500/15 py-1.5 pr-2 text-right text-[10px] text-muted-foreground/45">
              {startLine + i}
            </span>
            <span className="px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap break-all">
              {line || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SuggestionCardProps {
  editResponse: AiEditResponse;
  fileContent: string;
  initialBaseContent?: string;
  safetyWarning?: string | null;
  onApply: (edits: AiEditOperation[]) => void;
  onDismiss: () => void;
  onRegenerate?: () => void;
}

export function SuggestionCard({
  editResponse,
  fileContent,
  initialBaseContent,
  safetyWarning,
  onApply,
  onDismiss,
  onRegenerate,
}: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [conflictState, setConflictState] = useState<{
    open: boolean;
    conflicts: ConflictItem[];
  }>({
    open: false,
    conflicts: [],
  });

  const { explanation = 'AI did not return any editable changes.', intent } = editResponse ?? {};
  const edits = Array.isArray(editResponse?.edits) ? editResponse.edits : [];

  const isNoChange = intent === 'no_change' || edits.length === 0;
  const editCount = edits.length;
  const firstEdit = edits[0];

  const handleApplyClick = () => {
    const base = initialBaseContent ?? fileContent;
    const conflictRes = AiPatchEngine.detectConflict(base, fileContent, edits);
    if (conflictRes.hasConflict) {
      setConflictState({ open: true, conflicts: conflictRes.conflicts });
    } else {
      onApply(edits);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-lg rounded-tl-sm border border-border/60 bg-card">
      <div className="px-3.5 pt-3 pb-2.5 border-b border-border/35">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">
            AI
          </span>
          {editCount > 1 && (
            <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
              {editCount} changes
            </span>
          )}
        </div>
        <div className="text-[13px] text-foreground/85 leading-relaxed [&_code]:break-all">
          {renderMarkdown(explanation)}
        </div>
      </div>

      {safetyWarning && (
        <div className="mx-3.5 mt-2 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2">
          <AlertTriangle className="size-3.5 text-primary shrink-0 mt-px" />
          <p className="text-[11px] text-foreground/80 leading-relaxed">{safetyWarning}</p>
        </div>
      )}

      {!isNoChange && firstEdit && (
        <div className="px-3.5 pt-2.5 pb-1">
          <DiffViewer
            oldText={AiPatchEngine.extractOldText(fileContent, firstEdit)}
            newText={firstEdit.text ?? ''}
            startLine={firstEdit.startLineNumber}
          />

          {editCount > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-secondary/45 hover:text-foreground outline-none"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded
                ? 'Hide changes'
                : `+${editCount - 1} more change${editCount - 1 > 1 ? 's' : ''}`}
            </button>
          )}

          {expanded &&
            edits.slice(1).map((edit: AiEditOperation, i: number) => (
              <div key={i} className="mt-2">
                <DiffViewer
                  oldText={AiPatchEngine.extractOldText(fileContent, edit)}
                  newText={edit.text ?? ''}
                  startLine={edit.startLineNumber}
                />
              </div>
            ))}
        </div>
      )}

      {/* Actions footer */}
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        {!isNoChange && (
          <button
            type="button"
            onClick={handleApplyClick}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.99] sm:flex-none outline-none"
          >
            <Check className="size-3.5" />
            Keep changes
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border/60 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:flex-none outline-none"
        >
          <X className="size-3.5" />
          Dismiss
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-secondary/40 hover:text-muted-foreground sm:ml-auto sm:w-auto outline-none"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        )}
      </div>

      {/* Conflict Resolution Dialog */}
      <ConflictDialog
        open={conflictState.open}
        conflicts={conflictState.conflicts}
        onForceOverwrite={() => {
          setConflictState({ open: false, conflicts: [] });
          onApply(edits);
        }}
        onDiscard={() => {
          setConflictState({ open: false, conflicts: [] });
          onDismiss();
        }}
        onReprompt={
          onRegenerate
            ? () => {
                setConflictState({ open: false, conflicts: [] });
                onRegenerate();
              }
            : undefined
        }
      />
    </div>
  );
}

export default SuggestionCard;
