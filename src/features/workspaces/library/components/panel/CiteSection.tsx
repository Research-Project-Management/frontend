'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, ChevronDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/shared/components/ui/tooltip';
import { useCslCitation } from '@/features/workspaces/library/hooks/library/use-library';
import type { CatalogItem, CslStyle } from '@/features/workspaces/library/types/library.types';
import { getPaperCitationKey, normalizeAuthors, cleanDoi } from '@/features/workspaces/library/utils/library.util';

export interface CiteSectionProps {
  paper: CatalogItem;
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

interface ParsedAuthor {
  given: string;
  family: string;
  initials: string;
}

/** Robust clipboard copy */
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

/** Parse an author string into given, family, and initials safely */
function parseAuthor(name: string): ParsedAuthor {
  const trimmed = (name || '').trim();
  if (!trimmed) return { given: '', family: 'Anonymous', initials: 'A.' };

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((s) => s.trim());
    const family = parts[0] || 'Anonymous';
    const given = parts.slice(1).join(' ') || '';
    const initials = given
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w[0] ? `${w[0].toUpperCase()}.` : ''))
      .filter(Boolean)
      .join(' ');
    return { given, family, initials: initials || (family[0] ? `${family[0].toUpperCase()}.` : 'A.') };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { given: '', family: parts[0], initials: '' };
  }

  const family = parts.pop() || 'Anonymous';
  const given = parts.join(' ');
  const initials = parts
    .map((w) => (w[0] ? `${w[0].toUpperCase()}.` : ''))
    .filter(Boolean)
    .join(' ');
  return { given, family, initials: initials || (family[0] ? `${family[0].toUpperCase()}.` : 'A.') };
}

/** Clean title string */
function cleanTitle(title?: string): string {
  if (!title) return 'Untitled Reference';
  return title.trim().replace(/[.\s]+$/, '');
}

/** Sanitize BibTeX string fields */
function escapeBibtex(val?: string): string {
  if (!val) return '';
  return val
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}

