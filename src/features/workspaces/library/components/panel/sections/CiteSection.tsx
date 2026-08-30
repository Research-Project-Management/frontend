'use client';

import React, { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useCslCitation } from '@/features/workspaces/library/hooks/library/use-library';
import type { Paper, CslStyle } from '@/features/workspaces/library/types/library.types';
import { getPaperCitationKey, normalizeAuthors } from '@/features/workspaces/library/utils/library.util';

interface CiteSectionProps {
  paper: Paper;
  workspaceId?: string;
}

type TabMode = 'bibliography' | 'intext' | 'bibtex' | 'ris';

const CSL_STYLES: Array<{ id: CslStyle; label: string; name: string }> = [
  { id: 'apa', label: 'APA', name: 'American Psychological Association (7th ed.)' },
  { id: 'ieee', label: 'IEEE', name: 'Institute of Electrical and Electronics Engineers' },
  { id: 'mla', label: 'MLA', name: 'Modern Language Association (9th ed.)' },
  { id: 'chicago', label: 'Chicago', name: 'Chicago Manual of Style (17th ed.)' },
  { id: 'harvard', label: 'Harvard', name: 'Harvard Reference Format' },
  { id: 'nature', label: 'Nature', name: 'Nature Publishing Group' },
  { id: 'vancouver', label: 'Vancouver', name: 'Vancouver Style' },
];

