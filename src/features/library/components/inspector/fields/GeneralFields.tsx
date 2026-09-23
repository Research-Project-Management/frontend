'use client';

import React, { useState } from 'react';
import { ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { Item } from '@/features/library/types/library.types';
import { SchemaItemTypeDefinition } from '../../../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import dynamic from 'next/dynamic';
import { InlineTextarea } from './InlineTextarea';

const ConvertModal = dynamic(() => import('../../modals/ConvertModal'), { ssr: false });

export interface GeneralFieldsProps {
  paper: Item;
  currentItemType: string;
  selectableItemTypes: Array<{ value: string; label: string }>;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
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
  onUpdatePaper,
  previewAsync,
  convertAsync,
}: GeneralFieldsProps) {
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [targetConversionType, setTargetConversionType] = useState<string>('');
  const [isCheckingType, setIsCheckingType] = useState(false);

  const handleTitleChange = (val: string) => {
    onUpdatePaper?.({ title: val || undefined });
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
                {((paper.retractionDetails as any)?.reason) ||
                  'This publication has been flagged as retracted or unreliable by academic integrity audits.'}
              </p>
              {((paper.retractionDetails as any)?.noticeUrl) && (
                <a
                  href={(paper.retractionDetails as any).noticeUrl}
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
      <div className="grid grid-cols-[76px_1fr] gap-1.5 items-center py-0.5">
        <span
          className="text-muted-foreground text-right font-normal select-none pr-1.5 text-12 leading-tight break-words"
          id="label-item-type"
        >
          Item Type
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full min-h-7 h-auto text-left px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary data-[state=open]:border-primary data-[state=open]:bg-muted text-12 leading-normal font-normal text-foreground bg-transparent cursor-pointer outline-none select-none flex items-center justify-between"
                  aria-label="Item Type"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isCheckingType ? (
                      <Loader2 className="size-3 animate-spin text-foreground shrink-0" />
                    ) : null}
                    <span className="break-words leading-snug">
                      {selectableItemTypes.find((t) => t.value === currentItemType)?.label ||
                        typeDefinition.label ||
                        currentItemType}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-[420px] min-w-[250px] overflow-y-auto p-1.5 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5"
              >
                {selectableItemTypes.map((t) => {
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
                          if (!prev.hasLoss) {
                            // Lossless: convert immediately without dialog and without notification
                            const result = await convertAsync({
                              itemId: paper.id,
                              targetType: t.value,
                              expectedVersion: (paper as any).version,
                              retainUnmappedInExtra: true,
                              silent: true,
                            });
                            const updated =
                              (result as any)?.item ?? (result as any)?.data ?? result;
                            onUpdatePaper?.(updated);
                          } else {
                            // Lossy: open modal with preview already loaded
                            setTargetConversionType(t.value);
                            setIsConversionDialogOpen(true);
                          }
                        } catch {
                          // Errors are already surfaced by useConversion hook via toast
                        } finally {
                          setIsCheckingType(false);
                        }
                      }}
                      className={cn(
                        'flex items-center gap-2.5 h-7 px-2.5 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted',
                        isSelected && 'bg-muted text-foreground font-medium',
                      )}
                    >
                      <span className="w-2.5 text-center text-xs font-normal text-foreground shrink-0 select-none">
                        {isSelected ? '•' : ''}
                      </span>
                      <span className="break-words leading-snug text-foreground">{t.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full min-h-7 h-auto text-left px-2 py-1 text-12 leading-normal font-normal text-foreground flex items-center select-text font-sans">
              <span className="break-words leading-snug">
                {selectableItemTypes.find((t) => t.value === currentItemType)?.label ||
                  typeDefinition.label ||
                  currentItemType}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="grid grid-cols-[76px_1fr] gap-1.5 items-start py-0.5">
        <span
          className="text-muted-foreground text-right font-normal select-none pr-1.5 pt-1 text-12 leading-normal whitespace-nowrap"
          id="label-title"
        >
          Title
        </span>
        <InlineTextarea
          value={cleanValue(paper.title)}
          ariaLabel="Item Title"
          onSave={handleTitleChange}
          className="font-normal text-foreground text-12 leading-normal"
          rows={1}
          readOnly={!canEdit}
        />
      </div>

      {/* Item Type Conversion Modal */}
      <ConvertModal
        open={isConversionDialogOpen}
        onOpenChange={setIsConversionDialogOpen}
        paper={paper}
        targetType={targetConversionType}
        onSuccess={(updatedPaper: any) => {
          onUpdatePaper?.(updatedPaper);
        }}
      />
    </>
  );
}

export default GeneralFields;
