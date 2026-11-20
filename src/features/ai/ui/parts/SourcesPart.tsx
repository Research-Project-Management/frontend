'use client';

import React from 'react';
import { ExternalLink, FileText, Quote } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import type { SourceItem } from '../../types/message';

export interface GroupedExcerpt {
  page?: number;
  snippet: string;
}

export interface GroupedRagSource {
  key: string;
  label: string;
  pages: number[];
  excerpts: GroupedExcerpt[];
}

const TRAILING_OPEN_TAG_RE = /<[a-zA-Z/][^>]*$/;
const BR_TAG_RE = /<br\s*\/?>/gi;
const INLINE_HTML_RE = /<\/?(?:b|i|em|strong|sup|sub|span|p|div|code)\b[^>]*>/gi;
const TABLE_SEP_RE = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*(?::?-{2,}:?\s*\|?)?\s*$/;
const COL_PLACEHOLDER_RE = /^col\d+$/i;
const HEADING_PREFIX_RE = /^#{1,6}\s+/;
const MULTI_SPACE_RE = /[ \t]{2,}/g;
const SOURCE_PAGE_SUFFIX_RE = /\s*\(p\.\s*(\d+)\)\s*$/i;

export function cleanSourceSnippet(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return '';

  text = text.replace(TRAILING_OPEN_TAG_RE, '');
  text = text.replace(BR_TAG_RE, '; ');
  text = text.replace(INLINE_HTML_RE, '');

  const cleanedLines: string[] = [];
  for (const rawLine of text.split('\n')) {
    const stripped = rawLine.trim();
    if (!stripped || TABLE_SEP_RE.test(stripped)) continue;

    if (
      stripped.includes('|') &&
      (stripped.startsWith('|') || stripped.endsWith('|'))
    ) {
      const cells: string[] = [];
      for (const cell of stripped.split('|')) {
        const normalizedCell = cell.trim().replace(MULTI_SPACE_RE, ' ');
        if (!normalizedCell || COL_PLACEHOLDER_RE.test(normalizedCell)) {
          continue;
        }
        if (cells.length > 0 && cells[cells.length - 1] === normalizedCell) {
          continue;
        }
        cells.push(normalizedCell);
      }
      if (cells.length > 0) {
        cleanedLines.push(cells.join(' · '));
      }
      continue;
    }

    const noHeading = stripped.replace(HEADING_PREFIX_RE, '');
    const normalizedLine = noHeading.replace(MULTI_SPACE_RE, ' ').trim();
    if (normalizedLine) {
      cleanedLines.push(normalizedLine);
    }
  }

  return cleanedLines.join('\n').trim();
}

export function groupRagSources(
  ragSources: readonly SourceItem[],
): GroupedRagSource[] {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      pageSet: Set<number>;
      excerptSeen: Set<string>;
      excerpts: GroupedExcerpt[];
    }
  >();

  for (const s of ragSources) {
    const rawTitle = (s.title || '').trim();
    const rawSource = (s.source || '').trim();
    const strippedSource = rawSource.replace(SOURCE_PAGE_SUFFIX_RE, '').trim();
    const label = rawTitle || strippedSource || 'Source';
    const key = label.toLowerCase();

    let page: number | undefined =
      typeof s.page === 'number' && Number.isFinite(s.page)
        ? s.page
        : undefined;
    if (page === undefined && rawSource) {
      const match = rawSource.match(SOURCE_PAGE_SUFFIX_RE);
      if (match) {
        page = Number(match[1]);
      }
    }

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label,
        pageSet: new Set<number>(),
        excerptSeen: new Set<string>(),
        excerpts: [],
      };
      groups.set(key, group);
    }

    if (page !== undefined) {
      group.pageSet.add(page);
    }

    const cleanedSnippet = s.snippet ? cleanSourceSnippet(s.snippet) : '';
    if (cleanedSnippet) {
      const dedupeKey = `${page ?? ''}::${cleanedSnippet}`;
      if (!group.excerptSeen.has(dedupeKey)) {
        group.excerptSeen.add(dedupeKey);
        group.excerpts.push({ page, snippet: cleanedSnippet });
      }
    }
  }

  return Array.from(groups.values()).map((g) => {
    const pages = Array.from(g.pageSet).sort((a, b) => a - b);
    const excerpts = [...g.excerpts].sort((a, b) => {
      if (a.page !== undefined && b.page !== undefined) return a.page - b.page;
      if (a.page !== undefined) return -1;
      if (b.page !== undefined) return 1;
      return 0;
    });
    return { key: g.key, label: g.label, pages, excerpts };
  });
}

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
    <div className="mt-2.5 pt-2 border-t border-border space-y-1.5">
      <p className="text-11 font-semibold text-muted-foreground/80">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {webSources.map((s, i) => (
          <a
            key={s.id || s.url || i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={[s.authors, s.snippet].filter(Boolean).join('\n')}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-ai/10 text-ai hover:bg-ai/20 transition-colors max-w-55 truncate outline-none focus-visible:ring-1 focus-visible:ring-ai"
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
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-ai/10 text-ai max-w-72 truncate cursor-pointer hover:bg-ai/20 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
                >
                  <FileText className="size-2.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{group.label}</span>
                  {pageSuffix && (
                    <span className="shrink-0 font-mono tabular-nums text-[11px] opacity-75">
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
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-ai/10 text-ai max-w-72 truncate cursor-default"
            >
              <FileText className="size-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{group.label}</span>
              {pageSuffix && (
                <span className="shrink-0 font-mono tabular-nums text-[11px] opacity-75">
                  {pageSuffix}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
