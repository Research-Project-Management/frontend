'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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

  // ── State ──────────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<TypeConversionPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [retainUnmapped, setRetainUnmapped] = useState(true);

  const { previewAsync, convertAsync, isConverting } = useItemTypeConversion(scopeId);

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
      <DialogContent className="sm:max-w-[440px] p-5 rounded-lg border border-border bg-background shadow-raised-200 font-sans gap-4">
        <DialogHeader className="text-left pb-2.5 border-b border-border">
          <DialogTitle className="text-14 font-semibold text-foreground">
            Convert Item Type
          </DialogTitle>
          <DialogDescription className="sr-only">
            Convert item type
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-0.5">
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-6 text-12 text-muted-foreground gap-2">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span>Checking field compatibility…</span>
            </div>
          ) : droppedWithValues.length > 0 ? (
            <div className="space-y-2">
              <p className="text-12 text-muted-foreground leading-normal">
                {droppedWithValues.length === 1 ? 'This field is' : 'These fields are'} not supported in{' '}
                <span className="font-medium text-foreground">{targetTypeName}</span>:
              </p>

              <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
                <div className="max-h-[160px] overflow-y-auto divide-y divide-border text-12">
                  {droppedWithValues.map((d, i) => (
                    <div
                      key={d.field + i}
                      className="grid grid-cols-[130px_1fr] gap-2 px-3 py-1.5 items-baseline"
                    >
                      <span className="font-medium text-foreground truncate" title={d.label || d.field}>
                        {d.label || d.field}
                      </span>
                      <span
                        className="text-muted-foreground truncate font-mono text-11"
                        title={formatFieldValue(d.value)}
                      >
                        {formatFieldValue(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {creatorRoleChanges.length > 0 && (
                <p className="text-11 text-muted-foreground pt-0.5">
                  {creatorRoleChanges.length === 1
                    ? '1 contributor role will be adjusted to the target type.'
                    : `${creatorRoleChanges.length} contributor roles will be adjusted to the target type.`}
                </p>
              )}
            </div>
          ) : (
            <p className="text-12 text-muted-foreground py-2">
              All existing fields are supported by <span className="font-medium text-foreground">{targetTypeName}</span>.
            </p>
          )}

          {/* Preserve unmapped checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="retain-extra-fields"
              checked={retainUnmapped}
              onCheckedChange={(checked) => setRetainUnmapped(Boolean(checked))}
            />
            <Label
              htmlFor="retain-extra-fields"
              className="text-12 text-muted-foreground cursor-pointer select-none font-normal"
            >
              Preserve unsupported fields in Extra note
            </Label>
          </div>
        </div>

        {/* Actions Footer */}
        <DialogFooter className="gap-2 pt-3 border-t border-border sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
            className="h-8 px-3 text-12 font-medium rounded-md border border-border bg-background shadow-2xs hover:bg-muted text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isConverting || isLoadingPreview}
            className="h-8 px-3 text-12 font-medium rounded-md bg-primary text-primary-foreground min-w-[75px]"
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
