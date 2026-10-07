'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { Item, SchemaItemTypeDefinition } from '../../../types/reader.types';
import { ALL_ITEM_TYPES_FLAT, cleanPaperTitle } from '../../../utils/reader.util';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import dynamic from 'next/dynamic';
import { InlineTextarea } from './InlineTextarea';

const TypeConversionModal = dynamic(
  () => import('@/features/library/components/modals/TypeConversionModal').then((m) => m.TypeConversionModal),
  { ssr: false },
);

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
  const [previewData, setPreviewData] = useState<any>(null);

  const effectiveItemTypes =
    selectableItemTypes && selectableItemTypes.length > 0
      ? selectableItemTypes
      : ALL_ITEM_TYPES_FLAT;

  const handleTitleChange = (val: string) => {
    const cleaned = cleanPaperTitle(val);
    onUpdatePaper?.({ title: cleaned || val || undefined });
  };

  return (
    <>

      {/* Item Type Selector */}
      <div className="grid grid-cols-[80px_1fr] gap-1.5 items-center py-0.5 w-full min-w-0">
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
                  className="w-full h-7 text-left px-1.5 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary data-[state=open]:border-primary data-[state=open]:bg-muted text-12 leading-normal font-normal text-foreground bg-transparent cursor-pointer outline-none select-none flex items-center justify-between"
                  aria-label="Item Type"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
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
                      onClick={() => {
                        if (t.value === currentItemType) return;
                        setTargetConversionType(t.value);
                        setPreviewData(null);
                        setIsConversionDialogOpen(true);
                      }}
                      className={cn(
                        'flex items-center justify-between h-7.5 px-2.5 text-12 font-normal rounded-md cursor-pointer text-foreground hover:bg-muted select-none transition-colors',
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
            <div className="w-full h-7 text-left px-1.5 py-1 text-12 leading-normal font-normal text-foreground flex items-center select-text font-sans truncate">
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
      <div className="grid grid-cols-[80px_1fr] gap-1.5 items-start py-0.5 w-full min-w-0">
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
        <TypeConversionModal
          open={isConversionDialogOpen}
          onOpenChange={setIsConversionDialogOpen}
          paper={paper}
          targetType={targetConversionType}
          scopeId={paper.projectId || 'user'}
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
