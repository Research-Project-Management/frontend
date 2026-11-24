'use client';

/**
 * CitationInspectorPane.tsx
 *
 * Column 3 of CitationPickerModal: Reference Details, Macro Copy, Abstract & BibTeX Inspector.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  formatBibEntryToBibtex,
  cleanAbstractText,
  cleanBibtexTitle,
  formatCitationTypeBadge,
  parseBibtexAuthors,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';

export interface CitationInspectorPaneProps {
  activeView: 'tree' | 'list' | 'detail';
  selectedEntry: BibEntry | null;
  onBackToList: () => void;
  copyBibtex: (entry: BibEntry) => void;
  copyKey: (key: string) => void;
  copyDoi: (doi: string) => void;
}

export function CitationInspectorPane({
  activeView,
  selectedEntry,
  onBackToList,
  copyBibtex,
  copyKey,
  copyDoi,
}: CitationInspectorPaneProps) {
  const [isBibtexOpen, setIsBibtexOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDoi, setCopiedDoi] = useState(false);

  const venueString = useMemo(() => {
    if (!selectedEntry) return '';
    return [
      selectedEntry.journal || selectedEntry.booktitle || selectedEntry.publisher,
      selectedEntry.year,
      selectedEntry.volume ? `Vol. ${selectedEntry.volume}` : '',
      selectedEntry.number ? `No. ${selectedEntry.number}` : '',
      selectedEntry.pages ? `pp. ${selectedEntry.pages}` : '',
    ]
      .filter(Boolean)
      .join(', ');
  }, [selectedEntry]);

  const doiUrl = useMemo(() => {
    if (!selectedEntry?.doi) return null;
    return selectedEntry.doi.startsWith('http')
      ? selectedEntry.doi
      : `https://doi.org/${selectedEntry.doi}`;
  }, [selectedEntry]);

  const authorList = useMemo(() => {
    if (!selectedEntry) return [];
    return parseBibtexAuthors(
      selectedEntry.authors && selectedEntry.authors.length > 0
        ? selectedEntry.authors
        : selectedEntry.author
          ? [selectedEntry.author]
          : undefined,
    );
  }, [selectedEntry]);

  const cleanTitle = useMemo(() => {
    return cleanBibtexTitle(selectedEntry?.title) || 'Untitled reference';
  }, [selectedEntry?.title]);

  const cleanAbstract = useMemo(() => {
    return cleanAbstractText(selectedEntry?.abstract);
  }, [selectedEntry?.abstract]);

  useEffect(() => {
    setIsAbstractExpanded(false);
  }, [selectedEntry?.key]);

  return (
    <div
      className={cn(
        'flex-1 min-w-0 flex flex-col bg-background h-full overflow-y-auto p-5 sm:p-6 space-y-5 select-text sidebar-scrollbar',
        activeView !== 'detail' && 'hidden md:flex',
      )}
    >
      {/* Mobile Back Button to Return to List */}
      <div className="md:hidden flex items-center justify-between pb-2 border-b border-border/60">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium hover:underline cursor-pointer"
        >
          <span>â† Back to references list</span>
        </button>
      </div>

      {selectedEntry ? (
        <>
          {/* 1. Paper Header: Title -> Authors -> Venue/Type */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground leading-snug tracking-tight">
              {cleanTitle}
            </h3>

            {authorList.length > 0 && (
              <p className="text-13 text-foreground/85 leading-relaxed">
                {authorList.join(', ')}
              </p>
            )}

            <p className="text-12 text-muted-foreground leading-relaxed">
              {[venueString, formatCitationTypeBadge(selectedEntry.type)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          {/* 2. Identifiers (Key, DOI / URL) */}
          <dl className="grid grid-cols-[68px_1fr] gap-x-3 gap-y-2 pt-4 border-t border-border/70 text-12 items-center">
            <dt className="text-muted-foreground select-none">Cite key</dt>
            <dd className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-foreground truncate">@{selectedEntry.key}</span>
              <button
                type="button"
                onClick={() => {
                  copyKey(selectedEntry.key);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 1500);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                title="Copy citation key"
                aria-label="Copy citation key"
              >
                {copiedKey ? (
                  <Check className="size-3.5 text-primary" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </dd>

            {selectedEntry.doi && doiUrl && (
              <>
                <dt className="text-muted-foreground select-none">DOI</dt>
                <dd className="flex items-center gap-1.5 min-w-0">
                  <a
                    href={doiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-foreground hover:underline truncate"
                  >
                    {selectedEntry.doi}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      copyDoi(selectedEntry.doi!);
                      setCopiedDoi(true);
                      setTimeout(() => setCopiedDoi(false), 1500);
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                    title="Copy DOI"
                    aria-label="Copy DOI"
                  >
                    {copiedDoi ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </dd>
              </>
            )}

            {selectedEntry.url && !selectedEntry.doi && (
              <>
                <dt className="text-muted-foreground select-none">URL</dt>
                <dd className="min-w-0">
                  <a
                    href={selectedEntry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline truncate block"
                  >
                    {selectedEntry.url}
                  </a>
                </dd>
              </>
            )}
          </dl>

          {/* 3. Abstract Section */}
          {cleanAbstract && (
            <div className="space-y-2 pt-4 border-t border-border/70">
              <div className="flex items-center justify-between">
                <h4 className="text-12 font-medium text-foreground">
                  Abstract
                </h4>
                {cleanAbstract.length > 250 && (
                  <button
                    type="button"
                    onClick={() => setIsAbstractExpanded((prev) => !prev)}
                    className="text-12 text-primary hover:underline cursor-pointer select-none font-medium"
                  >
                    {isAbstractExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
              <p
                className={cn(
                  'text-13 text-muted-foreground leading-relaxed select-text font-sans',
                  !isAbstractExpanded && cleanAbstract.length > 250 && 'line-clamp-4',
                )}
              >
                {cleanAbstract}
              </p>
            </div>
          )}

          {/* 4. BibTeX Source Section */}
          <div className="space-y-2 pt-4 border-t border-border/70">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsBibtexOpen((prev) => !prev)}
                className="text-12 font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer select-none"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 transition-transform duration-150',
                    isBibtexOpen && 'rotate-90',
                  )}
                />
                <span>BibTeX</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  copyBibtex(selectedEntry);
                  setCopiedBibtex(true);
                  setTimeout(() => setCopiedBibtex(false), 1500);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                title={copiedBibtex ? 'Copied BibTeX' : 'Copy BibTeX'}
                aria-label="Copy BibTeX"
              >
                {copiedBibtex ? (
                  <Check className="size-3.5 text-primary" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            {isBibtexOpen && (
              <pre className="p-3.5 rounded-md bg-muted/30 border border-border/70 text-12 font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words select-text">
                <code>{formatBibEntryToBibtex(selectedEntry)}</code>
              </pre>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-6 py-16 space-y-1.5">
          <h4 className="text-xs font-semibold text-foreground">Select a Reference</h4>
          <p className="text-11 text-muted-foreground max-w-xs leading-relaxed">
            Choose a paper from the list to inspect its details and insert citations into your
            document.
          </p>
        </div>
      )}
    </div>
  );
}