/** Safe sanitizer for CSL HTML outputs */
function sanitizeCslHtml(html?: string): string {
  if (!html) return '';
  let sanitized = html.replace(/<\s*(script|iframe|object|embed|form|svg|img|style)[^>]*>.*?<\s*\/\s*\1\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*(script|iframe|object|embed|form|svg|img|style)[^>]*\/?\s*>/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
  return sanitized;
}

export default function CiteSection({ paper, workspaceId }: CiteSectionProps) {
  const [activeFormat, setActiveFormat] = useState<CitationFormat>('apa');
  const [copied, setCopied] = useState(false);
  const [copiedInText, setCopiedInText] = useState(false);

  // Dynamic responsive overflow calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(4);

  const targetWsId = workspaceId || paper?.workspaceId || '';
  const isExportFormat = activeFormat === 'bibtex' || activeFormat === 'ris';

  const currentCslStyle: CslStyle = (
    ['apa', 'ieee', 'mla', 'chicago', 'harvard', 'nature', 'vancouver'].includes(activeFormat)
      ? activeFormat
      : 'apa'
  ) as CslStyle;

  const { data: cslData, isLoading } = useCslCitation(
    targetWsId,
    paper?.id || '',
    currentCslStyle,
  );

  const rawCiteKey = paper ? getPaperCitationKey(paper) : '';
  const citeKey = useMemo(() => {
    return (rawCiteKey || 'ref2024').replace(/[^a-zA-Z0-9_-]/g, '');
  }, [rawCiteKey]);

  const paperAuthors = paper?.authors;
  const paperCreators = (paper as any)?.creators;
  const rawAuthors = useMemo(
    () => normalizeAuthors(paperAuthors, paperCreators),
    [paperAuthors, paperCreators],
  );

  // Cap authors to prevent browser freeze on papers with 1,000+ authors
  const authors = useMemo(() => rawAuthors.slice(0, 50), [rawAuthors]);
  const parsedAuthors = useMemo(() => authors.map(parseAuthor), [authors]);

  const year = useMemo(() => {
    if (!paper) return 'n.d.';
    if (paper.year && typeof paper.year === 'number' && paper.year > 0) {
      return String(paper.year);
    }
    if (paper.year && typeof paper.year === 'string' && paper.year.trim()) {
      const match = paper.year.match(/\b(19\d\d|20\d\d)\b/);
      if (match) return match[1];
    }
    if (paper.createdAt) {
      const d = new Date(paper.createdAt);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        if (yr > 1900 && yr < 2100) return String(yr);
      }
    }
    return 'n.d.';
  }, [paper?.year, paper?.createdAt]);

  const title = useMemo(() => cleanTitle(paper?.title), [paper?.title]);
  const titleTerminated = useMemo(() => (/[?!]$/.test(title) ? title : `${title}.`), [title]);
  const journal = String(paper?.journal || paper?.publicationTitle || paper?.publisher || '').trim().replace(/[.\s]+$/, '');
  const volume = String(paper?.volume || '').trim();
  const issue = String(paper?.issue || '').trim();
  const pages = String(paper?.pages || '').trim();
  const rawDoi = String(paper?.doi || '').trim();
  const doi = useMemo(() => (rawDoi ? cleanDoi(rawDoi) : ''), [rawDoi]);
  const url = String(paper?.url || (doi ? `https://doi.org/${doi}` : '')).trim();

  // ── Dynamic Overflow Calculation ─────────────────────────────────────────────
  const updateOverflow = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    // Available width inside container with safe 8px margin to guarantee no right-edge clipping
    const availableWidth = container.clientWidth - 8;
    if (availableWidth <= 0) return;

    const children = Array.from(measure.children) as HTMLElement[];
    if (children.length < ALL_FORMATS.length + 1) return;

    const itemWidths = children.slice(0, ALL_FORMATS.length).map((el) => el.offsetWidth);
    const moreBtnEl = children[ALL_FORMATS.length];
    const moreBtnWidth = moreBtnEl ? moreBtnEl.offsetWidth : 60;
    const gap = 4; // gap-1 is 4px

    // 1. If all items fit completely without needing a More button
    let totalAllWidth = 0;
    for (let i = 0; i < itemWidths.length; i++) {
      totalAllWidth += itemWidths[i] + (i > 0 ? gap : 0);
    }

    if (totalAllWidth <= availableWidth) {
      setVisibleCount(ALL_FORMATS.length);
      return;
    }

    // 2. Otherwise find the maximum number of items that fit with the More button
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

    // Keep at least 1 item on the visible tab bar
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

  // ── High-Fidelity Client CSL Fallback Formatters ──────────────────────────────
  const formattedClientCitation = useMemo(() => {
    const totalAuth = parsedAuthors.length;

    // 1. APA 7th
    if (currentCslStyle === 'apa') {
      let authorStr = '';
      if (totalAuth === 0) authorStr = 'Anonymous.';
      else if (totalAuth === 1) authorStr = `${parsedAuthors[0].family}, ${parsedAuthors[0].initials}`.trim();
      else if (totalAuth === 2) {
        authorStr = `${parsedAuthors[0].family}, ${parsedAuthors[0].initials}, & ${parsedAuthors[1].family}, ${parsedAuthors[1].initials}`;
      } else if (totalAuth <= 20) {
        const list = parsedAuthors.map((a) => `${a.family}, ${a.initials}`);
        const last = list.pop();
        authorStr = `${list.join(', ')}, & ${last}`;
      } else {
        const list = parsedAuthors.slice(0, 19).map((a) => `${a.family}, ${a.initials}`);
        const last = parsedAuthors[totalAuth - 1];
        authorStr = `${list.join(', ')}, ... ${last.family}, ${last.initials}`;
      }

      const inText =
        totalAuth === 0
          ? `(Anonymous, ${year})`
          : totalAuth === 1
            ? `(${parsedAuthors[0].family}, ${year})`
            : totalAuth === 2
              ? `(${parsedAuthors[0].family} & ${parsedAuthors[1].family}, ${year})`
              : `(${parsedAuthors[0].family} et al., ${year})`;

      const pubParts: string[] = [];
      if (journal) pubParts.push(journal);
      if (volume && issue) pubParts.push(`${volume}(${issue})`);
      else if (volume) pubParts.push(volume);
      if (pages) pubParts.push(pages);
      const pubStr = pubParts.length > 0 ? ` ${pubParts.join(', ')}.` : '';
      const doiStr = doi ? ` https://doi.org/${doi}` : '';

      const bibliography = `${authorStr} (${year}). ${titleTerminated}${pubStr}${doiStr}`.trim();
      const bibliographyHtml = `${authorStr} (${year}). ${titleTerminated}${journal ? ` <i>${journal}</i>` : ''}${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}.${doi ? ` <a href="https://doi.org/${doi}" target="_blank" rel="noreferrer" class="underline">https://doi.org/${doi}</a>` : ''}`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // 2. IEEE
    if (currentCslStyle === 'ieee') {
      const inText = `[1]`;
      const authorList = parsedAuthors.map((a) => `${a.initials} ${a.family}`.trim());
      let authorStr = '';
      if (authorList.length <= 1) authorStr = authorList[0] || 'Anonymous';
      else if (authorList.length === 2) authorStr = `${authorList[0]} and ${authorList[1]}`;
      else if (authorList.length <= 6) {
        const last = authorList.pop();
        authorStr = `${authorList.join(', ')}, and ${last}`;
      } else {
        authorStr = `${authorList[0]} et al.`;
      }

      const pubParts: string[] = [];
      if (journal) pubParts.push(journal);
      if (volume) pubParts.push(`vol. ${volume}`);
      if (issue) pubParts.push(`no. ${issue}`);
      if (pages) pubParts.push(`pp. ${pages}`);
      if (year && year !== 'n.d.') pubParts.push(`${year}`);
      const pubStr = pubParts.length > 0 ? `, ${pubParts.join(', ')}` : '';
      const doiStr = doi ? `, doi: ${doi}` : '';

      const bibliography = `${authorStr}, "${title}"${pubStr}${doiStr}.`.trim();
      const bibliographyHtml = `${authorStr}, "${title},"${journal ? ` <i>${journal}</i>` : ''}${volume ? `, vol. ${volume}` : ''}${issue ? `, no. ${issue}` : ''}${pages ? `, pp. ${pages}` : ''}${year && year !== 'n.d.' ? `, ${year}` : ''}${doi ? `, doi: ${doi}` : ''}.`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // 3. MLA
    if (currentCslStyle === 'mla') {
      const firstAuth = parsedAuthors[0] ? `${parsedAuthors[0].family}, ${parsedAuthors[0].given || parsedAuthors[0].initials}` : 'Anonymous';
      let authorStr = firstAuth;
      if (totalAuth === 2) {
        authorStr = `${firstAuth}, and ${parsedAuthors[1].given || parsedAuthors[1].initials} ${parsedAuthors[1].family}`;
      } else if (totalAuth > 2) {
        authorStr = `${firstAuth}, et al.`;
      }

      const inText = totalAuth <= 1 ? `(${parsedAuthors[0]?.family || 'Anonymous'})` : `(${parsedAuthors[0]?.family || 'Anonymous'} et al.)`;
      const pubParts: string[] = [];
      if (journal) pubParts.push(`<i>${journal}</i>`);
      if (volume) pubParts.push(`vol. ${volume}`);
      if (issue) pubParts.push(`no. ${issue}`);
      if (year && year !== 'n.d.') pubParts.push(year);
      if (pages) pubParts.push(`pp. ${pages}`);
      const pubStr = pubParts.length > 0 ? `, ${pubParts.join(', ')}` : '';
      const doiStr = doi ? `, https://doi.org/${doi}` : '';

      const bibliography = `${authorStr}. "${title}."${pubParts.length > 0 ? ` ${pubParts.map((p) => p.replace(/<[^>]+>/g, '')).join(', ')}` : ''}${doiStr}.`.trim();
      const bibliographyHtml = `${authorStr}. "${title}."${pubStr}${doi ? `, <a href="https://doi.org/${doi}" target="_blank" rel="noreferrer" class="underline">https://doi.org/${doi}</a>` : ''}.`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // 4. Chicago
    if (currentCslStyle === 'chicago') {
      const firstAuth = parsedAuthors[0] ? `${parsedAuthors[0].family}, ${parsedAuthors[0].given || parsedAuthors[0].initials}` : 'Anonymous';
      let authorStr = firstAuth;
      if (totalAuth === 2) {
        authorStr = `${firstAuth}, and ${parsedAuthors[1].given || parsedAuthors[1].initials} ${parsedAuthors[1].family}`;
      } else if (totalAuth === 3) {
        authorStr = `${firstAuth}, ${parsedAuthors[1].given || parsedAuthors[1].initials} ${parsedAuthors[1].family}, and ${parsedAuthors[2].given || parsedAuthors[2].initials} ${parsedAuthors[2].family}`;
      } else if (totalAuth > 3) {
        authorStr = `${firstAuth}, et al.`;
      }
      const inText = totalAuth <= 1 ? `(${parsedAuthors[0]?.family || 'Anonymous'} ${year})` : totalAuth === 2 ? `(${parsedAuthors[0].family} and ${parsedAuthors[1].family} ${year})` : `(${parsedAuthors[0].family} et al. ${year})`;
      const pubParts: string[] = [];
      if (journal) pubParts.push(`"${title}." <i>${journal}</i>`);
      else pubParts.push(`"${title}."`);
      if (volume) pubParts.push(volume);
      if (issue) pubParts.push(`no. ${issue}`);
      if (year && year !== 'n.d.') pubParts.push(`(${year})`);
      if (pages) pubParts.push(`: ${pages}`);
      const pubStr = pubParts.join(' ');
      const doiStr = doi ? ` https://doi.org/${doi}.` : '.';

      const bibliography = `${authorStr}. ${year}. ${titleTerminated} ${pubParts.map((p) => p.replace(/<[^>]+>/g, '')).join(' ')}${doiStr}`.trim();
      const bibliographyHtml = `${authorStr}. ${year}. ${pubStr}${doi ? ` <a href="https://doi.org/${doi}" target="_blank" rel="noreferrer" class="underline">https://doi.org/${doi}</a>` : ''}`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // 5. Nature
    if (currentCslStyle === 'nature') {
      const inText = `1`;
      const authorList = parsedAuthors.map((a) => `${a.family}, ${a.initials}`.trim());
      let authorStr = '';
      if (authorList.length <= 5) {
        if (authorList.length <= 1) authorStr = authorList[0] || 'Anonymous';
        else {
          const last = authorList.pop();
          authorStr = `${authorList.join(', ')} & ${last}`;
        }
      } else {
        authorStr = `${authorList[0]} et al.`;
      }

      const pubParts: string[] = [];
      if (journal) pubParts.push(journal);
      if (volume) pubParts.push(volume);
      if (pages) pubParts.push(pages);
      const pubStr = pubParts.length > 0 ? ` ${pubParts.join(', ')}` : '';

      const bibliography = `${authorStr} ${titleTerminated} ${pubStr} (${year}).`.trim();
      const bibliographyHtml = `${authorStr} ${titleTerminated}${journal ? ` <i>${journal}</i>` : ''}${volume ? ` <b>${volume}</b>` : ''}${pages ? `, ${pages}` : ''} (${year}).`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // 6. Vancouver
    if (currentCslStyle === 'vancouver') {
      const inText = `(1)`;
      const authorList = parsedAuthors.map((a) => `${a.family} ${a.initials.replace(/\./g, '')}`.trim());
      let authorStr = '';
      if (authorList.length <= 6) {
        authorStr = authorList.join(', ');
      } else {
        authorStr = `${authorList.slice(0, 6).join(', ')}, et al.`;
      }
      const pubParts: string[] = [];
      if (journal) pubParts.push(journal);
      if (year && year !== 'n.d.') pubParts.push(`${year}`);
      if (volume && issue) pubParts.push(`${volume}(${issue}):${pages}`);
      else if (volume) pubParts.push(`${volume}:${pages}`);
      else if (pages) pubParts.push(pages);
      const pubStr = pubParts.length > 0 ? `. ${pubParts.join(';')}` : '';
      const doiStr = doi ? ` doi: ${doi}` : '';

      const bibliography = `${authorStr}. ${title}${pubStr}.${doiStr}`.trim();
      const bibliographyHtml = `${authorStr}. ${title}.${journal ? ` <i>${journal}</i>` : ''};${year !== 'n.d.' ? year : ''}${volume ? `;${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `:${pages}` : ''}.${doi ? ` doi: ${doi}` : ''}`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // 7. Harvard & Generic fallback
    const firstAuth = parsedAuthors[0]?.family || 'Anonymous';
    const inText = totalAuth <= 1 ? `(${firstAuth}, ${year})` : `(${firstAuth} et al., ${year})`;
    const authorStr = authors.length > 0 ? authors.join(', ') : 'Anonymous';
    const pubStr = journal ? ` ${journal}.` : '';
    const bibliography = `${authorStr} (${year}). ${titleTerminated}${pubStr}`.trim();
    const bibliographyHtml = `${authorStr} (${year}). ${titleTerminated}${journal ? ` <i>${journal}</i>.` : ''}`.trim();

    return { inText, bibliography, bibliographyHtml };
  }, [parsedAuthors, authors, currentCslStyle, year, title, titleTerminated, journal, volume, issue, pages, doi]);

  // BibTeX string
  const bibtexContent = useMemo(() => {
    const authorStr = parsedAuthors
      .map((a) => `${a.family}, ${a.given || a.initials}`)
      .join(' and ') || 'Unknown';

    const fields: string[] = [
      `  title = {{${escapeBibtex(title)}}}`,
      `  author = {${escapeBibtex(authorStr)}}`,
    ];
    if (journal) fields.push(`  journal = {${escapeBibtex(journal)}}`);
    if (year && year !== 'n.d.') fields.push(`  year = {${year}}`);
    if (volume) fields.push(`  volume = {${escapeBibtex(volume)}}`);
    if (issue) fields.push(`  number = {${escapeBibtex(issue)}}`);
    if (pages) fields.push(`  pages = {${escapeBibtex(pages)}}`);
    if (doi) fields.push(`  doi = {${escapeBibtex(doi)}}`);
    if (url) fields.push(`  url = {${escapeBibtex(url)}}`);

    return `@article{${citeKey},\n${fields.join(',\n')}\n}`;
  }, [citeKey, title, parsedAuthors, journal, year, volume, issue, pages, doi, url]);

  // RIS string
  const risContent = useMemo(() => {
    const lines: string[] = [
      'TY  - JOUR',
      `TI  - ${title}`,
    ];
    parsedAuthors.forEach((a) => {
      lines.push(`AU  - ${a.family}, ${a.given || a.initials}`);
    });
    if (journal) lines.push(`JO  - ${journal}`);
    if (year && year !== 'n.d.') lines.push(`PY  - ${year}`);
    if (volume) lines.push(`VL  - ${volume}`);
    if (issue) lines.push(`IS  - ${issue}`);
    if (pages) lines.push(`SP  - ${pages}`);
    if (doi) lines.push(`DO  - ${doi}`);
    if (url) lines.push(`UR  - ${url}`);
    lines.push('ER  - ');

    return lines.join('\n');
  }, [title, parsedAuthors, journal, year, volume, issue, pages, doi, url]);

  const getContentToCopy = useCallback(() => {
    if (activeFormat === 'bibtex') return bibtexContent;
    if (activeFormat === 'ris') return risContent;
    return cslData?.bibliography || formattedClientCitation.bibliography;
  }, [activeFormat, bibtexContent, risContent, cslData?.bibliography, formattedClientCitation.bibliography]);

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
    const text = cslData?.inText || formattedClientCitation.inText;
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedInText(true);
      toast.success('Copied in-text citation to clipboard', { id: 'library-clipboard' });
      setTimeout(() => setCopiedInText(false), 2000);
    } else {
      toast.error('Failed to copy', { id: 'library-clipboard' });
    }
  }, [cslData?.inText, formattedClientCitation.inText]);

  const handleDownload = useCallback(() => {
    const ext = activeFormat === 'bibtex' ? 'bib' : activeFormat === 'ris' ? 'ris' : 'txt';
    const content = getContentToCopy();
    const filename = `${citeKey || 'reference'}.${ext}`;
    downloadFile(filename, content);
    toast.success(`Exported ${filename}`, { id: 'library-clipboard' });
  }, [citeKey, activeFormat, getContentToCopy]);

  // Preferred order: server formatted HTML -> server plain text -> client high-fidelity fallback HTML
  const rawHtml =
    cslData?.bibliographyHtml ||
    cslData?.html ||
    cslData?.bibliography ||
    formattedClientCitation.bibliographyHtml;

  const sanitizedHtml = useMemo(() => sanitizeCslHtml(rawHtml), [rawHtml]);
  const inTextPreview = cslData?.inText || formattedClientCitation.inText;

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

      {/* Dynamic Adaptive Format Selection Bar: Shows max fitting items, overflow goes into More ▾ */}
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
                'h-6 px-2 text-xs rounded-md cursor-pointer outline-none select-none font-medium shrink-0',
                isSelected
                  ? 'bg-black/10 dark:bg-white/10 text-foreground font-semibold'
                  : 'text-foreground hover:bg-black/5 dark:hover:bg-white/5',
              )}
            >
              {fmt.label}
            </button>
          );
        })}

        {/* More Styles Dropdown (Only rendered if there are overflowing formats) */}
        {moreFormats.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'h-6 px-2 text-xs rounded-md cursor-pointer outline-none select-none font-medium inline-flex items-center gap-1 shrink-0',
                  isMoreFormatActive
                    ? 'bg-black/10 dark:bg-white/10 text-foreground font-semibold'
                    : 'text-foreground hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                <span>{activeMoreFormat ? activeMoreFormat.label : 'More'}</span>
                <ChevronDown className="size-3 text-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="w-36 p-1 bg-popover/95 border border-border/80 rounded-md shadow-none text-xs z-50"
            >
              {moreFormats.map((fmt) => {
                const isSelected = activeFormat === fmt.id;
                return (
                  <DropdownMenuItem
                    key={fmt.id}
                    onSelect={() => setActiveFormat(fmt.id)}
                    onClick={() => setActiveFormat(fmt.id)}
                    className={cn(
                      'h-7.5 px-2 text-xs cursor-pointer rounded-md hover:bg-black/5 dark:hover:bg-white/5 outline-none flex items-center justify-between',
                      isSelected
                        ? 'font-medium text-foreground bg-black/10 dark:bg-white/10'
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

      {/* In-Text Citation Preview Row (Academic styles only) */}
      {!isExportFormat && inTextPreview && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border/60 bg-transparent text-xs">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="text-muted-foreground text-[11px] shrink-0 font-medium">In-text</span>
            <span className="font-mono text-[11px] text-foreground truncate select-text">
              {inTextPreview}
            </span>
          </div>
          <TooltipProvider delayDuration={700}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopyInText}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                  aria-label="Copy in-text citation"
                >
                  {copiedInText ? (
                    <Check className="size-3.5 text-foreground" />
                  ) : (
                    <Copy className="size-3.5 text-foreground" />
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
      <div className="group relative rounded-md border border-border/60 p-2.5 bg-transparent min-h-[80px] max-h-56 overflow-y-auto text-xs leading-relaxed select-text font-sans">
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
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Download citation"
                >
                  <Download className="size-3.5 text-foreground" />
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
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Copy citation"
                >
                  {copied ? (
                    <Check className="size-3.5 text-foreground" />
                  ) : (
                    <Copy className="size-3.5 text-foreground" />
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
          {activeFormat === 'bibtex' ? (
            <pre className="font-mono text-xs text-foreground whitespace-pre select-text overflow-x-auto leading-relaxed">
              {bibtexContent}
            </pre>
          ) : activeFormat === 'ris' ? (
            <pre className="font-mono text-xs text-foreground whitespace-pre select-text overflow-x-auto leading-relaxed">
              {risContent}
            </pre>
          ) : (
            <div>
              {isLoading && !sanitizedHtml ? (
                <div className="space-y-1.5 py-1">
                  <div className="h-3 bg-muted/60 rounded animate-pulse w-full" />
                  <div className="h-3 bg-muted/60 rounded animate-pulse w-5/6" />
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
