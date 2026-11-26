'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';

export interface CitationDetailPaneProps {
  entry: BibEntry | null;
}

const TYPE_LABELS: Record<string, string> = {
  article: 'Journal article',
  journalarticle: 'Journal article',
  inproceedings: 'Conference paper',
  conferencepaper: 'Conference paper',
  book: 'Book',
  incollection: 'Book chapter',
  booksection: 'Book chapter',
  phdthesis: 'Thesis',
  mastersthesis: 'Thesis',
  thesis: 'Thesis',
  techreport: 'Report',
  report: 'Report',
  preprint: 'Preprint',
  misc: 'Preprint',
};

function formatEntryType(raw?: string): string {
  if (!raw) return '';
  const norm = raw.replace(/[\s_-]+/g, '').toLowerCase();
  if (TYPE_LABELS[norm]) return TYPE_LABELS[norm];
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function CitationDetailPane({ entry }: CitationDetailPaneProps) {
  if (!entry) {
    return (
      <aside className="hidden lg:flex w-[420px] shrink-0 flex-col items-center justify-center border-l border-border bg-muted/10 px-8 text-center select-none">
        <PlaneEmptyState
          variant="citations"
          isCompact
          title="No reference selected"
          description="Select a reference to preview details."
        />
      </aside>
    );
  }

  const venue = entry.journal || entry.booktitle || entry.publisher;
  const typeLabel = formatEntryType(entry.type);
  const authors =
    entry.authors && entry.authors.length > 0
      ? entry.authors.join(', ')
      : entry.author || '';
  const metaSummary = [entry.year, typeLabel].filter(Boolean).join(' · ');

  return (
    <aside className="hidden lg:flex w-[420px] shrink-0 flex-col border-l border-border bg-background overflow-y-auto">
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-[0.9375rem] font-semibold text-foreground leading-snug">
            {entry.title || entry.key}
          </h3>
          {authors && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {authors}
            </p>
          )}
          {metaSummary && (
            <p className="text-xs text-muted-foreground/90 tabular-nums">
              {metaSummary}
            </p>
          )}
        </div>

        <dl className="space-y-2 text-xs">
          {venue && (
            <div className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="text-foreground leading-snug">{venue}</dd>
            </div>
          )}

          <div className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
            <dt className="text-muted-foreground">Cite key</dt>
            <dd className="font-mono text-foreground select-text break-all">
              {entry.key}
            </dd>
          </div>

          {entry.doi && (
            <div className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
              <dt className="text-muted-foreground">DOI</dt>
              <dd className="min-w-0">
                <a
                  href={`https://doi.org/${encodeURIComponent(entry.doi)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                >
                  <span>{entry.doi}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </dd>
            </div>
          )}

          {!entry.doi && entry.url && (
            <div className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
              <dt className="text-muted-foreground">Link</dt>
              <dd className="min-w-0">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                >
                  <span className="truncate max-w-[290px]">{entry.url}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </dd>
            </div>
          )}
        </dl>

        {entry.abstract && (
          <div className="pt-3.5 border-t border-border/70">
            <p className="text-xs font-medium text-foreground mb-1.5">
              Abstract
            </p>
            <p className="text-xs text-muted-foreground leading-[1.6]">
              {entry.abstract}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
