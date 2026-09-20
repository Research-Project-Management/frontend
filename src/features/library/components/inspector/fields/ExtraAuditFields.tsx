'use client';

import React, { useMemo } from 'react';
import type { Item } from '@/features/library/types/library.types';
import { formatAndSanitizeExtraMetadata } from '../../../domain';
import { InlineTextarea } from './InlineTextarea';

export interface ExtraAuditFieldsProps {
  paper: Item;
  canEdit?: boolean;
  onUpdatePaper?: (data: Partial<Item>) => void;
}

function isValidValue(val?: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val) && Number.isFinite(val);
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return false;
    const lower = str.toLowerCase();
    return (
      lower !== 'null' &&
      lower !== 'undefined' &&
      lower !== 'n/a' &&
      lower !== 'na' &&
      lower !== 'none' &&
      lower !== 'nil' &&
      lower !== '{}' &&
      lower !== '[]' &&
      lower !== '[object object]' &&
      lower !== '0000' &&
      lower !== 'unknown'
    );
  }
  return false;
}

function formatAuditDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export function ExtraAuditFields({
  paper,
  canEdit = true,
  onUpdatePaper,
}: ExtraAuditFieldsProps) {
  const formattedExtraMetadata = useMemo(() => {
    return formatAndSanitizeExtraMetadata(paper.extra, paper.extraFields, paper);
  }, [paper]);

  const handleExtraSave = (savedValue: string) => {
    onUpdatePaper?.({ extra: savedValue || undefined });
  };

  return (
    <>
      {/* Extra Field - Always available like native Zotero */}
      <div className="grid grid-cols-[96px_1fr] gap-1.5 items-start py-0.5">
        <span
          className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate pt-1"
          id="label-extra"
        >
          Extra
        </span>
        <InlineTextarea
          value={formattedExtraMetadata}
          ariaLabel="Extra"
          rows={Math.min(
            4,
            Math.max(1, formattedExtraMetadata ? formattedExtraMetadata.split('\n').length : 1),
          )}
          onSave={handleExtraSave}
          readOnly={!canEdit}
        />
      </div>

      {/* Date Added */}
      {isValidValue(paper.createdAt) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate">
            Date Added
          </span>
          <span className="text-foreground text-12 leading-normal px-2 py-1 select-text truncate font-normal h-7 flex items-center font-sans">
            {formatAuditDate(paper.createdAt)}
          </span>
        </div>
      )}

      {/* Modified */}
      {isValidValue(paper.updatedAt) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate">
            Modified
          </span>
          <span className="text-foreground text-12 leading-normal px-2 py-1 select-text truncate font-normal h-7 flex items-center font-sans">
            {formatAuditDate(paper.updatedAt)}
          </span>
        </div>
      )}
    </>
  );
}

export default ExtraAuditFields;
