'use client';

import React from 'react';
import { ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import type { Item } from '@/features/library/types/library.types';
import { SchemaFieldDefinition } from '../../../types';
import { InlineField } from './InlineField';

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
  const isDoi = fieldDef.field.toLowerCase() === 'doi';
  const isUrl = fieldDef.field === 'url';
  const isCitations = fieldDef.field.toLowerCase() === 'citationcount';
  const isCitationKey =
    fieldDef.field.toLowerCase() === 'citationkey' ||
    fieldDef.field.toLowerCase() === 'citekey';

  return (
    <div className="grid grid-cols-[76px_1fr] gap-1.5 items-center py-0.5 group">
      <span
        className="text-muted-foreground text-right font-normal select-none pr-1.5 text-12 leading-tight break-words"
        title={fieldDef.label}
      >
        {fieldDef.label}
      </span>
      <div className="flex items-center gap-1 min-w-0">
        <InlineField
          value={val}
          ariaLabel={isCitationKey ? 'BibTeX Citation Key' : fieldDef.label}
          onSave={onSave}
          mono={fieldDef.mono || isCitationKey}
          readOnly={!canEdit}
        />

        {/* Citations Provider Quick Action */}
        {isCitations && val && (
          <div className="invisible group-hover:visible flex items-center shrink-0">
            <a
              href={
                displayDoi
                  ? `https://openalex.org/works?search=${encodeURIComponent(displayDoi)}`
                  : `https://openalex.org/works?search=${encodeURIComponent(paper.title || '')}`
              }
              target="_blank"
              rel="noreferrer noopener"
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
              aria-label="View citations on OpenAlex in new tab"
              title="View citations on OpenAlex"
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            </a>
          </div>
        )}

        {/* DOI Quick Actions */}
        {isDoi && displayDoi && (
          <div className="invisible group-hover:visible flex items-center gap-0.5 shrink-0">
            <a
              href={`https://doi.org/${displayDoi}`}
              target="_blank"
              rel="noreferrer noopener"
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
              aria-label="Open DOI"
              title="Open DOI"
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => onCopy(displayDoi, 'DOI')}
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
              aria-label="Copy DOI"
              title="Copy DOI"
            >
              {copiedKey === 'DOI' ? (
                <CheckCircle2 className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {/* Citation Key Quick Action */}
        {isCitationKey && isValidValue(val) && (
          <div className="invisible group-hover:visible flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onCopy(`\\cite{${val}}`, 'Citation Key')}
              className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none"
              aria-label="Copy citation key"
              title="Copy citation key"
            >
              {copiedKey === 'Citation Key' ? (
                <CheckCircle2 className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {/* URL Quick Action */}
        {isUrl && val && (
          <div className="invisible group-hover:visible flex items-center shrink-0">
            <a
              href={val.startsWith('http') ? val : `https://${val}`}
              target="_blank"
              rel="noreferrer noopener"
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
              aria-label="Open URL"
              title="Open URL"
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            </a>
          </div>
        )}

        {/* PubMed Quick Action */}
        {(fieldDef.field.toLowerCase() === 'pmid' || fieldDef.field.toLowerCase() === 'pmcid') && val && (
          <div className="invisible group-hover:visible flex items-center shrink-0">
            <a
              href={
                fieldDef.field.toLowerCase() === 'pmid'
                  ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(val)}/`
                  : `https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(val)}/`
              }
              target="_blank"
              rel="noreferrer noopener"
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
              aria-label="Open in PubMed"
              title="Open in PubMed"
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            </a>
          </div>
        )}

        {/* arXiv Quick Action */}
        {(fieldDef.field.toLowerCase() === 'arxivid' || fieldDef.field.toLowerCase() === 'arxiv') && val && (
          <div className="invisible group-hover:visible flex items-center shrink-0">
            <a
              href={`https://arxiv.org/abs/${encodeURIComponent(val.replace(/^arxiv:/i, ''))}`}
              target="_blank"
              rel="noreferrer noopener"
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
              aria-label="Open in arXiv"
              title="Open in arXiv"
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default DynamicInspectorField;
