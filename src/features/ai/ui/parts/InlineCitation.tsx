'use client';

import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import type { SourceItem } from '../../types/message';
import {
  cleanSourceSnippet,
  extractSourceDocumentLabel,
  extractSourcePage,
  formatInlineCitationLabel,
} from './citations';

export interface InlineCitationProps {
  index: number;
  source?: SourceItem;
  isMultiDocument: boolean;
  isStreaming?: boolean;
}

export function InlineCitation({
  index,
  source,
  isMultiDocument,
  isStreaming = false,
}: InlineCitationProps) {
  const requestCitationNavigate = useReaderStore((s) => s.requestCitationNavigate);

  if (!source) {
    if (!isStreaming) return null;
    return (
      <span
        className="inline-flex items-center align-baseline ml-1 mr-0 px-1.5 py-px rounded-full bg-muted/80 text-muted-foreground text-11 font-medium tabular-nums animate-pulse motion-reduce:animate-none"
        aria-label="Loading citation"
      >
        {index}
      </span>
    );
  }

  const label = formatInlineCitationLabel(source, {
    isMultiDocument,
    fallbackIndex: index,
  });
  const fullTitle = extractSourceDocumentLabel(source);
  const page = extractSourcePage(source);
  const sourceId = source.id?.trim();
  const cleanedSnippet = source.snippet
    ? cleanSourceSnippet(source.snippet)
    : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 align-baseline ml-1 mr-0 px-1.5 py-px rounded-full bg-muted/80 text-muted-foreground hover:bg-ai/12 hover:text-ai data-[state=open]:bg-ai/15 data-[state=open]:text-ai text-11 font-medium tabular-nums leading-snug cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
          aria-label={`View source: ${fullTitle}`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-80 max-w-[90vw] p-0 overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-border bg-secondary/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {source.url ? (
              <ExternalLink className="size-3 text-ai shrink-0" aria-hidden="true" />
            ) : (
              <FileText className="size-3 text-ai shrink-0" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold text-foreground/85 truncate">
              {fullTitle}
            </span>
          </div>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-11 font-medium text-ai hover:underline shrink-0"
            >
              Open
            </a>
          ) : (
            page !== undefined &&
            (sourceId ? (
              <button
                type="button"
                onClick={() => requestCitationNavigate(sourceId, page)}
                aria-label={`Jump to page ${page}`}
                className="text-11 font-medium text-ai hover:underline shrink-0 tabular-nums cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai rounded-xs"
              >
                Page {page} →
              </button>
            ) : (
              <span className="text-11 font-medium text-ai/85 shrink-0 tabular-nums">
                Page {page}
              </span>
            ))
          )}
        </div>
        {cleanedSnippet && (
          <div className="max-h-48 overflow-y-auto px-3 py-2.5">
            <p className="text-xs leading-relaxed text-foreground/85 whitespace-pre-wrap break-words">
              {cleanedSnippet}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
