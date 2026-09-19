'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import type { Item } from '@/features/library/types/library.types';
import { ALL_ITEM_TYPES_FLAT } from '@/features/library/schemas/item-type.schema';
import {
  useItemTypeConversion,
  type TypeConversionPreview,
} from '../../hooks/use-conversion';

export interface ConvertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accept either prop name for backwards compat */
  item?: Item | null;
  paper?: Item | null;
  targetType: string;
  onSuccess?: (updatedItem: Item) => void;
}

export type TypeConversionDialogProps = ConvertModalProps;

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
  const itemType = currentItem?.itemType || (currentItem as unknown as { type?: string })?.type || 'journalArticle';
  const scopeId = currentItem?.projectId || (currentItem as any)?.userId || 'user';
  const itemTitle = currentItem?.title || (currentItem as any)?.name || 'Untitled Item';

  // ── State ──────────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<TypeConversionPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [retainUnmapped, setRetainUnmapped] = useState(true);

  const { previewAsync, convertAsync, isConverting } = useItemTypeConversion(scopeId);

  const currentTypeName = useMemo(() => {
    return ALL_ITEM_TYPES_FLAT.find((t) => t.value === itemType)?.label || itemType;
  }, [itemType]);

  const targetTypeName = useMemo(() => {
    return ALL_ITEM_TYPES_FLAT.find((t) => t.value === targetType)?.label || targetType;
  }, [targetType]);

  // ── Load preview when dialog opens ────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!open || !itemId || !targetType || itemType === targetType) return;
    setIsLoadingPreview(true);
    setPreview(null);
    try {
      const data = await previewAsync({ itemId, targetType, retainUnmappedInExtra: retainUnmapped });
      setPreview(data as TypeConversionPreview);
    } catch {
      // Handled gracefully with fallback
    } finally {
      setIsLoadingPreview(false);
    }
  }, [open, itemId, targetType, itemType, retainUnmapped, previewAsync]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const droppedWithValues = useMemo(() => {
    return (preview?.droppedFields ?? []).filter(
      (d) => d.value !== null && d.value !== undefined && d.value !== '',
    );
  }, [preview?.droppedFields]);

  const creatorRoleChanges = useMemo(() => {
    return (preview?.creatorChanges ?? []).filter((c) => c.fromRole && c.toRole && c.fromRole !== c.toRole);
  }, [preview?.creatorChanges]);

  // ── Confirm handler ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!itemId || !targetType) return;
    try {
      const result = await convertAsync({
        itemId,
        targetType,
        expectedVersion: (currentItem as unknown as { version?: number })?.version,
        retainUnmappedInExtra: retainUnmapped,
      });
      const resAny = result as unknown as { item?: Item; paper?: Item; data?: Item };
      const updatedItem = resAny?.item ?? resAny?.paper ?? resAny?.data ?? (result as unknown as Item);
      onSuccess?.(updatedItem);
      onOpenChange(false);
    } catch {
      // Toast is managed by the hook
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!currentItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] w-full p-5 rounded-lg border border-border bg-background shadow-raised-200 font-sans gap-3 overflow-hidden">
        {/* Header without subtitle */}
        <DialogHeader className="text-left space-y-0.5">
          <DialogTitle className="text-sm font-semibold text-foreground">
            Convert Item Type
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 min-w-0">
          <p className="text-xs text-foreground leading-relaxed break-words">
            Changing <span className="font-medium text-foreground">&ldquo;{itemTitle}&rdquo;</span> to{' '}
            <span className="font-semibold text-foreground">{targetTypeName}</span>:
          </p>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
              <span>Checking metadata fields…</span>
            </div>
          ) : droppedWithValues.length > 0 ? (
            <div className="space-y-2.5 min-w-0">
              <p className="text-xs text-muted-foreground">
                The following {droppedWithValues.length === 1 ? 'field is' : `${droppedWithValues.length} fields are`} not supported and will be removed:
              </p>

              <div className="rounded-md border border-border bg-muted/20 overflow-hidden max-h-[160px] overflow-y-auto">
                <table className="w-full text-xs text-left table-fixed">
                  <tbody className="divide-y divide-border">
                    {droppedWithValues.map((d, i) => (
                      <tr key={d.field + i} className="hover:bg-muted/40">
                        <td className="py-1.5 px-3 font-medium text-foreground whitespace-nowrap align-top w-2/5 truncate" title={d.label || d.field}>
                          {d.label || d.field}
                        </td>
                        <td className="py-1.5 px-3 text-muted-foreground font-mono text-11 break-all align-top w-3/5" title={formatFieldValue(d.value)}>
                          {formatFieldValue(d.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {creatorRoleChanges.length > 0 && (
                <p className="text-11 text-muted-foreground">
                  Note: Contributor roles will be adjusted to {targetTypeName}.
                </p>
              )}

              {/* Preserve unmapped checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="retain-extra-fields"
                  checked={retainUnmapped}
                  onCheckedChange={(checked) => setRetainUnmapped(Boolean(checked))}
                  className="rounded-sm"
                />
                <Label
                  htmlFor="retain-extra-fields"
                  className="text-xs text-foreground cursor-pointer select-none font-normal"
                >
                  Save discarded fields in Extra note
                </Label>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              All metadata fields are supported in <span className="font-medium text-foreground">{targetTypeName}</span>. No data will be lost.
            </p>
          )}
        </div>

        {/* Actions Footer */}
        <DialogFooter className="gap-2 pt-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
            className="h-7 px-3 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground cursor-pointer shadow-none transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isConverting || isLoadingPreview}
            className="h-7 px-3.5 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-none transition-colors"
          >
            {isConverting ? (
              <Loader2 className="size-3 animate-spin shrink-0" />
            ) : (
              'Convert'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConvertModal;
export { ConvertModal as TypeConversionDialog };
