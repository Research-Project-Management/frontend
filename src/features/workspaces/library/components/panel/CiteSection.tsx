'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, ChevronDown, Download, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/shared/components/ui";
import { useCslCitation } from '@/features/workspaces/library/hooks/use-library';
import type { Item, CslStyle } from '@/features/workspaces/library/types/library.types';
import { getPaperCitationKey, cleanDoi } from '@/features/workspaces/library/utils/library.util';

export interface CiteSectionProps {
  paper: Item;
  workspaceId?: string;
  hideHeader?: boolean;
}

export type CitationFormat =
  | 'apa'
  | 'ieee'
  | 'mla'
  | 'bibtex'
  | 'chicago'
  | 'harvard'
  | 'nature'
  | 'vancouver'
  | 'ris';

export const ALL_FORMATS: Array<{ id: CitationFormat; label: string }> = [
  { id: 'apa', label: 'APA' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'mla', label: 'MLA' },
  { id: 'bibtex', label: 'BibTeX' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'harvard', label: 'Harvard' },
  { id: 'nature', label: 'Nature' },
  { id: 'vancouver', label: 'Vancouver' },
  { id: 'ris', label: 'RIS' },
];

// Fallback exports for backward compatibility
export const PRIMARY_FORMATS = ALL_FORMATS.slice(0, 4);
export const MORE_FORMATS = ALL_FORMATS.slice(4);

/** Robust clipboard copy — tries modern Clipboard API, falls back to execCommand */
async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand
  }

  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch {
    // Ignore fallback errors
  }
  return false;
}

/** Client-side file downloader for .bib and .ris files */
function downloadFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  if (typeof window === 'undefined') return;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 150);
  } catch {
    toast.error('Could not download file', { id: 'library-clipboard' });
  }
}

import DOMPurify from 'dompurify';

/**
 * Robust CSL HTML sanitizer powered by DOMPurify.
 * Strictly whitelists semantic markup (i, b, em, strong, span, a, div)
 * and safe attributes (href, class) required for citation styling while
 * neutralizing any XSS payloads, inline script injection, or javascript: URIs.
 */
function sanitizeCslHtml(html?: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') return '';

  const purify = typeof DOMPurify.sanitize === 'function'
    ? DOMPurify
    : typeof DOMPurify === 'function'
      ? (DOMPurify as unknown as (win: Window) => typeof DOMPurify)(window)
      : null;

  if (!purify || typeof purify.sanitize !== 'function') return '';

  return purify.sanitize(html, {
    ALLOWED_TAGS: ['i', 'b', 'em', 'strong', 'span', 'a', 'div', 'p', 'sub', 'sup'],
    ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
  });
}

