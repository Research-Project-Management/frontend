'use client';

import React, { useState } from 'react';
import { ExternalLink, Loader2, ShieldAlert, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { Item } from '@/features/library/types/library.types';
import { SchemaItemTypeDefinition, ALL_ITEM_TYPES_FLAT } from '../../../types';
import { cleanPaperTitle } from '../../../domain';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import dynamic from 'next/dynamic';
import { InlineTextarea } from './InlineTextarea';

const ConvertModal = dynamic(() => import('../../modals/ConvertModal'), { ssr: false });

export interface GeneralFieldsProps {
  paper: Item;
  currentItemType: string;
  selectableItemTypes: Array<{ value: string; label: string }>;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  scopeId?: string;
  onUpdatePaper?: (data: Partial<Item>) => void;
  previewAsync: (params: {
    itemId: string;
    targetType: string;
    retainUnmappedInExtra?: boolean;
  }) => Promise<any>;
  convertAsync: (params: {
    itemId: string;
    targetType: string;
    expectedVersion?: number;
    retainUnmappedInExtra?: boolean;
    silent?: boolean;
  }) => Promise<any>;
}

function cleanValue(val?: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function GeneralFields({
  paper,
  currentItemType,
  selectableItemTypes,
  typeDefinition,
  canEdit = true,
  scopeId,
  onUpdatePaper,
  previewAsync,
  convertAsync,
}: GeneralFieldsProps) {
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [targetConversionType, setTargetConversionType] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [isCheckingType, setIsCheckingType] = useState(false);

  const effectiveItemTypes =
    selectableItemTypes && selectableItemTypes.length > 0
      ? selectableItemTypes
      : ALL_ITEM_TYPES_FLAT;

  const handleTitleChange = (val: string) => {
    const trimmed = val.replace(/\r?\n+/g, ' ').trim();
    onUpdatePaper?.({ title: trimmed || undefined });
  };

  return (
    <>
      {/* ⚠️ Retraction Warning Alert Banner */}
      {paper.isRetracted && (
        <div className="mb-3 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-xs select-none">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-11 text-destructive">
                {paper.retractionNature === 'expression_of_concern'
                  ? '⚠️ Expression of Concern'
                  : paper.retractionNature === 'correction'
                  ? 'ℹ️ Publisher Correction Notice'
                  : '🚨 Retracted Publication'}
              </div>
              <p className="text-xs text-destructive/90 break-words leading-snug">
                {(paper.retractionDetails?.reason as string | undefined) ||
                  'This publication has been flagged as retracted or unreliable by academic integrity audits.'}
              </p>
              {Boolean(paper.retractionDetails?.noticeUrl) && (
                <a
                  href={String(paper.retractionDetails?.noticeUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 font-medium text-destructive underline hover:text-destructive/80 mt-1"
                >
                  View publisher retraction notice
                  <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Type Selector */}
      <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
        <span
          className="text-muted-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate"
          id="label-item-type"
          title="Item Type"
        >
          Item Type
        </span>
        <div className="flex items-center gap-1.5 min-w-0 w-full">
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full h-7 text-left px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary data-[state=open]:border-primary data-[state=open]:bg-muted text-12 leading-normal font-normal text-foreground bg-transparent cursor-pointer outline-none select-none flex items-center justify-between"
                  aria-label="Item Type"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    {isCheckingType ? (
                      <Loader2 className="size-3 animate-spin text-foreground shrink-0" />
                    ) : null}
                    <span className="truncate whitespace-nowrap">
                      {effectiveItemTypes.find((t) => t.value === currentItemType)?.label ||
                        typeDefinition.label ||
                        currentItemType}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                collisionPadding={8}
                className="max-h-[360px] w-60 min-w-[200px] overflow-y-auto p-1 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5 z-50 thin-scrollbar"
              >
                {effectiveItemTypes.map((t) => {
                  const isSelected = t.value === currentItemType;
                  return (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={async () => {
                        if (t.value === currentItemType || isCheckingType) return;
                        setIsCheckingType(true);
                        try {
                          const prev = await previewAsync({
                            itemId: paper.id,
                            targetType: t.value,
                            retainUnmappedInExtra: true,
                          });
                          setPreviewData(prev);
                          if (!prev?.hasLoss) {
                            // Lossless: convert immediately without dialog and without notification
                            const result = await convertAsync({
                              itemId: paper.id,
                              targetType: t.value,
                              expectedVersion: paper.version,
                              retainUnmappedInExtra: true,
                              silent: true,
                            });
                            const updated =
                              result && typeof result === 'object' && 'item' in result
                                ? (result as { item: Item }).item
                                : (result as Item);
                            onUpdatePaper?.(updated);
                          } else {
                            // Lossy: open modal with preview already loaded
                            setTargetConversionType(t.value);
                            setIsConversionDialogOpen(true);
                          }
                        } catch (err: unknown) {
                          console.error('Type conversion error:', err);
                          // Fallback to direct itemType update so changing type is never blocked
                          try {
                            onUpdatePaper?.({ itemType: t.value });
                          } catch (fallbackErr) {
                            console.error('Fallback type update failed:', fallbackErr);
                          }
                        } finally {
                          setIsCheckingType(false);
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between h-7.5 px-2.5 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted select-none transition-colors',
                        isSelected && 'bg-muted text-foreground font-medium',
                      )}
                    >
                      <span className="truncate pr-2">{t.label}</span>
                      {isSelected && (
                        <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full h-7 text-left px-2 py-1 text-12 leading-normal font-normal text-foreground flex items-center select-text font-sans truncate">
              <span className="truncate whitespace-nowrap">
                {effectiveItemTypes.find((t) => t.value === currentItemType)?.label ||
                  typeDefinition.label ||
                  currentItemType}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="grid grid-cols-[84px_1fr] gap-2 items-start py-0.5">
        <span
          className="text-muted-foreground text-right font-normal select-none pr-1 pt-1 text-12 leading-normal whitespace-nowrap truncate"
          id="label-title"
          title="Title"
        >
          Title
        </span>
        <InlineTextarea
          value={cleanPaperTitle(cleanValue(paper.title))}
          ariaLabel="Item Title"
          onSave={handleTitleChange}
          className="font-normal text-foreground text-12 leading-normal"
          rows={1}
          readOnly={!canEdit}
        />
      </div>

      {/* Item Type Conversion Modal */}
      {isConversionDialogOpen && (
        <ConvertModal
          open={isConversionDialogOpen}
          onOpenChange={setIsConversionDialogOpen}
          paper={paper}
          targetType={targetConversionType}
          scopeId={scopeId}
          initialPreview={previewData}
          onSuccess={(updatedPaper: any) => {
            onUpdatePaper?.(updatedPaper);
          }}
        />
      )}
    </>
  );
}

export default GeneralFields;
