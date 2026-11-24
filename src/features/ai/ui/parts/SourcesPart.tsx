'use client';

import React from 'react';
import { ExternalLink, FileText, Quote } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import type { SourceItem } from '../../types/message';
import {
  cleanSourceSnippet,
  groupRagSources,
  type GroupedExcerpt,
  type GroupedRagSource,
} from './citations';

export {
  cleanSourceSnippet,
  groupRagSources,
  type GroupedExcerpt,
  type GroupedRagSource,
};

function formatPageSuffix(pages: readonly number[]): string {
  if (pages.length === 0) return '';
  if (pages.length <= 3) return `p. ${pages.join(', ')}`;
  return `p. ${pages.slice(0, 3).join(', ')} +${pages.length - 3}`;
}

export function SourcesPart({ sources }: { sources: SourceItem[] }) {
  if (!sources || sources.length === 0) return null;

  const seenUrls = new Set<string>();
  const webSources = sources.filter((s) => {
    const url = s.url?.trim();
    if (!url || seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });

  const ragSources = sources.filter((s) => !s.url && (s.source || s.title));
  const groupedRag = groupRagSources(ragSources);

  if (webSources.length === 0 && groupedRag.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
        {webSources.map((s, i) => (
          <a
            key={s.id || s.url || i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={[s.authors, s.snippet].filter(Boolean).join('\n')}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-secondary/75 text-foreground/80 border border-border/70 hover:bg-ai/10 hover:text-ai hover:border-ai/30 transition-colors max-w-55 truncate outline-none focus-visible:ring-1 focus-visible:ring-ai"
          >
            <ExternalLink className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{s.title || s.url}</span>
            {s.year && (
              <span className="shrink-0 font-mono tabular-nums opacity-75">
                {s.year}
              </span>
            )}
          </a>
        ))}

        {groupedRag.map((group) => {
          const pageSuffix = formatPageSuffix(group.pages);
          return group.excerpts.length > 0 ? (
            <Popover key={group.key}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-secondary/75 text-foreground/80 border border-border/70 max-w-72 truncate cursor-pointer hover:bg-ai/10 hover:text-ai hover:border-ai/30 data-[state=open]:bg-ai/12 data-[state=open]:text-ai data-[state=open]:border-ai/35 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
                >
                  <FileText className="size-2.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{group.label}</span>
                  {pageSuffix && (
                    <span className="shrink-0 tabular-nums text-[11px] opacity-75">
                      {pageSuffix}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-96 max-w-[90vw] p-0 overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-border bg-secondary/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Quote className="size-3 text-ai shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground/80 truncate">
                      {group.label}
                    </span>
                  </div>
                  {group.excerpts.length > 1 && (
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {group.excerpts.length} excerpts
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                  {group.excerpts.map((excerpt, exIdx) => (
                    <div key={exIdx} className="px-3 py-2.5 space-y-1">
                      {excerpt.page !== undefined && (
                        <p className="text-[11px] font-medium text-ai/80 tabular-nums">
                          Page {excerpt.page}
                        </p>
                      )}
                      <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                        {excerpt.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span
              key={group.key}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-secondary/75 text-foreground/80 border border-border/70 max-w-72 truncate cursor-default"
            >
              <FileText className="size-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{group.label}</span>
              {pageSuffix && (
                <span className="shrink-0 tabular-nums text-[11px] opacity-75">
                  {pageSuffix}
                </span>
              )}
            </span>
          );
        })}
    </div>
  );
}
