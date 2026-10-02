'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import type { Item, SchemaFieldDefinition } from '../../../types/reader.types';
import { InlineField } from './InlineField';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

export interface DynamicInspectorFieldProps {
  fieldDef: SchemaFieldDefinition;
  paper: Item;
  val: string;
  displayDoi: string;
  copiedKey: string | null;
  canEdit?: boolean;
  onSave: (newVal: string) => void;
  onCopy: (text: string, label: string) => void;
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

/** Check if a string represents an external link / URL */
function isUrlLike(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed || trimmed === 'http://' || trimmed === 'https://') return false;
  if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) return true;
  if (/^www\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed)) return true;
  if (/^(dx\.)?doi\.org\//i.test(trimmed)) return true;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/[^\s]*)?$/i.test(trimmed) && trimmed.includes('.')) {
    const hasDomainExtension = /\.(org|com|net|edu|gov|io|ai|app|dev|co|uk|de|fr|vn|jp|cn|info|me|tech|xyz)(\/|$)/i.test(trimmed);
    return hasDomainExtension;
  }
  return false;
}

/** Ensure link starts with valid protocol */
function toValidUrl(str: string): string {
  const trimmed = str.trim();
  if (/^(https?:\/\/|ftp:\/\/|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function DynamicInspectorField({
  fieldDef,
  paper,
  val,
  displayDoi,
  copiedKey,
  canEdit = true,
  onSave,
  onCopy,
}: DynamicInspectorFieldProps) {
  const [liveValue, setLiveValue] = useState(val);

  useEffect(() => {
    setLiveValue(val);
  }, [val]);

  const currentVal = liveValue ?? val;
  const isDoi = fieldDef.field.toLowerCase() === 'doi';
  const isUrlField = fieldDef.field.toLowerCase() === 'url' || fieldDef.type === 'url';
  const isCitationKey =
    fieldDef.field.toLowerCase() === 'citationkey' ||
    fieldDef.field.toLowerCase() === 'citekey';
  const isIdentifierOrNumeric =
    isDoi ||
    isCitationKey ||
    fieldDef.mono ||
    [
      'isbn',
      'issn',
      'pmid',
      'pmcid',
      'arxiv',
      'year',
      'volume',
      'issue',
      'pages',
      'date',
      'citationcount',
    ].includes(fieldDef.field.toLowerCase());

  const hasLink =
    isUrlLike(currentVal) ||
    (isUrlField && isValidValue(currentVal) && currentVal.trim() !== 'http://' && currentVal.trim() !== 'https://');

  return (
    <div className="grid grid-cols-[80px_1fr] gap-1.5 items-center py-0.5 group w-full min-w-0">
      <span
        className="text-muted-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate"
        title={fieldDef.label}
      >
        {fieldDef.label}
      </span>
      <div className="flex items-center gap-1 min-w-0 w-full">
        <InlineField
          value={val}
          onChange={setLiveValue}
          ariaLabel={isCitationKey ? 'BibTeX Citation Key' : fieldDef.label}
          onSave={onSave}
          mono={Boolean(isIdentifierOrNumeric)}
          readOnly={!canEdit}
          className="flex-1 w-full"
        />

        {/* DOI Quick Action */}
        {isDoi && displayDoi && (
          <div className="flex items-center shrink-0">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <a
                  href={`https://doi.org/${displayDoi}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none transition-colors"
                  aria-label="Open DOI"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                </a>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
              >
                Open DOI
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Citation Key Quick Action */}
        {isCitationKey && isValidValue(currentVal) && (
          <div className="invisible group-hover:visible group-focus-within:visible flex items-center shrink-0">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onCopy(`\\cite{${currentVal}}`, 'Citation Key')}
                  className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none transition-colors"
                  aria-label="Copy citation key"
                >
                  {copiedKey === 'Citation Key' ? (
                    <CheckCircle2 className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                  ) : (
                    <Copy className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
              >
                Copy citation key
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* PubMed Quick Action */}
        {(fieldDef.field.toLowerCase() === 'pmid' || fieldDef.field.toLowerCase() === 'pmcid') && currentVal && (
          <div className="flex items-center shrink-0">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <a
                  href={
                    fieldDef.field.toLowerCase() === 'pmid'
                      ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(currentVal)}/`
                      : `https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(currentVal)}/`
                  }
                  target="_blank"
                  rel="noreferrer noopener"
                  className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none transition-colors"
                  aria-label="Open in PubMed"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                </a>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
              >
                Open in PubMed
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* arXiv Quick Action */}
        {(fieldDef.field.toLowerCase() === 'arxivid' || fieldDef.field.toLowerCase() === 'arxiv') && currentVal && (
          <div className="flex items-center shrink-0">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <a
                  href={`https://arxiv.org/abs/${encodeURIComponent(currentVal.replace(/^arxiv:/i, ''))}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none transition-colors"
                  aria-label="Open in arXiv"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                </a>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
                className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
              >
                Open in arXiv
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* General Link / URL Quick Action (License, URL, Rights, or any field containing a web link) */}
        {!isDoi &&
          fieldDef.field.toLowerCase() !== 'pmid' &&
          fieldDef.field.toLowerCase() !== 'pmcid' &&
          fieldDef.field.toLowerCase() !== 'arxivid' &&
          fieldDef.field.toLowerCase() !== 'arxiv' &&
          hasLink && (
            <div className="flex items-center shrink-0">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <a
                    href={toValidUrl(currentVal)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none transition-colors"
                    aria-label={`Open ${fieldDef.label} link`}
                  >
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                  </a>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                  className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                >
                  Open {fieldDef.label.toLowerCase()} link
                </TooltipContent>
              </Tooltip>
            </div>
          )}
      </div>
    </div>
  );
}

export default DynamicInspectorField;
