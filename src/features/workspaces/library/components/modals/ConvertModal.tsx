'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';
import { ALL_ITEM_TYPES_FLAT } from '@/features/workspaces/library/schemas/item-type.schema';
import {
  useItemTypeConversion,
  type TypeConversionPreview,
} from '../../hooks/library/use-conversion';

export interface ConvertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accept either prop name for backwards compat */
  item?: CatalogItem;
  paper?: CatalogItem;
  targetType: string;
  onSuccess?: (updatedItem: CatalogItem) => void;
}

/** Format a raw value for compact display inside the warning list */
function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'string') return val.length > 60 ? `${val.slice(0, 60)}…` : val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.length} item${val.length !== 1 ? 's' : ''}]`;
  return JSON.stringify(val).slice(0, 60);
}

export type TypeConversionDialogProps = ConvertModalProps;

export function ConvertModal({
  open,
  onOpenChange,
  item,
  paper,
  targetType,
  onSuccess,
}: ConvertModalProps) {
  const currentItem = item || paper;
  const itemId = currentItem?.id || '';
  const itemType = currentItem?.itemType || (currentItem as any)?.type || 'journalArticle';
  const workspaceId = currentItem?.workspaceId || '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<TypeConversionPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retainUnmapped, setRetainUnmapped] = useState(true);
  /** Lossy-path: user must tick before confirm is enabled */
  const [acknowledgedLoss, setAcknowledgedLoss] = useState(false);

  const { previewAsync, convertAsync, isConverting } = useItemTypeConversion(workspaceId);

  const sourceTypeName =
    ALL_ITEM_TYPES_FLAT.find((t) => t.value === itemType)?.label || itemType || 'Journal Article';
  const targetTypeName =
    ALL_ITEM_TYPES_FLAT.find((t) => t.value === targetType)?.label || targetType;

  // ── Load preview when dialog opens ────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!open || !itemId || !targetType || itemType === targetType) return;
    setIsLoadingPreview(true);
    setPreviewError(null);
    setPreview(null);
    setAcknowledgedLoss(false);
    try {
      const data = await previewAsync({ itemId, targetType, retainUnmappedInExtra: retainUnmapped });
      setPreview(data);
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to analyze field compatibility');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [open, itemId, targetType, itemType, retainUnmapped, previewAsync]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Reset ack when preview reloads
  useEffect(() => {
    setAcknowledgedLoss(false);
  }, [preview]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasLoss = preview?.hasLoss ?? false;
  const droppedWithValues = (preview?.droppedFields ?? []).filter(
    (d) => d.value !== null && d.value !== undefined && d.value !== '',
  );
  const creatorRoleChanges = (preview?.creatorChanges ?? []).filter(
    (c) => c.reason !== 'preserved',
  );

  const confirmDisabled =
    isConverting ||
    isLoadingPreview ||
    !preview ||
    !!previewError ||
    (hasLoss && !acknowledgedLoss);

  // ── Confirm handler ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!itemId || !targetType || !preview) return;
    try {
      const result = await convertAsync({
        itemId,
        targetType,
        expectedVersion: (currentItem as any)?.version,
        retainUnmappedInExtra: retainUnmapped,
      });
      const updatedItem = (result as any)?.item ?? (result as any)?.data ?? result;
      onSuccess?.(updatedItem);
      onOpenChange(false);
    } catch {
      // Toast is managed by the hook
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[88vh] flex flex-col p-6 gap-4 bg-background border border-border/60 rounded-md shadow-none">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-sm font-semibold tracking-tight">
            Change Item Type
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {hasLoss
              ? 'Some fields will no longer appear in the standard form after conversion.'
              : 'All metadata will be preserved during this conversion.'}
          </DialogDescription>
        </DialogHeader>

        {/* Type transition header */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-muted/40 border border-border/50 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
              Current type
            </span>
            <span className="font-medium text-foreground">{sourceTypeName}</span>
          </div>
          <ArrowRight className="size-3.5 text-muted-foreground shrink-0 mx-3" />
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
              New type
            </span>
            <span className="font-semibold text-foreground">{targetTypeName}</span>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[100px] max-h-[320px] pr-0.5 text-xs">
          {isLoadingPreview ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin text-foreground" />
              <span className="text-xs">Analyzing field compatibility…</span>
            </div>
          ) : previewError ? (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-xs">Preview error</p>
                <p className="text-[11px] opacity-90 mt-0.5">{previewError}</p>
              </div>
            </div>
          ) : preview ? (
            <>
              {/* ── LOSSY PATH: field-loss warning ─────────────────────── */}
              {droppedWithValues.length > 0 && (
                <div className="rounded-md border border-amber-200/70 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200/50 dark:border-amber-800/30">
                    <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {droppedWithValues.length} field{droppedWithValues.length !== 1 ? 's' : ''} will leave the standard form
                    </span>
                  </div>
                  <div className="divide-y divide-amber-100/80 dark:divide-amber-900/40">
                    {droppedWithValues.map((d, i) => (
                      <div key={d.field + i} className="flex items-start gap-2.5 px-3 py-1.5">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                            {d.label || d.field}
                          </p>
                          <p className="text-[10px] font-mono text-amber-700/80 dark:text-amber-400/80 truncate">
                            {formatValue(d.value)}
                          </p>
                        </div>
                        <span className="text-[9px] text-amber-600/70 dark:text-amber-500/60 shrink-0 mt-0.5 font-mono">
                          → extraFields
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-amber-50/80 dark:bg-amber-950/20 border-t border-amber-200/50 dark:border-amber-800/30">
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                      These values are <strong>not deleted</strong> — they are safely moved to{' '}
                      <code className="px-1 bg-amber-100 dark:bg-amber-900/40 rounded-sm">extraFields</code>{' '}
                      and can be recovered by reverting the type.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Creator role adjustments ───────────────────────────── */}
              {creatorRoleChanges.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-foreground font-medium text-[11px]">
                    <Info className="size-3.5" />
                    <span>Creator role adjustments</span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 divide-y divide-border/40">
                    {creatorRoleChanges.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="text-muted-foreground truncate max-w-[160px]">
                          {(c.creator as any)?.name || (c.creator as any)?.fullName || 'Creator'}
                        </span>
                        <span className="flex items-center gap-1 font-mono shrink-0 ml-2">
                          <span className="text-muted-foreground">{c.fromRole}</span>
                          <ArrowRight className="size-2.5 text-muted-foreground" />
                          <span className="text-foreground font-medium">{c.toRole}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Base-semantic field remaps ─────────────────────────── */}
              {preview.mappedFields?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-foreground font-medium text-[11px]">
                    <Info className="size-3.5" />
                    <span>Field label remaps (base semantics)</span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 divide-y divide-border/40">
                    {preview.mappedFields.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-mono"
                      >
                        <span className="text-muted-foreground">{m.fromField}</span>
                        <span className="flex items-center gap-1 shrink-0 ml-2">
                          <ArrowRight className="size-2.5 text-muted-foreground" />
                          <span className="text-foreground font-medium">{m.toField}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Lossless confirmation ──────────────────────────────── */}
              {!hasLoss && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-muted/30 border border-border/50">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span className="text-[11px] text-foreground">
                    All {preview.preservedFields.length} field{preview.preservedFields.length !== 1 ? 's' : ''} preserved identically — no data loss.
                  </span>
                </div>
              )}

              {/* Preserve-in-extra note (lossless path) */}
              {hasLoss && droppedWithValues.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/20 border border-border/40">
                  <ShieldCheck className="size-3.5 text-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground">
                    Only creator roles adjusted — no field values lost.
                  </span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── Retain-unmapped option ─────────────────────────────────────────── */}
        <div className={cn('flex items-start gap-2 pt-3 border-t border-border/40', !hasLoss && 'opacity-60')}>
          <Checkbox
            id="retain-unmapped"
            checked={retainUnmapped}
            onCheckedChange={(v) => setRetainUnmapped(Boolean(v))}
            className="mt-0.5 size-3.5 rounded-md border-border cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <label htmlFor="retain-unmapped" className="text-xs text-foreground cursor-pointer leading-snug select-none">
            <span className="font-medium">Keep unmapped values in extraFields</span>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
              Ensures no metadata is permanently lost — values can be recovered by reverting the type.
            </p>
          </label>
        </div>

        {/* ── Lossy acknowledgement checkbox ────────────────────────────────── */}
        {hasLoss && droppedWithValues.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
            <Checkbox
              id="ack-loss"
              checked={acknowledgedLoss}
              onCheckedChange={(v) => setAcknowledgedLoss(Boolean(v))}
              className="mt-0.5 size-3.5 rounded-md border-amber-400 dark:border-amber-600 cursor-pointer data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <label htmlFor="ack-loss" className="text-xs text-amber-900 dark:text-amber-200 cursor-pointer leading-snug select-none">
              I understand that{' '}
              <strong>
                {droppedWithValues.length} field{droppedWithValues.length !== 1 ? 's' : ''}
              </strong>{' '}
              will no longer appear in the standard {targetTypeName} form.
            </label>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
            className="h-8 text-xs rounded-md"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={hasLoss ? 'destructive' : 'default'}
            size="sm"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={cn(
              'h-8 text-xs gap-1.5 rounded-md',
              hasLoss && 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700',
            )}
          >
            {isConverting && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {hasLoss ? `Convert anyway` : `Convert to ${targetTypeName}`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConvertModal;
export { ConvertModal as TypeConversionDialog };
