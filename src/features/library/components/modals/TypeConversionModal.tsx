'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Archive,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import type { Item } from '../../types/library.types';
import {
  ALL_ITEM_TYPES_FLAT,
  FIELD_LABELS,
  getItemTypeDefinition,
  humanizeFieldName,
  SchemaFieldDefinition,
} from '../../types';
import {
  useItemTypeConversion,
  type TypeConversionPreview,
} from '../../data';
import { cn } from '@/shared/lib/utils';

export interface TypeConversionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accept either item or paper for flexible caller integration */
  item?: any;
  paper?: any;
  targetType: string;
  scopeId?: string;
  initialPreview?: TypeConversionPreview | null;
  onSuccess?: (updatedItem: any) => void;
}

export type ConvertModalProps = TypeConversionModalProps;
export type TypeConversionDialogProps = TypeConversionModalProps;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function resolveFieldLabel(fieldKey: string): string {
  if (!fieldKey) return '';
  return FIELD_LABELS[fieldKey] || humanizeFieldName(fieldKey);
}

export function TypeConversionModal({
  open,
  onOpenChange,
  item,
  paper,
  targetType,
  scopeId: propScopeId,
  initialPreview,
  onSuccess,
}: TypeConversionModalProps) {
  const currentItem = item || paper;
  const itemId = currentItem?.id || '';
  const sourceType = currentItem?.itemType || 'journalArticle';
  const scopeId = propScopeId || currentItem?.projectId || 'user';
  const itemTitle = currentItem?.title || 'Untitled Item';

  // ── State ──────────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<TypeConversionPreview | null>(initialPreview || null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retainUnmapped, setRetainUnmapped] = useState(true);
  const [mobileTab, setMobileTab] = useState<'retained' | 'extra' | 'new'>('retained');

  const { previewAsync, convertAsync, isConverting } = useItemTypeConversion(scopeId);

  const sourceTypeName = useMemo(() => {
    return ALL_ITEM_TYPES_FLAT.find((t) => t.value === sourceType)?.label || sourceType;
  }, [sourceType]);

  const targetTypeName = useMemo(() => {
    return ALL_ITEM_TYPES_FLAT.find((t) => t.value === targetType)?.label || targetType;
  }, [targetType]);

  // Target schema definition
  const targetTypeDef = useMemo(() => {
    return getItemTypeDefinition(targetType);
  }, [targetType]);

  // ── Preview Loading ────────────────────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!open || !itemId || !targetType || sourceType === targetType) return;
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const data = await previewAsync({
        itemId,
        targetType,
        retainUnmappedInExtra: retainUnmapped,
      });
      setPreview(data as TypeConversionPreview);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to preview type conversion';
      setPreviewError(msg);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [open, itemId, targetType, sourceType, retainUnmapped, previewAsync]);

  useEffect(() => {
    if (initialPreview && initialPreview.targetType === targetType) {
      setPreview(initialPreview);
      return;
    }
    loadPreview();
  }, [loadPreview, initialPreview, targetType]);

  // ── Column 1: Retained / Mapped Calculations ───────────────────────────────
  const mappedFields = useMemo(() => preview?.mappedFields ?? [], [preview?.mappedFields]);

  const preservedFieldDetails = useMemo(() => {
    const list = preview?.preservedFields ?? [];
    const projected = (preview?.projectedItem ?? {}) as Record<string, unknown>;
    const current = (currentItem ?? {}) as unknown as Record<string, unknown>;

    return list.map((fieldKey) => {
      const val = projected[fieldKey] ?? current[fieldKey];
      return {
        key: fieldKey,
        label: resolveFieldLabel(fieldKey),
        value: formatValue(val),
      };
    });
  }, [preview?.preservedFields, preview?.projectedItem, currentItem]);

  const creatorRoleChanges = useMemo(() => {
    return (preview?.creatorChanges ?? []).filter(
      (c) => c.fromRole && c.toRole && c.fromRole !== c.toRole,
    );
  }, [preview?.creatorChanges]);

  const totalRetainedCount = preservedFieldDetails.length + mappedFields.length;

  // ── Column 2: Overflow to Extra Calculations ───────────────────────────────
  const droppedWithValues = useMemo(() => {
    return (preview?.droppedFields ?? []).filter(
      (d) => d.value !== null && d.value !== undefined && d.value !== '',
    );
  }, [preview?.droppedFields]);

  const extraBufferLines = useMemo(() => {
    return droppedWithValues.map((d) => `${d.label || resolveFieldLabel(d.field)}: ${formatValue(d.value)}`);
  }, [droppedWithValues]);

  // ── Column 3: New Available Fields Calculations ────────────────────────────
  const newAvailableFields = useMemo(() => {
    if (!targetTypeDef?.fields) return [];
    const preservedSet = new Set((preview?.preservedFields ?? []).map((f) => f.toLowerCase()));
    const mappedTargetSet = new Set(mappedFields.map((m) => m.toField.toLowerCase()));
    const persistentIgnore = new Set([
      'title',
      'abstract',
      'abstractnote',
      'extra',
      'dateadded',
      'datemodified',
    ]);

    const projected = (preview?.projectedItem ?? {}) as Record<string, unknown>;

    return targetTypeDef.fields.filter((f: SchemaFieldDefinition) => {
      const lower = f.field.toLowerCase();
      if (persistentIgnore.has(lower)) return false;
      if (preservedSet.has(lower)) return false;
      if (mappedTargetSet.has(lower)) return false;
      const existingVal = projected[f.field];
      if (existingVal !== undefined && existingVal !== null && existingVal !== '') return false;
      return true;
    });
  }, [targetTypeDef, preview?.preservedFields, mappedFields, preview?.projectedItem]);

  // ── Confirm Handler ────────────────────────────────────────────────────────
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
      // Toast notification is managed by hook
    }
  };

  if (!currentItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[880px] w-[95vw] max-h-[88vh] p-5 rounded-xl border border-border bg-background shadow-raised-300 font-sans flex flex-col gap-4 overflow-hidden">
        {/* Header with Transformation badges */}
        <DialogHeader className="text-left space-y-1.5 shrink-0 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Convert Item Type
              </DialogTitle>
              <Badge variant="outline" className="text-11 font-mono px-1.5 py-0 border-border text-muted-foreground bg-muted/40">
                Zotero v42 Schema
              </Badge>
            </div>
            {/* Transformation Path */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-foreground px-2 py-0.5 rounded bg-muted">
                {sourceTypeName}
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {targetTypeName}
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground truncate" title={itemTitle}>
            Reviewing bibliographic schema transformation for <span className="font-medium text-foreground">&ldquo;{itemTitle}&rdquo;</span>
          </DialogDescription>
        </DialogHeader>

        {/* Mobile View Tab Switcher (Visible only below md breakpoint) */}
        <div className="flex md:hidden items-center rounded-lg bg-muted p-1 gap-1 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('retained')}
            className={cn(
              'flex-1 py-1 px-2 rounded-md font-medium transition-colors text-center cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden',
              mobileTab === 'retained' ? 'bg-background text-foreground shadow-sm' : 'text-foreground',
            )}
          >
            Retained ({totalRetainedCount})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('extra')}
            className={cn(
              'flex-1 py-1 px-2 rounded-md font-medium transition-colors text-center cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden',
              mobileTab === 'extra' ? 'bg-background text-foreground shadow-sm' : 'text-foreground',
            )}
          >
            Extra ({droppedWithValues.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('new')}
            className={cn(
              'flex-1 py-1 px-2 rounded-md font-medium transition-colors text-center cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden',
              mobileTab === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-foreground',
            )}
          >
            New Fields ({newAvailableFields.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 thin-scrollbar">
          {isLoadingPreview ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="size-6 animate-spin text-primary shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Computing Schema Compatibility</p>
                <p className="text-xs text-foreground">
                  Resolving semantic base mappings, extra buffer fields, and contributor roles…
                </p>
              </div>
            </div>
          ) : previewError ? (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <p className="text-sm font-medium">Failed to compute conversion preview</p>
              </div>
              <p className="text-xs opacity-90">{previewError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreview}
                className="h-7 text-xs gap-1.5"
              >
                <RefreshCw className="size-3" /> Retry
              </Button>
            </div>
          ) : (
            /* 3-Column Breakdown Layout */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
              {/* ── COLUMN 1: Retained & Mapped Fields ─────────────────────── */}
              <div
                className={cn(
                  'rounded-lg border border-border bg-card/60 p-3.5 space-y-3 flex flex-col',
                  mobileTab !== 'retained' && 'hidden md:flex',
                )}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    <span className="text-xs font-semibold text-foreground">Retained & Mapped</span>
                  </div>
                  <Badge variant="secondary" className="text-11 h-5 px-1.5 font-normal">
                    {totalRetainedCount} {totalRetainedCount === 1 ? 'field' : 'fields'}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Semantic Mappings */}
                  {mappedFields.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-11 font-medium text-foreground tracking-normal block">
                        Mapped Base Fields
                      </span>
                      {mappedFields.map((m, idx) => (
                        <div
                          key={`map-${m.fromField}-${idx}`}
                          className="p-2 rounded-md bg-success/10 border border-success/20 space-y-1"
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-success">
                              {resolveFieldLabel(m.fromField)}
                            </span>
                            <ArrowRight className="size-3 text-success shrink-0" />
                            <span className="text-success">
                              {resolveFieldLabel(m.toField)}
                            </span>
                          </div>
                          <p className="text-11 text-foreground truncate" title={formatValue(m.value)}>
                            &ldquo;{formatValue(m.value)}&rdquo;
                          </p>
                          <Badge variant="outline" className="text-10 h-4 px-1 py-0 text-success border-success/30">
                            {m.rule === 'base-semantic' ? 'BaseField Mapping' : 'Special rule'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Creator Role Adjustments */}
                  {creatorRoleChanges.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-11 font-medium text-foreground tracking-normal block">
                        Contributor Roles
                      </span>
                      {creatorRoleChanges.map((c, idx) => (
                        <div
                          key={`creator-${idx}`}
                          className="p-2 rounded-md bg-muted/60 border border-border/60 text-11 space-y-0.5"
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span className="capitalize text-foreground">{c.fromRole}</span>
                            <ArrowRight className="size-3 text-foreground shrink-0" />
                            <span className="capitalize text-foreground font-semibold">{c.toRole}</span>
                          </div>
                          <p className="text-foreground text-10">
                            {c.reason === 'primary-fallback' ? 'Primary role adaptation' : 'Role preserved in schema'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preserved Fields */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-11 font-medium text-foreground tracking-normal block">
                      Preserved Attributes
                    </span>
                    <div className="max-h-[220px] overflow-y-auto space-y-1 thin-scrollbar pr-1">
                      {preservedFieldDetails.length > 0 ? (
                        preservedFieldDetails.map((f) => (
                          <div
                            key={f.key}
                            className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
                          >
                            <span className="font-medium text-foreground truncate pr-2" title={f.label}>
                              {f.label}
                            </span>
                            <span className="text-foreground text-11 font-mono truncate max-w-[130px]" title={f.value}>
                              {f.value || '—'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-foreground italic text-center py-2">
                          No direct fields
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── COLUMN 2: Overflow to Extra ────────────────────────────── */}
              <div
                className={cn(
                  'rounded-lg border border-border bg-card/60 p-3.5 space-y-3 flex flex-col',
                  mobileTab !== 'extra' && 'hidden md:flex',
                )}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Archive className="size-4 text-warning shrink-0" />
                    <span className="text-xs font-semibold text-foreground">Overflow to Extra</span>
                  </div>
                  <Badge
                    variant={droppedWithValues.length > 0 ? 'secondary' : 'outline'}
                    className={cn(
                      'text-11 h-5 px-1.5 font-normal',
                      droppedWithValues.length > 0
                        ? 'text-warning bg-warning/10 border-warning/30'
                        : 'text-foreground',
                    )}
                  >
                    {droppedWithValues.length} {droppedWithValues.length === 1 ? 'field' : 'fields'}
                  </Badge>
                </div>

                <div className="space-y-3 text-xs flex-1 flex flex-col">
                  {droppedWithValues.length > 0 ? (
                    <>
                      <p className="text-foreground leading-relaxed text-11">
                        Fields not present in <span className="font-medium text-foreground">{targetTypeName}</span> schema.
                      </p>

                      {/* Discarded Fields Table */}
                      <div className="rounded-md border border-border/80 bg-muted/40 max-h-[140px] overflow-y-auto thin-scrollbar">
                        <table className="w-full text-left table-fixed">
                          <tbody className="divide-y divide-border/60">
                            {droppedWithValues.map((d, idx) => (
                              <tr key={`dropped-${d.field}-${idx}`} className="hover:bg-muted/60">
                                <td className="py-1 px-2.5 font-medium text-foreground w-1/2 truncate" title={d.label || d.field}>
                                  {d.label || resolveFieldLabel(d.field)}
                                </td>
                                <td className="py-1 px-2.5 text-foreground font-mono text-11 w-1/2 truncate" title={formatValue(d.value)}>
                                  {formatValue(d.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Retain in Extra Checkbox */}
                      <div className="space-y-2 pt-1 border-t border-border/40">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="modal-retain-extra"
                            checked={retainUnmapped}
                            onCheckedChange={(checked) => setRetainUnmapped(Boolean(checked))}
                            className="size-4 mt-0.5 border-border data-[state=checked]:border-primary"
                          />
                          <div className="space-y-0.5 select-none">
                            <Label
                              htmlFor="modal-retain-extra"
                              className="text-xs font-medium text-foreground cursor-pointer"
                            >
                              Safely buffer in Extra note
                            </Label>
                            <p className="text-10 text-foreground leading-normal">
                              Appends <code className="font-mono text-10">Key: Value</code> lines into Extra, compliant with Zotero and Citeproc CSL.
                            </p>
                          </div>
                        </div>

                        {/* Monospace Extra preview */}
                        {retainUnmapped ? (
                          <div className="p-2 rounded-md bg-muted font-mono text-11 text-foreground/90 border border-border space-y-0.5 max-h-[120px] overflow-y-auto thin-scrollbar">
                            <span className="text-10 font-sans font-medium text-foreground block mb-1">
                              Will append to Extra:
                            </span>
                            {extraBufferLines.map((line, idx) => (
                              <div key={`extra-line-${idx}`} className="truncate" title={line}>
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-11 flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>Unmapped fields will be permanently discarded.</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-2 text-foreground">
                      <ShieldCheck className="size-8 text-success stroke-[1.5]" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">Zero Schema Loss</p>
                        <p className="text-11 text-foreground">
                          All fields fit directly or mapped into {targetTypeName}. No values will overflow to Extra.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── COLUMN 3: New Available Fields ─────────────────────────── */}
              <div
                className={cn(
                  'rounded-lg border border-border bg-card/60 p-3.5 space-y-3 flex flex-col',
                  mobileTab !== 'new' && 'hidden md:flex',
                )}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <PlusCircle className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground">New Available Fields</span>
                  </div>
                  <Badge variant="outline" className="text-11 h-5 px-1.5 font-normal text-primary border-primary/30">
                    {newAvailableFields.length} {newAvailableFields.length === 1 ? 'field' : 'fields'}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs flex-1 flex flex-col">
                  <p className="text-foreground leading-relaxed text-11">
                    Fields unlocked by <span className="font-medium text-foreground">{targetTypeName}</span> schema ready for curation:
                  </p>

                  <div className="flex-1 max-h-[280px] overflow-y-auto space-y-1 thin-scrollbar pr-1">
                    {newAvailableFields.length > 0 ? (
                      newAvailableFields.map((f: SchemaFieldDefinition) => (
                        <div
                          key={`new-${f.field}`}
                          className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors"
                        >
                          <span className="font-medium text-foreground truncate pr-2" title={f.label}>
                            {f.label}
                          </span>
                          <span className="text-10 font-mono text-foreground px-1 py-0.5 rounded bg-background border border-border/50">
                            {f.category || f.type}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-1 text-foreground">
                        <CheckCircle2 className="size-6 text-foreground/60 stroke-1" />
                        <p className="text-xs">No additional fields in target schema</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2 pt-2 border-t border-border/60 shrink-0 sm:justify-between items-center">
          <div className="text-11 text-muted-foreground hidden sm:flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-success" />
            <span>Lossless conversion with optimistic locking</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isConverting}
              className="h-8 px-3 text-13 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={isConverting || isLoadingPreview || Boolean(previewError)}
              className="h-8 px-4 text-13 font-medium gap-1.5"
            >
              {isConverting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Converting…</span>
                </>
              ) : (
                <span>Convert to {targetTypeName}</span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TypeConversionModal;
