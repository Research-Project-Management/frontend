'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeftRight,
} from 'lucide-react';
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
import type { Item } from '@/features/workspaces/library/types/library.types';
import { ALL_ITEM_TYPES_FLAT } from '@/features/workspaces/library/schemas/item-type.schema';
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
  const workspaceId = currentItem?.workspaceId || '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<TypeConversionPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [retainUnmapped, setRetainUnmapped] = useState(true);

  const { previewAsync, convertAsync, isConverting } = useItemTypeConversion(workspaceId);

  const sourceTypeName =
    ALL_ITEM_TYPES_FLAT.find((t) => t.value === itemType)?.label || itemType || 'Journal Article';
  const targetTypeName =
    ALL_ITEM_TYPES_FLAT.find((t) => t.value === targetType)?.label || targetType;

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
  const hasLoss = preview?.hasLoss ?? false;
  const droppedWithValues = (preview?.droppedFields ?? []).filter(
    (d) => d.value !== null && d.value !== undefined && d.value !== '',
  );

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
      <DialogContent className="sm:max-w-[440px] p-6 font-sans gap-5">
        <DialogHeader className="gap-1.5 text-left">
          <div className="flex items-center gap-2 text-primary">
            <ArrowLeftRight className="size-4.5 shrink-0" />
            <DialogTitle className="text-base font-semibold text-foreground">
              Convert Item Type
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Change the bibliographic classification for this reference.
          </DialogDescription>
        </DialogHeader>

        {/* Type Transition Card */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 text-xs">
          <div className="space-y-0.5 min-w-0">
            <span className="text-11 font-medium text-muted-foreground block">
              Current
            </span>
            <p className="font-semibold text-foreground truncate">{sourceTypeName}</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground shrink-0 mx-3" />
          <div className="space-y-0.5 text-right min-w-0">
            <span className="text-11 font-medium text-muted-foreground block">
              Target
            </span>
            <p className="font-semibold text-primary truncate">{targetTypeName}</p>
          </div>
        </div>

        {/* Item Title Summary */}
        <div className="px-1 text-xs">
          <p className="text-11 text-muted-foreground line-clamp-1">
            Reference:{' '}
            <strong className="text-foreground font-medium">
              {currentItem.title || 'Untitled Reference'}
            </strong>
          </p>
        </div>

        {/* Field Compatibility Status */}
        <div className="space-y-3">
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Checking field compatibility…</span>
            </div>
          ) : hasLoss && droppedWithValues.length > 0 ? (
            <div className="space-y-2.5 p-3.5 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-xs">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-medium">
                <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Unmapped fields preserved in Extra</span>
              </div>
              <p className="text-11 text-amber-800/90 dark:text-amber-300/80 leading-normal">
                These fields do not exist on <strong>{targetTypeName}</strong> and will be saved in Extra notes to prevent data loss:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {droppedWithValues.map((d, i) => (
                  <span
                    key={d.field + i}
                    className="px-2 py-0.5 rounded-sm text-11 font-mono bg-amber-100/90 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800/60"
                  >
                    {d.label || d.field}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>All existing fields are fully compatible with this type.</span>
            </div>
          )}

          {/* Preserve unmapped checkbox */}
          <div className="flex items-center gap-2 px-1 pt-1">
            <Checkbox
              id="retain-extra-fields"
              checked={retainUnmapped}
              onCheckedChange={(checked) => setRetainUnmapped(Boolean(checked))}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label
              htmlFor="retain-extra-fields"
              className="text-xs text-muted-foreground font-normal cursor-pointer select-none"
            >
              Preserve unmapped values in Extra notes
            </Label>
          </div>
        </div>

        {/* Actions Footer */}
        <DialogFooter className="gap-2 pt-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isConverting || isLoadingPreview}
            className="h-8 text-xs gap-1.5 min-w-[100px]"
          >
            {isConverting && <Loader2 className="size-3 animate-spin shrink-0" />}
            <span>Convert Type</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConvertModal;
export { ConvertModal as TypeConversionDialog };
