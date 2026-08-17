'use client';

/**
 * EditPreview.tsx — Preview-before-Apply Modal for AI Edits
 *
 * Shows a diff view of the AI's proposed edit before applying it.
 * Provides Apply / Cancel / Copy / Regenerate actions.
 */

import React, { useMemo, useState } from 'react';
import { X, Check, Copy, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { AiPatchEngine, type AiEditResponse, type AiEditOperation } from '@/features/editor/utils/ai.util';

function DiffRow({ label, text, color }: { label: string; text: string; color: 'red' | 'green' }) {
  const lines = text.split('\n');
  const bgClass = color === 'red' ? 'bg-red-500/10' : 'bg-emerald-500/10';
  const textClass =
    color === 'red'
      ? 'text-red-600 line-through opacity-75 dark:text-red-300'
      : 'text-emerald-700 dark:text-emerald-200';
  const gutterClass = color === 'red' ? 'text-red-500' : 'text-emerald-500';
  const glyph = color === 'red' ? '-' : '+';

  return (
    <>
      {lines.map((line, i) => (
        <div key={`${label}-${i}`} className={`flex px-0 ${bgClass}`}>
          <span
            className={`select-none shrink-0 w-5 text-center text-[10px] border-r border-border/40 mr-2 ${gutterClass}`}
          >
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

function EditDiffBlock({
  edit,
  fileContent,
  index,
}: {
  edit: AiEditOperation;
  fileContent: string;
  index: number;
}) {
  const oldText = useMemo(
    () => AiPatchEngine.extractOldText(fileContent, edit),
    [edit, fileContent],
  );

  const rangeLabel =
    edit.startLineNumber === edit.endLineNumber
      ? `Line ${edit.startLineNumber}`
      : `Lines ${edit.startLineNumber}–${edit.endLineNumber}`;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden mb-3 text-xs bg-background shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 border-b border-border/40">
        <span className="font-mono text-[11px] text-muted-foreground font-medium">
          Change #{index + 1}: {rangeLabel}
        </span>
        {edit.description && (
          <span className="text-[11px] text-foreground/70 truncate max-w-[280px]">
            {edit.description}
          </span>
        )}
      </div>

      <div className="divide-y divide-border/20 font-mono text-[11px]">
        {oldText && <DiffRow label="old" text={oldText} color="red" />}
        {edit.text && <DiffRow label="new" text={edit.text} color="green" />}
        {!oldText && !edit.text && (
          <div className="px-3 py-2 text-muted-foreground/40 text-[10px]">(empty change)</div>
        )}
      </div>
    </div>
  );
}

export interface EditPreviewProps {
  editResponse: AiEditResponse;
  fileContent: string;
  onApply: (edits: AiEditOperation[]) => void;
  onCancel: () => void;
  onRegenerate?: () => void;
  safetyWarning?: string;
}

export function EditPreview({
  editResponse,
  fileContent,
  onApply,
  onCancel,
  onRegenerate,
  safetyWarning,
}: EditPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = editResponse.edits.map((e: AiEditOperation) => e.text).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNoChange = editResponse.intent === 'no_change';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-edit-preview-title"
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
    >
      <div className="bg-background border border-border rounded-lg shadow-2xl w-[600px] max-w-[94vw] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <span id="ai-edit-preview-title" className="text-sm font-semibold">
              AI Edit Preview
            </span>
            <span
              className={[
                'text-[9px] font-semibold px-1.5 py-px rounded-full border',
                isNoChange
                  ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  : 'bg-primary/10 text-primary border-primary/20',
              ].join(' ')}
            >
              {editResponse.intent.replace(/_/g, ' ')}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close AI preview"
            className="p-1 rounded-lg hover:bg-secondary/80 transition-colors outline-none"
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
          <div className="flex items-start gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
            <AlertTriangle className="size-3.5 text-primary shrink-0 mt-px" />
            <p className="text-[11px] text-foreground/80 leading-relaxed">{safetyWarning}</p>
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
              <AlertTriangle className="size-8 text-muted-foreground/50" />
              <p className="text-sm">No edit operations returned.</p>
            </div>
          ) : (
            editResponse.edits.map((edit: AiEditOperation, i: number) => (
              <EditDiffBlock key={i} edit={edit} fileContent={fileContent} index={i} />
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0 gap-2">
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary/80 transition-colors text-muted-foreground outline-none"
              >
                <RefreshCw className="size-3" />
                Regenerate
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary/80 transition-colors text-muted-foreground outline-none"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-xs rounded-lg border border-border hover:bg-secondary/80 transition-colors outline-none"
            >
              Cancel
            </button>
            {!isNoChange && editResponse.edits.length > 0 && (
              <button
                type="button"
                onClick={() => onApply(editResponse.edits)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium outline-none"
              >
                <Zap className="size-3" />
                Apply{editResponse.edits.length > 1 ? ` ${editResponse.edits.length} edits` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditPreview;
