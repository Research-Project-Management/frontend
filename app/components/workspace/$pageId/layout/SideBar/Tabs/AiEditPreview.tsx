/**
 * AiEditPreview.tsx — Preview-before-Apply Modal for AI Edits
 *
 * Shows a diff view of the AI's proposed edit before applying it.
 * Provides Apply / Cancel / Copy / Regenerate actions.
 */

import React, { useMemo, useState } from "react";
import { X, Check, Copy, RefreshCw, Zap, AlertTriangle } from "lucide-react";
import type { AiEditResponse, AiEditOperation } from "~/lib/ai-edit-types";

// ── Single-edit diff row ──────────────────────────────────────────────────────

function DiffRow({ label, text, color }: { label: string; text: string; color: "red" | "green" }) {
  const lines = text.split("\n");
  const bgClass = color === "red" ? "bg-[#2b0d0d]" : "bg-[#0d2b0d]";
  const textClass = color === "red" ? "text-red-300 line-through opacity-70" : "text-emerald-200";
  const gutterClass = color === "red" ? "text-red-400" : "text-emerald-400";
  const glyph = color === "red" ? "−" : "+";

  return (
    <>
      {lines.map((line, i) => (
        <div key={`${label}-${i}`} className={`flex px-0 ${bgClass}`}>
          <span className={`select-none shrink-0 w-5 text-center text-[10px] border-r border-white/10 mr-2 ${gutterClass}`}>
            {glyph}
          </span>
          <span className={`py-px pr-4 whitespace-pre font-mono text-[11px] ${textClass}`}>
            {line}
          </span>
        </div>
      ))}
    </>
  );
}

// ── Per-edit diff block ───────────────────────────────────────────────────────

function EditDiffBlock({
  edit,
  fileContent,
  index,
}: {
  edit: AiEditOperation;
  fileContent: string;
  index: number;
}) {
  const oldText = useMemo(() => {
    const lines = fileContent.split("\n");
    const sl = edit.startLineNumber - 1;
    const el = edit.endLineNumber - 1;
    if (sl < 0 || sl >= lines.length) return "";
    if (sl === el) {
      return lines[sl].slice(edit.startColumn - 1, edit.endColumn - 1);
    }
    const parts: string[] = [];
    parts.push(lines[sl].slice(edit.startColumn - 1));
    for (let i = sl + 1; i < el && i < lines.length; i++) parts.push(lines[i]);
    if (el < lines.length) parts.push(lines[el].slice(0, edit.endColumn - 1));
    return parts.join("\n");
  }, [edit, fileContent]);

  const rangeLabel =
    edit.startLineNumber === edit.endLineNumber
      ? `Line ${edit.startLineNumber}`
      : `Lines ${edit.startLineNumber}–${edit.endLineNumber}`;

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden text-[11px] font-mono mb-2">
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/60 border-b border-border/40">
        <span className="text-muted-foreground/60">
          Edit {index + 1} — {rangeLabel}
        </span>
        <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
          {edit.type}
        </span>
      </div>
      <div className="bg-[#1a1a1a] overflow-x-auto max-h-40">
        {oldText && edit.type !== "insert" && (
          <DiffRow label="old" text={oldText} color="red" />
        )}
        {edit.text && edit.type !== "delete" && (
          <DiffRow label="new" text={edit.text} color="green" />
        )}
        {!oldText && !edit.text && (
          <div className="px-3 py-2 text-muted-foreground/40 text-[10px]">
            (empty change)
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface AiEditPreviewProps {
  editResponse: AiEditResponse;
  fileContent: string;
  /** Called when user clicks Apply */
  onApply: (edits: AiEditOperation[]) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Called when user clicks Regenerate */
  onRegenerate?: () => void;
  /** Safety warning — show a caution message */
  safetyWarning?: string;
}

export default function AiEditPreview({
  editResponse,
  fileContent,
  onApply,
  onCancel,
  onRegenerate,
  safetyWarning,
}: AiEditPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = editResponse.edits.map((e) => e.text).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNoChange = editResponse.intent === "no_change";

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-[600px] max-w-[94vw] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <span className="text-sm font-semibold">AI Edit Preview</span>
            <span
              className={[
                "text-[9px] font-semibold px-1.5 py-px rounded-full border",
                isNoChange
                  ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  : "bg-primary/10 text-primary border-primary/20",
              ].join(" ")}
            >
              {editResponse.intent.replace(/_/g, " ")}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Explanation */}
        <div className="px-4 py-2.5 bg-secondary/20 border-b border-border/40 shrink-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {editResponse.explanation}
          </p>
        </div>

        {/* Safety Warning */}
        {safetyWarning && (
          <div className="flex items-start gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
            <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-px" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
              {safetyWarning}
            </p>
          </div>
        )}

        {/* Diff view */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isNoChange ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
              <Check className="size-8 text-emerald-500/50" />
              <p className="text-sm">No changes needed.</p>
            </div>
          ) : editResponse.edits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
              <AlertTriangle className="size-8 text-amber-500/50" />
              <p className="text-sm">No edit operations returned.</p>
            </div>
          ) : (
            editResponse.edits.map((edit, i) => (
              <EditDiffBlock
                key={i}
                edit={edit}
                fileContent={fileContent}
                index={i}
              />
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0 gap-2">
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-border hover:bg-secondary/80 transition-colors text-muted-foreground"
              >
                <RefreshCw className="size-3" />
                Regenerate
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-border hover:bg-secondary/80 transition-colors text-muted-foreground"
            >
              {copied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-xs rounded-xl border border-border hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            {!isNoChange && editResponse.edits.length > 0 && (
              <button
                onClick={() => onApply(editResponse.edits)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                <Zap className="size-3" />
                Apply{editResponse.edits.length > 1 ? ` ${editResponse.edits.length} edits` : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
