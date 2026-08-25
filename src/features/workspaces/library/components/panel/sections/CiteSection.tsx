'use client';

import React, { useState } from 'react';
import { Copy, Check, FileCode, BookOpen, Quote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useCslCitation } from '@/features/workspaces/library/hooks/library/use-library';
import type { Paper, CslStyle } from '@/features/workspaces/library/types/library.types';
import { getPaperCitationKey } from '@/features/workspaces/library/utils/library.util';

interface CiteSectionProps {
  paper: Paper;
  workspaceId?: string;
}

type TabMode = 'bibliography' | 'intext' | 'bibtex' | 'ris';

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
  const bibtexContent = `@article{${citeKey},
  title = {${paper.title || 'Untitled'}},
  author = {${paper.authors?.join(' and ') || 'Unknown'}},
  journal = {${paper.journal || paper.publisher || ''}},
  year = {${paper.year || ''}},
  doi = {${paper.doi || ''}}
}`;

  const risContent = `TY  - JOUR
TI  - ${paper.title || 'Untitled'}
${paper.authors?.map((a) => `AU  - ${a}`).join('\n') || 'AU  - Unknown'}
PY  - ${paper.year || ''}
DO  - ${paper.doi || ''}
JO  - ${paper.journal || paper.publisher || ''}
ER  - `;

  const getContentToCopy = () => {
    if (tabMode === 'bibtex') return bibtexContent;
    if (tabMode === 'ris') return risContent;
    if (tabMode === 'intext') return cslData?.inText || `(${paper.authors?.[0] || 'Author'}, ${paper.year || 'n.d.'})`;
    return cslData?.bibliography || `${paper.authors?.join(', ')} (${paper.year || 'n.d.'}). ${paper.title}. ${paper.journal || ''}.`;
  };

  const handleCopy = () => {
    const text = getContentToCopy();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Copied ${tabMode.toUpperCase()} (${activeStyle.toUpperCase()})`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Quote className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Academic Citations
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-7 px-2.5 text-xs gap-1.5 shadow-xs cursor-pointer"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-foreground" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      {/* Mode Tabs: Bibliography | In-Text | BibTeX | RIS */}
      <div
        role="tablist"
        aria-label="Citation format modes"
        className="grid grid-cols-4 gap-1 p-0.5 bg-muted/40 rounded-lg border border-border/40 select-none"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tabMode === 'bibliography'}
          onClick={() => setTabMode('bibliography')}
          className={cn(
            'py-1 px-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
            tabMode === 'bibliography'
              ? 'bg-background text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
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
            'py-1 px-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
            tabMode === 'intext'
              ? 'bg-background text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
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
            'py-1 px-1.5 text-[11px] font-mono rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
            tabMode === 'bibtex'
              ? 'bg-background text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
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
            'py-1 px-1.5 text-[11px] font-mono rounded-md transition-colors cursor-pointer text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
            tabMode === 'ris'
              ? 'bg-background text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          RIS
        </button>
      </div>

      {/* CSL Style selector pills (Only for Bibliography & In-Text) */}
      {(tabMode === 'bibliography' || tabMode === 'intext') && (
        <div
          role="radiogroup"
          aria-label="CSL citation styles"
          className="flex items-center gap-1 p-0.5 bg-muted/20 rounded-lg border border-border/30 select-none overflow-x-auto"
        >
          {(['apa', 'ieee', 'nature', 'harvard', 'chicago', 'mla', 'vancouver'] as CslStyle[]).map(
            (style) => (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={activeStyle === style}
                onClick={() => setActiveStyle(style)}
                className={cn(
                  'flex-1 py-0.5 px-1 text-[10px] font-mono font-medium rounded uppercase transition-colors cursor-pointer truncate text-center focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                  activeStyle === style
                    ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {style}
              </button>
            ),
          )}
        </div>
      )}

      {/* Citation preview card */}
      <div className="p-3 bg-muted/20 rounded-lg border border-border/40 text-xs min-w-0">
        {tabMode === 'bibtex' ? (
          <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap break-all leading-relaxed bg-background/60 p-2.5 rounded border border-border/30 overflow-x-auto select-text">
            {bibtexContent}
          </pre>
        ) : tabMode === 'ris' ? (
          <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap break-all leading-relaxed bg-background/60 p-2.5 rounded border border-border/30 overflow-x-auto select-text">
            {risContent}
          </pre>
        ) : tabMode === 'intext' ? (
          <div className="p-2 bg-background/60 rounded border border-border/30">
            <span className="text-[11px] text-muted-foreground block mb-1">In-Text Citation:</span>
            <p className="text-foreground font-mono text-xs font-semibold select-text">
              {cslData?.inText || `(${paper.authors?.[0] || 'Author'}, ${paper.year || 'n.d.'})`}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {isLoading ? (
              <div className="h-10 animate-pulse bg-muted/40 rounded" />
            ) : cslData?.html ? (
              <div
                className="text-foreground/90 leading-relaxed font-serif text-sm break-words select-text [&>i]:italic [&>b]:font-bold"
                dangerouslySetInnerHTML={{ __html: cslData.html }}
              />
            ) : (
              <p className="text-foreground/90 leading-relaxed font-serif text-sm break-words select-text">
                {cslData?.bibliography || `${paper.authors?.join(', ')} (${paper.year || 'n.d.'}). ${paper.title}. ${paper.journal || ''}.`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
