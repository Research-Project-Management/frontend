'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Calendar,
  Layers,
  FileText,
  Link2,
  Sparkles,
  Quote,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Badge } from "@/shared/components/ui";
import { Separator } from "@/shared/components/ui";
import { copyToClipboard } from "@/shared/lib/utils";
import { toast } from 'sonner';
import { cleanDoi as sanitizeDoi, normalizeAuthors } from '../../utils/reader.util';
import type { ReaderDocument } from '../../types/reader.types';

interface DocInfoPanelProps {
  paper: ReaderDocument;
}

export default function DocInfoPanel({ paper }: DocInfoPanelProps) {
  const [copiedDoi, setCopiedDoi] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

  const authors = normalizeAuthors(paper.authors, paper.creators);
  const cleanDoi = sanitizeDoi(paper.doi);
  const doiUrl = cleanDoi ? `https://doi.org/${cleanDoi}` : null;

  const handleCopyDoi = async () => {
    if (!cleanDoi) return;
    const ok = await copyToClipboard(cleanDoi);
    if (ok) {
      toast.success('DOI copied to clipboard', { id: 'reader-clipboard' });
      setCopiedDoi(true);
      setTimeout(() => setCopiedDoi(false), 2000);
    }
  };

  const handleCopyTitle = async () => {
    if (!paper.title) return;
    const ok = await copyToClipboard(paper.title);
    if (ok) {
      toast.success('Title copied to clipboard', { id: 'reader-clipboard' });
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    }
  };

  const abstractText = paper.abstract?.trim();
  const isLongAbstract = (abstractText?.length ?? 0) > 280;

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Title block */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-11 font-mono text-muted-foreground">
          <span>Document Title</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyTitle}
            className="size-6 text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
            title="Copy title"
            aria-label="Copy document title"
          >
            {copiedTitle ? <Check className="size-3 text-primary shrink-0" /> : <Copy className="size-3 shrink-0" />}
          </Button>
        </div>
        <h2 className="text-sm font-semibold leading-snug text-foreground">
          {paper.title || 'Untitled Document'}
        </h2>
      </div>

      {/* Authors list */}
      {authors.length > 0 && (
        <div className="space-y-1">
          <span className="text-11 font-mono text-muted-foreground">
            Authors
          </span>
          <p className="text-xs text-foreground/90 leading-relaxed">
            {authors.join(', ')}
          </p>
        </div>
      )}

      {/* Badges / Quick specs */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {paper.itemType && (
          <Badge variant="outline" className="text-10 font-mono capitalize px-1.5 py-0 border-border">
            {paper.itemType}
          </Badge>
        )}
        {paper.year && (
          <Badge variant="outline" className="text-10 font-mono px-1.5 py-0 border-border">
            {paper.year}
          </Badge>
        )}
        {paper.citationCount !== undefined && paper.citationCount > 0 && (
          <Badge variant="outline" className="text-10 font-mono px-1.5 py-0 border-border">
            {paper.citationCount} citations
          </Badge>
        )}
        {paper.ragStatus === 'indexed' && (
          <Badge variant="secondary" className="text-10 font-mono px-1.5 py-0 bg-primary/10 text-primary border border-primary/20">
            AI Indexed
          </Badge>
        )}
      </div>

      <Separator className="bg-border/60" />

      {/* Abstract */}
      {abstractText && (
        <div className="space-y-1.5">
          <span className="text-11 font-mono text-muted-foreground">
            Abstract
          </span>
          <div className="rounded-md bg-muted p-2.5 border border-border text-foreground/80 leading-relaxed">
            <p className={!isAbstractExpanded && isLongAbstract ? 'line-clamp-4' : ''}>
              {abstractText}
            </p>
            {isLongAbstract && (
              <button
                type="button"
                onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
                className="mt-1.5 text-11 font-medium text-primary hover:underline focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded-sm cursor-pointer"
              >
                {isAbstractExpanded ? 'Show less' : 'Read full abstract'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Structured publication metadata */}
      <div className="space-y-2 pt-1">
        <span className="text-11 font-mono text-muted-foreground">
          Publication Details
        </span>
        <div className="divide-y divide-border/40 rounded-md border border-border bg-card">
          {(paper.journal || paper.publicationTitle) && (
            <div className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground shrink-0 flex items-center gap-1.5">
                <BookOpen className="size-3 text-muted-foreground/70 shrink-0" />
                Journal / Venue
              </span>
              <span className="font-medium text-right text-foreground truncate max-w-[200px]">
                {paper.journal || paper.publicationTitle}
              </span>
            </div>
          )}

          {paper.publisher && (
            <div className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground shrink-0 flex items-center gap-1.5">
                <Layers className="size-3 text-muted-foreground/70 shrink-0" />
                Publisher
              </span>
              <span className="font-medium text-right text-foreground">
                {paper.publisher}
              </span>
            </div>
          )}

          {(paper.volume || paper.issue || paper.pages) && (
            <div className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground shrink-0 flex items-center gap-1.5">
                <FileText className="size-3 text-muted-foreground/70 shrink-0" />
                Vol / Issue / Pages
              </span>
              <span className="font-mono text-right text-foreground">
                {[
                  paper.volume ? `Vol. ${paper.volume}` : null,
                  paper.issue ? `No. ${paper.issue}` : null,
                  paper.pages ? `pp. ${paper.pages}` : null,
                ].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {cleanDoi && (
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground shrink-0 flex items-center gap-1.5">
                <Quote className="size-3 text-muted-foreground/70 shrink-0" />
                DOI
              </span>
              <div className="flex items-center gap-1 max-w-[210px]">
                <a
                  href={doiUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-11 text-primary hover:underline truncate focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded-sm"
                  title={cleanDoi}
                >
                  {cleanDoi}
                </a>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopyDoi}
                  className="size-5 shrink-0 text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
                  title="Copy DOI"
                  aria-label="Copy DOI"
                >
                  {copiedDoi ? <Check className="size-2.5 text-primary shrink-0" /> : <Copy className="size-2.5 shrink-0" />}
                </Button>
              </div>
            </div>
          )}

          {paper.url && (
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground shrink-0 flex items-center gap-1.5">
                <Link2 className="size-3 text-muted-foreground/70 shrink-0" />
                URL
              </span>
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-11 text-primary hover:underline truncate max-w-[210px] inline-flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded-sm"
                title={paper.url}
              >
                <span className="truncate">{paper.url.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="size-2.5 shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
