/**
 * AiEditSuggestionCard.tsx
 *
 * Renders AS the assistant message bubble — avatar is handled by the parent.
 * Contains: explanation, diff preview, Keep / Dismiss / Retry buttons.
 */

import React, { useState } from "react";
import { Check, X, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { AiEditResponse, AiEditOperation } from "~/lib/ai-edit-types";

// ── Diff viewer ────────────────────────────────────────────────────────────────

function DiffViewer({ oldText, newText, startLine }: { oldText: string; newText: string; startLine: number }) {
  const oldLines = oldText ? oldText.split("\n").filter(l => l.trim()) : [];
  const newLines = newText ? newText.split("\n") : [];

  if (oldLines.length === 0 && newLines.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 text-[11px] font-mono">
      {/* bar */}
      <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 border-b border-border/40">
        <span className="text-muted-foreground/50 text-[10px] font-sans font-medium tracking-widest uppercase select-none">diff</span>
        {startLine > 0 && (
          <span className="ml-auto text-muted-foreground/35 text-[10px] font-sans">
            :{startLine}
          </span>
        )}
      </div>

      <div className="overflow-x-auto max-h-56 overflow-y-auto">
        {/* Removed lines */}
        {oldLines.map((line, i) => (
          <div key={`r${i}`} className="flex items-start bg-red-500/8 hover:bg-red-500/12 transition-colors">
            <span className="shrink-0 w-6 text-center py-1 text-red-400 font-bold select-none">−</span>
            <span className="flex-1 py-1 pl-2 pr-4 text-red-400/75 line-through whitespace-pre leading-relaxed">{line || " "}</span>
          </div>
        ))}

        {/* Added lines */}
        {newLines.map((line, i) => (
          <div key={`a${i}`} className="flex items-start bg-emerald-500/8 hover:bg-emerald-500/12 transition-colors">
            <span className="shrink-0 w-6 text-center py-1 text-emerald-400 font-bold select-none">+</span>
            <span className="shrink-0 w-8 py-1 pr-2 text-right text-muted-foreground/30 text-[10px] select-none border-r border-border/25">
              {startLine + i}
            </span>
            <span className="flex-1 py-1 pl-3 pr-4 text-emerald-300 whitespace-pre leading-relaxed">{line || " "}</span>
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
    <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card/90 shadow-sm overflow-hidden w-full">

      {/* Explanation row */}
      <div className="px-3.5 pt-3 pb-2 border-b border-border/35">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">Flux AI</span>
          {editCount > 1 && (
            <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
              {editCount} changes
            </span>
          )}
        </div>
        <p className="text-[12px] text-foreground/85 leading-relaxed">{explanation}</p>
      </div>

      {/* Safety warning */}
      {safetyWarning && (
        <div className="flex items-start gap-2 mx-3.5 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
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
              className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/55 hover:text-muted-foreground transition-colors"
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
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        {!isNoChange && (
          <button
            onClick={() => onApply(edits)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
          >
            <Check className="size-3.5" />
            Keep changes
          </button>
        )}
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-xl border border-border/60 hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          Dismiss
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-xl hover:bg-secondary/40 transition-colors text-muted-foreground/55 hover:text-muted-foreground"
          >
            <RefreshCw className="size-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
