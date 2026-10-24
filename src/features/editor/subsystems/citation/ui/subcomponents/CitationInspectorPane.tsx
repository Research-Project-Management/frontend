'use client';

/**
 * CitationInspectorPane.tsx
 *
 * Column 3 of CitationPickerModal: Reference Details, Macro Copy, Abstract & BibTeX Inspector.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Code2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import {
  formatCitationSnippet,
  formatBibEntryToBibtex,
  cleanAbstractText,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { editorCommandBus } from '@/features/editor/core';
import type { CitationStyle } from '../modals/CitationPickerModal';

export const STYLE_OPTIONS: { id: CitationStyle; label: string; preview: string }[] = [
  { id: 'latex-cite', label: '\\cite', preview: '\\cite{key}' },
  { id: 'latex-citep', label: '\\citep', preview: '\\citep{key}' },
  { id: 'latex-citet', label: '\\citet', preview: '\\citet{key}' },
  { id: 'latex-autocite', label: '\\autocite', preview: '\\autocite{key}' },
  { id: 'markdown-bracket', label: 'Pandoc', preview: '[@key]' },
];

export interface CitationInspectorPaneProps {
  activeView: 'tree' | 'list' | 'detail';
  selectedEntry: BibEntry | null;
  selectedStyle: CitationStyle;
  citedKeysSet: Set<string>;
  onSelectStyle: (style: CitationStyle) => void;
  onBackToList: () => void;
  onCloseModal: () => void;
  copyCitationSnippet: (snippet: string) => void;
  copyBibtex: (entry: BibEntry) => void;
  copyKey: (key: string) => void;
  copyDoi: (doi: string) => void;
}

export function CitationInspectorPane({
  activeView,
  selectedEntry,
  selectedStyle,
  citedKeysSet,
  onSelectStyle,
  onBackToList,
  onCloseModal,
  copyCitationSnippet,
  copyBibtex,
  copyKey,
  copyDoi,
}: CitationInspectorPaneProps) {
  const [isBibtexOpen, setIsBibtexOpen] = useState(true);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedDoi, setCopiedDoi] = useState(false);

  const selectedOption = useMemo(
    () => STYLE_OPTIONS.find((opt) => opt.id === selectedStyle) || STYLE_OPTIONS[0],
    [selectedStyle],
  );

  const venueString = useMemo(() => {
    if (!selectedEntry) return '';
    return [
      selectedEntry.journal || selectedEntry.booktitle || selectedEntry.publisher,
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

  const cleanAbstract = useMemo(() => {
    return cleanAbstractText(selectedEntry?.abstract);
  }, [selectedEntry?.abstract]);

  useEffect(() => {
    setIsAbstractExpanded(false);
  }, [selectedEntry?.key]);

  return (
    <div
      className={cn(
        'flex-1 min-w-0 flex flex-col bg-background h-full overflow-y-auto p-4 sm:p-6 space-y-4 select-text sidebar-scrollbar',
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
          <span>← Back to references list</span>
        </button>
      </div>

      {selectedEntry ? (
        <>
          {/* 1. Paper Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 font-mono text-11 px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium">
                <span>@{selectedEntry.key}</span>
                <button
                  type="button"
                  onClick={() => {
                    copyKey(selectedEntry.key);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 1500);
                  }}
                  className="size-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Copy citation key"
                  aria-label="Copy citation key"
                >
                  {copiedKey ? (
                    <Check className="size-2.5 text-primary" />
                  ) : (
                    <Copy className="size-2.5" />
                  )}
                </button>
              </span>

              <span className="font-mono text-10 px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
                {(selectedEntry.type || 'article').toLowerCase()}
              </span>

              {selectedEntry.year && (
                <span className="font-mono text-10 px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  {selectedEntry.year}
                </span>
              )}

              {(selectedEntry.source === 'library' ||
                selectedEntry.sourceFile === 'workspace-library') && (
                <span className="text-10 font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  Library
                </span>
              )}
              {(selectedEntry.source === 'bib' ||
                (selectedEntry.sourceFile &&
                  selectedEntry.sourceFile !== 'workspace-library')) && (
                <span className="text-10 font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  .bib
                </span>
              )}
              {selectedEntry.key && citedKeysSet.has(selectedEntry.key.toLowerCase()) && (
                <span className="text-10 font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                  In Document
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-15 font-semibold text-foreground leading-snug tracking-tight">
              {selectedEntry.title || 'Untitled reference'}
            </h3>

            {/* Authors */}
            {selectedEntry.authors && selectedEntry.authors.length > 0 && (
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Authors: </span>
                {selectedEntry.authors.join(', ')}
              </div>
            )}

            {/* Venue / Publication */}
            {venueString && (
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Publication: </span>
                {venueString}
              </div>
            )}

            {/* DOI & URL links */}
            {(doiUrl || (selectedEntry.url && !selectedEntry.doi)) && (
              <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                {selectedEntry.doi && doiUrl && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <a
                      href={doiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-11 text-foreground hover:underline"
                    >
                      <span>DOI: {selectedEntry.doi}</span>
                      <ExternalLink className="size-3 text-foreground" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        copyDoi(selectedEntry.doi!);
                        setCopiedDoi(true);
                        setTimeout(() => setCopiedDoi(false), 1500);
                      }}
                      className="p-1 rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Copy DOI"
                      aria-label="Copy DOI"
                    >
                      {copiedDoi ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3 text-foreground" />
                      )}
                    </button>
                  </div>
                )}

                {selectedEntry.url && !selectedEntry.doi && (
                  <a
                    href={selectedEntry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-11 text-foreground hover:underline"
                  >
                    <span>Open link</span>
                    <ExternalLink className="size-3 text-foreground" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 2. Quick Actions Row (Citation snippet style selector) */}
          <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 text-11 rounded border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
                >
                  {copiedSnippet ? (
                    <Check className="size-3 text-primary" />
                  ) : (
                    <Code2 className="size-3 text-foreground" />
                  )}
                  <span>Copy {selectedOption.label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-1">
                {STYLE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => {
                      onSelectStyle(opt.id);
                      const snippet = formatCitationSnippet(selectedEntry.key, opt.id);
                      copyCitationSnippet(snippet);
                      setCopiedSnippet(true);
                      setTimeout(() => setCopiedSnippet(false), 1500);
                    }}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-1.5 text-xs font-mono rounded-md cursor-pointer text-foreground',
                      selectedStyle === opt.id && 'bg-muted font-medium text-foreground',
                    )}
                  >
                    <span>{opt.label}</span>
                    <span className="text-10 text-muted-foreground font-sans">
                      {opt.preview}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              aria-label="Rename citation key"
              onClick={() => {
                onCloseModal();
                editorCommandBus.dispatch({
                  type: 'dialog:open',
                  dialog: 'rename-symbol',
                  payload: {
                    symbolType: 'citation',
                    symbolName: selectedEntry.key,
                    oldKey: selectedEntry.key,
                  },
                });
              }}
              className="h-7 px-2.5 text-11 rounded border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
            >
              <span>Rename Key</span>
            </button>
          </div>

          {/* 3. Abstract Section */}
          {cleanAbstract && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-11 font-medium text-muted-foreground">
                  Abstract
                </h4>
                {cleanAbstract.length > 250 && (
                  <button
                    type="button"
                    onClick={() => setIsAbstractExpanded((prev) => !prev)}
                    className="text-11 text-primary hover:underline cursor-pointer select-none font-medium"
                  >
                    {isAbstractExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
              <p
                className={cn(
                  'text-12 text-muted-foreground leading-relaxed select-text font-sans',
                  !isAbstractExpanded && cleanAbstract.length > 250 && 'line-clamp-4',
                )}
              >
                {cleanAbstract}
              </p>
            </div>
          )}

          {/* 4. BibTeX Source Section */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsBibtexOpen((prev) => !prev)}
                className="text-11 font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer select-none"
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
                className="h-6 px-2 text-11 rounded border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1 transition-colors cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
              >
                {copiedBibtex ? (
                  <>
                    <Check className="size-3 text-primary" />
                    <span className="text-primary font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3 text-foreground" />
                    <span>Copy BibTeX</span>
                  </>
                )}
              </button>
            </div>
            {isBibtexOpen && (
              <pre className="p-3 rounded-md bg-muted/20 border border-border text-11 font-mono leading-relaxed text-foreground overflow-x-auto whitespace-pre select-text max-h-48 sidebar-scrollbar">
                <code>{formatBibEntryToBibtex(selectedEntry)}</code>
              </pre>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-6 py-16 space-y-3">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <FileText className="size-5" />
          </div>
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
