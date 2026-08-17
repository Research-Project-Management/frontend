'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface CiteSectionProps {
  paper: Paper;
}

type CitationStyle = 'apa' | 'ieee' | 'bibtex' | 'harvard' | 'mla' | 'chicago';

export default function CiteSection({ paper }: CiteSectionProps) {
  const [activeStyle, setActiveStyle] = useState<CitationStyle>('apa');
  const [copied, setCopied] = useState(false);

  const authorsStr = paper.authors?.join(', ') || 'Unknown Author';
  const firstAuthor = paper.authors?.[0] || 'Author';
  const lastAuthorName = firstAuthor.split(' ').pop() || 'Author';
  const yearStr = paper.year ? String(paper.year) : 'n.d.';
  const journalStr = paper.journal || paper.publisher || 'Journal';
  const titleStr = paper.title || 'Untitled';
  const doiStr = paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : '';
  const citeKey = paper.citationKey || `${lastAuthorName.toLowerCase()}${paper.year || '2024'}`;

  const citations: Record<CitationStyle, string> = {
    apa: `${authorsStr} (${yearStr}). ${titleStr}. ${journalStr}.${doiStr ? ` ${doiStr}` : ''}`,
    ieee: `${authorsStr}, "${titleStr}," ${journalStr}, ${yearStr}.${doiStr ? ` doi: ${paper.doi}.` : ''}`,
    bibtex: `@article{${citeKey},
  title = {${titleStr}},
  author = {${paper.authors?.join(' and ') || authorsStr}},
  journal = {${journalStr}},
  year = {${yearStr}},
  doi = {${paper.doi || ''}}
}`,
    harvard: `${authorsStr} (${yearStr}) '${titleStr}', ${journalStr}.${doiStr ? ` Available at: ${doiStr}` : ''}`,
    mla: `${authorsStr}. "${titleStr}." ${journalStr}, ${yearStr}.${doiStr ? ` DOI: ${paper.doi}.` : ''}`,
    chicago: `${authorsStr}. "${titleStr}." ${journalStr} (${yearStr}).${doiStr ? ` ${doiStr}` : ''}`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(citations[activeStyle]);
    setCopied(true);
    toast.success(`Copied ${activeStyle.toUpperCase()} citation`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Quick Citations
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-7 px-2.5 text-xs gap-1.5 shadow-xs cursor-pointer"
        >
          {copied ? <Check className="size-3 text-foreground" /> : <Copy className="size-3 text-foreground" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      {/* Style selector pills */}
      <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg border border-border/40 select-none overflow-x-auto">
        {(['apa', 'ieee', 'bibtex', 'harvard', 'mla', 'chicago'] as CitationStyle[]).map((style) => (
          <button
            key={style}
            onClick={() => setActiveStyle(style)}
            className={cn(
              'flex-1 py-1 px-1.5 text-[10px] font-medium rounded-md uppercase transition-all cursor-pointer truncate',
              activeStyle === style
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {style}
          </button>
        ))}
      </div>

      {/* Citation preview card */}
      <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-xs">
        {activeStyle === 'bibtex' ? (
          <pre className="font-mono text-[11px] text-foreground/90 whitespace-pre-wrap leading-relaxed overflow-x-auto bg-background/50 p-2.5 rounded border border-border/30">
            {citations.bibtex}
          </pre>
        ) : (
          <p className="text-foreground/90 leading-relaxed font-serif text-[12.5px]">
            {citations[activeStyle]}
          </p>
        )}
      </div>
    </div>
  );
}
