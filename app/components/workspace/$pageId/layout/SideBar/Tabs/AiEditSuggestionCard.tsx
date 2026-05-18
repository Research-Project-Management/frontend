/**
 * AiEditSuggestionCard.tsx
 *
 * Renders AS the assistant message bubble — avatar is handled by the parent.
 * Contains: explanation, diff preview, Keep / Dismiss / Retry buttons.
 */

import React, { useState } from "react";
import { Check, X, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { AiEditResponse, AiEditOperation } from "~/lib/ai-edit-types";
import { renderMarkdown } from "~/components/workspace/ai/layout/renderMarkdown";

// ── Diff viewer ────────────────────────────────────────────────────────────────

function DiffViewer({ oldText, newText, startLine }: { oldText: string; newText: string; startLine: number }) {
  const oldLines = oldText ? oldText.split("\n").filter(l => l.trim()) : [];
  const newLines = newText ? newText.split("\n") : [];

  if (oldLines.length === 0 && newLines.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/55 bg-muted/20 text-[11px]">
      {/* bar */}
      <div className="flex min-h-7 items-center gap-2 border-b border-border/45 bg-muted/35 px-2.5">
        <span className="select-none font-sans text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Diff</span>
        {startLine > 0 && (
          <span className="ml-auto rounded-full border border-border/45 bg-background/70 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground/60">
            line {startLine}
          </span>
        )}
      </div>

      <div className="max-h-56 overflow-auto font-mono">
        {/* Removed lines */}
        {oldLines.map((line, i) => (
          <div key={`r${i}`} className="grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)] border-b border-red-500/10 bg-red-500/7 text-red-500/80 last:border-b-0">
            <span className="select-none py-1.5 text-center font-semibold">−</span>
            <span className="select-none border-r border-red-500/15 py-1.5 pr-2 text-right text-[10px] text-red-500/40">
              {startLine + i}
            </span>
            <span className="px-2.5 py-1.5 leading-relaxed line-through decoration-red-500/40 whitespace-pre-wrap break-all">{line || " "}</span>
          </div>
        ))}

        {/* Added lines */}
        {newLines.map((line, i) => (
          <div key={`a${i}`} className="grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)] border-b border-emerald-500/10 bg-emerald-500/7 text-emerald-600 last:border-b-0 dark:text-emerald-300">
            <span className="select-none py-1.5 text-center font-semibold">+</span>
            <span className="select-none border-r border-emerald-500/15 py-1.5 pr-2 text-right text-[10px] text-muted-foreground/45">
              {startLine + i}
            </span>
            <span className="px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap break-all">{line || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Get "old text" from file content ──────────────────────────────────────────

function getOldText(fileContent: string, edit: AiEditOperation): string {
  const lines = fileContent.split("\n");
  const sl = edit.startLineNumber - 1;
  const el = edit.endLineNumber - 1;
  if (sl < 0 || sl >= lines.length) return "";
  if (edit.type === "insert") return "";
  if (sl === el) return lines[sl].slice(edit.startColumn - 1, edit.endColumn - 1);
  const parts: string[] = [lines[sl].slice(edit.startColumn - 1)];
  for (let i = sl + 1; i < el && i < lines.length; i++) parts.push(lines[i]);
  if (el < lines.length) parts.push(lines[el].slice(0, edit.endColumn - 1));
  return parts.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface AiEditSuggestionCardProps {
  editResponse: AiEditResponse;
  fileContent: string;
  safetyWarning?: string | null;
  onApply: (edits: AiEditOperation[]) => void;
  onDismiss: () => void;
  onRegenerate?: () => void;
}

export default function AiEditSuggestionCard({
  editResponse,
  fileContent,
  safetyWarning,
  onApply,
  onDismiss,
  onRegenerate,
}: AiEditSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { edits, explanation, intent } = editResponse;

  const isNoChange = intent === "no_change" || edits.length === 0;
  const editCount = edits.length;
  const firstEdit = edits[0];

  return (
    <div className="w-full overflow-hidden rounded-xl rounded-tl-sm border border-border/60 bg-card">

      {/* Explanation row */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-border/35">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">Flux AI</span>
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

      {/* Safety warning */}
      {safetyWarning && (
        <div className="mx-3.5 mt-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-px" />
          <p className="text-[11px] text-amber-500 leading-relaxed">{safetyWarning}</p>
        </div>
      )}

      {/* Diff — first edit */}
      {!isNoChange && firstEdit && (
        <div className="px-3.5 pt-2.5 pb-1">
          <DiffViewer
            oldText={getOldText(fileContent, firstEdit)}
            newText={firstEdit.text ?? ""}
            startLine={firstEdit.startLineNumber}
          />

          {editCount > 1 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-secondary/45 hover:text-foreground"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? "Hide changes" : `+${editCount - 1} more change${editCount - 1 > 1 ? "s" : ""}`}
            </button>
          )}

          {expanded && edits.slice(1).map((edit, i) => (
            <div key={i} className="mt-2">
              <DiffViewer
                oldText={getOldText(fileContent, edit)}
                newText={edit.text ?? ""}
                startLine={edit.startLineNumber}
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        {!isNoChange && (
          <button
            onClick={() => onApply(edits)}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.99] sm:flex-none"
          >
            <Check className="size-3.5" />
            Keep changes
          </button>
        )}
        <button
          onClick={onDismiss}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border/60 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:flex-none"
        >
          <X className="size-3.5" />
          Dismiss
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-secondary/40 hover:text-muted-foreground sm:ml-auto sm:w-auto"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