/** Parse an author string into given and family names */
function parseAuthor(name: string): { given: string; family: string; initials: string } {
  const trimmed = (name || '').trim();
  if (!trimmed) return { given: '', family: 'Anonymous', initials: 'A.' };

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((s) => s.trim());
    const family = parts[0] || 'Anonymous';
    const given = parts.slice(1).join(' ') || '';
    const initials = given
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w[0].toUpperCase()}.`)
      .join(' ');
    return { given, family, initials: initials || `${family[0]?.toUpperCase() || 'A'}.` };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { given: '', family: parts[0], initials: `${parts[0][0]?.toUpperCase() || 'A'}.` };
  }

  const family = parts.pop() || 'Anonymous';
  const given = parts.join(' ');
  const initials = parts
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(' ');
  return { given, family, initials: initials || `${family[0]?.toUpperCase() || 'A'}.` };
}

/** Clean title by stripping trailing dots and spaces */
function cleanTitle(title?: string): string {
  return (title || 'Untitled Reference').trim().replace(/[.\s]+$/, '');
}

export default function CiteSection({ paper, workspaceId }: CiteSectionProps) {
  const [activeStyle, setActiveStyle] = useState<CslStyle>('apa');
  const [tabMode, setTabMode] = useState<TabMode>('bibliography');
  const [copied, setCopied] = useState(false);

  const targetWsId = workspaceId || paper.workspaceId || '';
  const { data: cslData, isLoading } = useCslCitation(
    targetWsId,
    paper.id || '',
    activeStyle,
  );

  const citeKey = getPaperCitationKey(paper);
  const paperAuthors = paper.authors;
  const paperCreators = (paper as any)?.creators;
  const authors = useMemo(
    () => normalizeAuthors(paperAuthors, paperCreators),
    [paperAuthors, paperCreators],
  );
  const parsedAuthors = useMemo(() => authors.map(parseAuthor), [authors]);

  const year = paper.year || (paper.createdAt ? new Date(paper.createdAt).getFullYear() : 'n.d.');
  const title = cleanTitle(paper.title);
  const journal = (paper.journal || paper.publicationTitle || paper.publisher || '').trim().replace(/[.\s]+$/, '');
  const volume = (paper.volume || '').trim();
  const issue = (paper.issue || '').trim();
  const pages = (paper.pages || '').trim();
  const doi = (paper.doi || '').trim();
  const url = (paper.url || (doi ? `https://doi.org/${doi}` : '')).trim();

  // ── High-Fidelity Client CSL Fallback Formatters ──────────────────────────────
  const formattedClientCitation = useMemo(() => {
    const totalAuth = parsedAuthors.length;

    // APA 7th
    if (activeStyle === 'apa') {
      let authorStr = '';
      if (totalAuth === 0) authorStr = 'Anonymous.';
      else if (totalAuth === 1) authorStr = `${parsedAuthors[0].family}, ${parsedAuthors[0].initials}`;
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

      const bibliography = `${authorStr} (${year}). ${title}.${pubStr}${doiStr}`.trim();
      const bibliographyHtml = `${authorStr} (${year}). ${title}.${journal ? ` <i>${journal}</i>` : ''}${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}.${doi ? ` <a href="https://doi.org/${doi}" target="_blank" class="text-primary hover:underline">https://doi.org/${doi}</a>` : ''}`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // IEEE
    if (activeStyle === 'ieee') {
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
      if (year) pubParts.push(`${year}`);
      const pubStr = pubParts.length > 0 ? `, ${pubParts.join(', ')}` : '';
      const doiStr = doi ? `, doi: ${doi}` : '';

      const bibliography = `${authorStr}, "${title}"${pubStr}${doiStr}.`.trim();
      const bibliographyHtml = `${authorStr}, "${title},"${journal ? ` <i>${journal}</i>` : ''}${volume ? `, vol. ${volume}` : ''}${issue ? `, no. ${issue}` : ''}${pages ? `, pp. ${pages}` : ''}, ${year}${doi ? `, doi: ${doi}` : ''}.`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // Nature
    if (activeStyle === 'nature') {
      const inText = `1`;
      const authorList = parsedAuthors.map((a) => `${a.family}, ${a.initials}`);
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

      const bibliography = `${authorStr} ${title}. ${pubStr} (${year}).`.trim();
      const bibliographyHtml = `${authorStr} ${title}.${journal ? ` <i>${journal}</i>` : ''}${volume ? ` <b>${volume}</b>` : ''}${pages ? `, ${pages}` : ''} (${year}).`.trim();

      return { inText, bibliography, bibliographyHtml };
    }

    // Default / Harvard / Chicago / MLA fallback
    const firstAuth = parsedAuthors[0]?.family || 'Anonymous';
    const inText = totalAuth <= 1 ? `(${firstAuth}, ${year})` : `(${firstAuth} et al., ${year})`;
    const authorStr = authors.length > 0 ? authors.join(', ') : 'Anonymous';
    const pubStr = journal ? ` ${journal}.` : '';
    const bibliography = `${authorStr} (${year}). ${title}.${pubStr}`.trim();
    const bibliographyHtml = `${authorStr} (${year}). ${title}.${journal ? ` <i>${journal}</i>.` : ''}`.trim();

    return { inText, bibliography, bibliographyHtml };
  }, [parsedAuthors, authors, activeStyle, year, title, journal, volume, issue, pages, doi]);

  // BibTeX string
  const bibtexContent = useMemo(() => {
    const authorStr = parsedAuthors
      .map((a) => `${a.family}, ${a.given || a.initials}`)
      .join(' and ') || 'Unknown';

    const fields: string[] = [
      `  title = {${title}}`,
      `  author = {${authorStr}}`,
    ];
    if (journal) fields.push(`  journal = {${journal}}`);
    if (year && year !== 'n.d.') fields.push(`  year = {${year}}`);
    if (volume) fields.push(`  volume = {${volume}}`);
    if (issue) fields.push(`  number = {${issue}}`);
    if (pages) fields.push(`  pages = {${pages}}`);
    if (doi) fields.push(`  doi = {${doi}}`);
    if (url) fields.push(`  url = {${url}}`);

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

  const getContentToCopy = () => {
    if (tabMode === 'bibtex') return bibtexContent;
    if (tabMode === 'ris') return risContent;
    if (tabMode === 'intext') return cslData?.inText || formattedClientCitation.inText;
    return cslData?.bibliography || formattedClientCitation.bibliography;
  };

  const handleCopy = () => {
    const text = getContentToCopy();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Copied ${tabMode === 'bibliography' || tabMode === 'intext' ? activeStyle.toUpperCase() : tabMode.toUpperCase()} citation`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 min-w-0">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">
          Citations
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-7 px-2.5 text-xs gap-1.5 shadow-none cursor-pointer rounded-md hover:bg-muted"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-foreground" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      {/* Mode Tabs: Bibliography | In-Text | BibTeX | RIS */}
      <div
        role="tablist"
        aria-label="Citation format modes"
        className="grid grid-cols-4 gap-1 p-0.5 bg-muted/40 rounded-md border border-border/40 select-none text-foreground"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tabMode === 'bibliography'}
          onClick={() => setTabMode('bibliography')}
          className={cn(
            'py-1 px-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none text-foreground',
            tabMode === 'bibliography'
              ? 'bg-background shadow-none font-medium'
              : 'hover:bg-muted/50',
          )}
        >
          Bibliography
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabMode === 'intext'}
          onClick={() => setTabMode('intext')}
          className={cn(
            'py-1 px-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none text-foreground',
            tabMode === 'intext'
              ? 'bg-background shadow-none font-medium'
              : 'hover:bg-muted/50',
          )}
        >
          In-Text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabMode === 'bibtex'}
          onClick={() => setTabMode('bibtex')}
          className={cn(
            'py-1 px-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none text-foreground',
            tabMode === 'bibtex'
              ? 'bg-background shadow-none font-medium'
              : 'hover:bg-muted/50',
          )}
        >
          BibTeX
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabMode === 'ris'}
          onClick={() => setTabMode('ris')}
          className={cn(
            'py-1 px-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none text-foreground',
            tabMode === 'ris'
              ? 'bg-background shadow-none font-medium'
              : 'hover:bg-muted/50',
          )}
        >
          RIS
        </button>
      </div>

      {/* CSL Style Selector Pills (Only for Bibliography & In-Text) */}
      {(tabMode === 'bibliography' || tabMode === 'intext') && (
        <div
          role="radiogroup"
          aria-label="Citation styles"
          className="flex items-center gap-1 p-1 bg-muted/20 rounded-md border border-border/40 select-none overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-foreground"
        >
          {CSL_STYLES.map((style) => {
            const isSelected = activeStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setActiveStyle(style.id)}
                title={style.name}
                className={cn(
                  'flex-1 py-1 px-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer truncate text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none shrink-0 min-w-12 text-foreground',
                  isSelected
                    ? 'bg-muted font-semibold border border-border/60 shadow-none'
                    : 'hover:bg-muted/50',
                )}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Citation Preview Container */}
      <div className="p-3 bg-muted/20 rounded-md border border-border/40 text-xs min-w-0">
        {tabMode === 'bibtex' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>BibTeX Entry</span>
              <span className="text-xs text-muted-foreground/80">@{citeKey}</span>
            </div>
            <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap break-all leading-relaxed bg-background/80 p-3 rounded-md border border-border/30 overflow-x-auto select-text">
              {bibtexContent}
            </pre>
          </div>
        ) : tabMode === 'ris' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>RIS Format</span>
              <span className="text-xs text-muted-foreground/80">EndNote / Zotero</span>
            </div>
            <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap break-all leading-relaxed bg-background/80 p-3 rounded-md border border-border/30 overflow-x-auto select-text">
              {risContent}
            </pre>
          </div>
        ) : tabMode === 'intext' ? (
          <div className="p-3 bg-background/80 rounded-md border border-border/30 space-y-1">
            <span className="text-xs font-medium text-muted-foreground block">
              In-Text Citation ({activeStyle.toUpperCase()}):
            </span>
            <p className="text-foreground font-mono text-sm font-semibold select-text">
              {cslData?.inText || formattedClientCitation.inText}
            </p>
          </div>
        ) : (
          <div className="p-3 bg-background/80 rounded-md border border-border/30 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Formatted Reference ({activeStyle.toUpperCase()}):</span>
            </div>
            {isLoading && !cslData ? (
              <div className="space-y-1.5 py-1">
                <div className="h-4 bg-muted/60 rounded animate-pulse w-full" />
                <div className="h-4 bg-muted/60 rounded animate-pulse w-3/4" />
              </div>
            ) : cslData?.html ? (
              <div
                className="text-foreground/90 leading-relaxed font-serif text-sm break-words select-text [&>i]:italic [&>b]:font-semibold"
                dangerouslySetInnerHTML={{
                  __html: cslData.html || formattedClientCitation.bibliographyHtml,
                }}
              />
            ) : (
              <div
                className="text-foreground/90 leading-relaxed font-serif text-sm break-words select-text [&>i]:italic [&>b]:font-semibold"
                dangerouslySetInnerHTML={{
                  __html: formattedClientCitation.bibliographyHtml,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
