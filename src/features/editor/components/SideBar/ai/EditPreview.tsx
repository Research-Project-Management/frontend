'use client';

/**
 * EditPreview.tsx — Preview-before-Apply Modal for AI Edits
 *
 * Shows a diff view of the AI's proposed edit before applying it.
 * Provides Apply / Cancel / Copy / Regenerate actions.
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { AiPatchEngine, type AiEditResponse, type AiEditOperation } from '@/features/editor/utils/ai.util';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

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
            className={`select-none shrink-0 w-5 text-center text-xs border-r border-border/40 mr-2 ${gutterClass}`}
          >
            {glyph}
          </span>
          <span className={`py-px pr-4 whitespace-pre font-mono text-xs ${textClass}`}>
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
        <span className="font-mono text-xs text-muted-foreground font-medium">
          Change #{index + 1}: {rangeLabel}
        </span>
        {edit.description && (
          <span className="text-xs text-foreground/70 truncate max-w-[280px]">
            {edit.description}
          </span>
        )}
      </div>

      <div className="divide-y divide-border/20 font-mono text-xs">
        {oldText && <DiffRow label="old" text={oldText} color="red" />}
        {edit.text && <DiffRow label="new" text={edit.text} color="green" />}
        {!oldText && !edit.text && (
          <div className="px-3 py-2 text-muted-foreground/40 text-xs">(empty change)</div>
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
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="w-[600px] max-w-[94vw] max-h-[85vh] p-0 flex flex-col overflow-hidden gap-0" showCloseButton={true}>
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border shrink-0 space-y-0">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <DialogTitle className="text-sm font-semibold">
              AI Edit Preview
            </DialogTitle>
            <Badge
              variant={isNoChange ? "secondary" : "default"}
              className="text-xs font-medium capitalize"
            >
              {editResponse.intent.replace(/_/g, ' ')}
            </Badge>
          </div>
        </DialogHeader>

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
            <p className="text-xs text-foreground/80 leading-relaxed">{safetyWarning}</p>
          </div>
        )}

        {/* Diff view */}
        <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[50vh]">
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0 gap-2 bg-card">
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3" />
                <span>Regenerate</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-xs"
            >
              Cancel
            </Button>
            {!isNoChange && editResponse.edits.length > 0 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onApply(editResponse.edits)}
                className="gap-1.5 text-xs font-medium"
              >
                <Zap className="size-3" />
                <span>Apply{editResponse.edits.length > 1 ? ` ${editResponse.edits.length} edits` : ''}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EditPreview;