export default function CiteSection({ paper, workspaceId }: CiteSectionProps) {
  const [activeFormat, setActiveFormat] = useState<CitationFormat>('apa');
  const [copied, setCopied] = useState(false);
  const [copiedInText, setCopiedInText] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(4);

  const activeWorkspaceId = workspaceId || paper?.workspaceId || '';
  const isExportFormat = activeFormat === 'bibtex' || activeFormat === 'ris';

  // All citation formats are rendered by the backend CSL engine.
  // This component is a thin display/copy layer with no client-side formatting.
  const currentCslStyle = activeFormat as CslStyle;

  const { data: cslData, isLoading } = useCslCitation(
    activeWorkspaceId,
    paper?.id || '',
    currentCslStyle,
  );

  const rawCiteKey = paper ? getPaperCitationKey(paper) : '';
  const citeKey = useMemo(() => {
    return (rawCiteKey || 'ref').replace(/[^a-zA-Z0-9_-]/g, '');
  }, [rawCiteKey]);

  const rawDoi = String(paper?.doi || '').trim();
  const doi = useMemo(() => (rawDoi ? cleanDoi(rawDoi) : ''), [rawDoi]);
  void doi; // retained for potential future use in download filename

  const updateOverflow = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const availableWidth = container.clientWidth - 8;
    if (availableWidth <= 0) return;

    const children = Array.from(measure.children) as HTMLElement[];
    if (children.length < ALL_FORMATS.length + 1) return;

    const itemWidths = children.slice(0, ALL_FORMATS.length).map((el) => el.offsetWidth);
    const moreBtnEl = children[ALL_FORMATS.length];
    const moreBtnWidth = moreBtnEl ? moreBtnEl.offsetWidth : 60;
    const gap = 4;

    let totalAllWidth = 0;
    for (let i = 0; i < itemWidths.length; i++) {
      totalAllWidth += itemWidths[i] + (i > 0 ? gap : 0);
    }

    if (totalAllWidth <= availableWidth) {
      setVisibleCount(ALL_FORMATS.length);
      return;
    }

    let accumulatedWidth = 0;
    let count = 0;

    for (let i = 0; i < itemWidths.length; i++) {
      const nextWidth = accumulatedWidth + itemWidths[i] + (i > 0 ? gap : 0);
      const widthWithMore = nextWidth + gap + moreBtnWidth;

      if (widthWithMore <= availableWidth) {
        accumulatedWidth = nextWidth;
        count++;
      } else {
        break;
      }
    }

    setVisibleCount(Math.max(1, count));
  }, []);

  useEffect(() => {
    updateOverflow();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      updateOverflow();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [updateOverflow]);

  const primaryFormats = useMemo(() => ALL_FORMATS.slice(0, visibleCount), [visibleCount]);
  const moreFormats = useMemo(() => ALL_FORMATS.slice(visibleCount), [visibleCount]);
  const isMoreFormatActive = moreFormats.some((f) => f.id === activeFormat);
  const activeMoreFormat = moreFormats.find((f) => f.id === activeFormat);

  const getContentToCopy = useCallback(() => {
    return cslData?.bibliography || '';
  }, [cslData?.bibliography]);

  const handleCopy = useCallback(async () => {
    const text = getContentToCopy();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      toast.success('Copied citation to clipboard', { id: 'library-clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy', { id: 'library-clipboard' });
    }
  }, [getContentToCopy]);

  const handleCopyInText = useCallback(async () => {
    const text = cslData?.inText || '';
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedInText(true);
      toast.success('Copied in-text citation to clipboard', { id: 'library-clipboard' });
      setTimeout(() => setCopiedInText(false), 2000);
    } else {
      toast.error('Failed to copy', { id: 'library-clipboard' });
    }
  }, [cslData?.inText]);

  const handleDownload = useCallback(() => {
    const ext = activeFormat === 'bibtex' ? 'bib' : activeFormat === 'ris' ? 'ris' : 'txt';
    const content = getContentToCopy();
    const filename = `${citeKey || 'reference'}.${ext}`;
    downloadFile(filename, content);
    toast.success(`Exported ${filename}`, { id: 'library-clipboard' });
  }, [citeKey, activeFormat, getContentToCopy]);

  const rawHtml =
    cslData?.bibliographyHtml ||
    cslData?.html ||
    cslData?.bibliography ||
    '';

  const sanitizedHtml = useMemo(() => sanitizeCslHtml(rawHtml), [rawHtml]);
  const inTextPreview = cslData?.inText || '';

  return (
    <div className="space-y-2 min-w-0 font-sans select-none">
      {/* Hidden strip to measure exact DOM pixel widths for responsive overflow */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="absolute -top-[9999px] left-0 flex items-center gap-1 text-xs opacity-0 pointer-events-none select-none invisible"
      >
        {ALL_FORMATS.map((fmt) => (
          <span
            key={fmt.id}
            className="h-6 px-2 text-xs rounded font-medium inline-block shrink-0"
          >
            {fmt.label}
          </span>
        ))}
        <span className="h-6 px-2 text-xs rounded font-medium inline-flex items-center gap-1 shrink-0">
          <span>More</span>
          <ChevronDown className="size-3 shrink-0" />
        </span>
      </div>

      {/* ⚠️ Citation Guard: Retraction Notice */}
      {paper.isRetracted && (
        <div className="p-2.5 rounded-md border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2 select-none shrink-0">
          <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-700 dark:text-rose-400">Citation Guard: </span>
            <span>You are generating a citation for a <strong>retracted publication</strong>. Citing this paper may compromise academic rigor.</span>
          </div>
        </div>
      )}

      {/* Dynamic Adaptive Format Selection Bar */}
      <div
        ref={containerRef}
        className="relative flex items-center gap-1 text-xs w-full overflow-hidden shrink-0"
      >
        {primaryFormats.map((fmt) => {
          const isSelected = activeFormat === fmt.id;
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setActiveFormat(fmt.id)}
              className={cn(
                'h-6 px-2 text-xs rounded-md cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none font-medium shrink-0',
                isSelected
                  ? 'bg-muted text-foreground font-semibold'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              {fmt.label}
            </button>
          );
        })}

        {moreFormats.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'h-6 px-2 text-xs rounded-md cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none font-medium inline-flex items-center gap-1 shrink-0',
                  isMoreFormatActive
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span>{activeMoreFormat ? activeMoreFormat.label : 'More'}</span>
                <ChevronDown className="size-3 text-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="w-36 p-1 bg-popover/95 border border-border rounded-md shadow-none text-xs z-50"
            >
              {moreFormats.map((fmt) => {
                const isSelected = activeFormat === fmt.id;
                return (
                  <DropdownMenuItem
                    key={fmt.id}
                    onSelect={() => setActiveFormat(fmt.id)}
                    onClick={() => setActiveFormat(fmt.id)}
                    className={cn(
                      'h-7.5 px-2 text-xs cursor-pointer rounded-md hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center justify-between',
                      isSelected
                        ? 'font-medium text-foreground bg-muted'
                        : 'text-foreground',
                    )}
                  >
                    <span>{fmt.label}</span>
                    {isSelected && (
                      <Check className="size-3 text-foreground shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Citation Key Bar */}
      {citeKey && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border/80 bg-muted/30 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-muted-foreground text-11 shrink-0 font-medium">Citekey</span>
            <span className="font-mono text-11 text-foreground truncate select-text font-semibold">
              @{citeKey}
            </span>
          </div>
          <TooltipProvider delayDuration={700}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(citeKey);
                    if (ok) toast.success(`Copied @${citeKey} to clipboard`, { id: 'library-clipboard' });
                  }}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                  aria-label="Copy citation key"
                >
                  <Copy className="size-3.5 text-foreground shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="text-xs px-2 py-1">
                Copy @citekey
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* In-Text Citation Preview Row (Academic styles only) */}
      {!isExportFormat && inTextPreview && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border bg-transparent text-xs">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-muted-foreground text-11 shrink-0 font-medium">In-text</span>
            <span className="font-mono text-11 text-foreground truncate select-text">
              {inTextPreview}
            </span>
          </div>
          <TooltipProvider delayDuration={700}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopyInText}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                  aria-label="Copy in-text citation"
                >
                  {copiedInText ? (
                    <Check className="size-3.5 text-foreground shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-foreground shrink-0" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="text-xs px-2 py-1">
                Copy in-text citation
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Citation Box with Hover-Only Action Icons & Full Width Text */}
      <div className="group relative rounded-md border border-border p-2.5 bg-transparent min-h-[80px] max-h-56 overflow-y-auto text-xs leading-relaxed select-text font-sans">
        <TooltipProvider delayDuration={700}>
          <div
            className={cn(
              'absolute top-2 right-2 flex items-center gap-1.5 z-10 select-none transition-opacity duration-150',
              copied
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Download citation"
                >
                  <Download className="size-3.5 text-foreground shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="text-xs px-2 py-1">
                Download citation
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Copy citation"
                >
                  {copied ? (
                    <Check className="size-3.5 text-foreground shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-foreground shrink-0" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="text-xs px-2 py-1">
                Copy citation
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div>
          {activeFormat === 'bibtex' || activeFormat === 'ris' ? (
            <pre className="font-mono text-xs text-foreground whitespace-pre select-text overflow-x-auto leading-relaxed">
              {cslData?.bibliography || ''}
            </pre>
          ) : (
            <div>
              {isLoading && !sanitizedHtml ? (
                <div className="space-y-1.5 py-1">
                  <div className="h-3 bg-muted rounded animate-pulse w-full" />
                  <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
                </div>
              ) : (
                <div
                  className="text-foreground leading-relaxed font-sans text-xs break-words select-text [&_i]:italic [&_b]:font-medium [&_a]:underline [&_a]:text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: sanitizedHtml,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
