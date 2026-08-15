'use client';

import React, { useState } from 'react';
import { ExternalLink, Edit3, Check, X, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Textarea } from '@/shared/components/ui';
import { useReferences } from '@/features/workspaces/library/hooks/data/use-references';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface InfoSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

function DetailRow({
  label,
  value,
  href,
  children,
}: {
  label: string;
  value?: string | number | null;
  href?: string;
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;

  return (
    <div className="flex items-start py-1.5 text-xs border-b border-border/20 last:border-0">
      <span className="w-24 shrink-0 font-medium text-muted-foreground select-none pr-2 pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0 font-normal text-foreground">
        {children ? (
          children
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <span className="break-words">{value}</span>
        )}
      </div>
    </div>
  );
}

export default function InfoSection({ paper, onUpdatePaper }: InfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(paper.title || '');
  const [authors, setAuthors] = useState(paper.authors?.join(', ') || '');
  const [journal, setJournal] = useState(paper.journal || '');
  const [year, setYear] = useState(paper.year ? String(paper.year) : '');
  const [doi, setDoi] = useState(paper.doi || '');
  const [abstract, setAbstract] = useState(paper.abstract || '');
  const [volume, setVolume] = useState(paper.volume || '');
  const [issue, setIssue] = useState(paper.issue || '');
  const [pages, setPages] = useState(paper.pages || '');

  const { state: refState, actions: refActions } = useReferences();

  const handleCrawlDoi = async () => {
    const targetDoi = (doi || paper.doi || '').trim();
    if (!targetDoi) {
      toast.error('Please enter a DOI first');
      return;
    }

    try {
      const res = await refActions.lookupDoi(targetDoi);
      const meta = res?.work;
      if (!meta) {
        toast.error('No metadata found for this DOI');
        return;
      }

      if (meta.title) setTitle(meta.title);
      if (meta.authors && meta.authors.length > 0) setAuthors(meta.authors.join(', '));
      if (meta.year) setYear(String(meta.year));
      if (meta.journal || meta.publisher) setJournal(meta.journal || meta.publisher || '');
      if (meta.abstract) setAbstract(meta.abstract);
      if (meta.volume) setVolume(meta.volume);
      if (meta.issue) setIssue(meta.issue);
      if (meta.pages) setPages(meta.pages);

      setIsEditing(true);
      toast.success('Metadata fetched from CrossRef! Please review and save.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to lookup DOI');
    }
  };

  const handleSave = () => {
    if (onUpdatePaper) {
      onUpdatePaper({
        title: title.trim(),
        authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
        journal: journal.trim(),
        year: year ? parseInt(year, 10) || null : null,
        doi: doi.trim(),
        abstract: abstract.trim(),
        volume: volume.trim() || undefined,
        issue: issue.trim() || undefined,
        pages: pages.trim() || undefined,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(paper.title || '');
    setAuthors(paper.authors?.join(', ') || '');
    setJournal(paper.journal || '');
    setYear(paper.year ? String(paper.year) : '');
    setDoi(paper.doi || '');
    setAbstract(paper.abstract || '');
    setVolume(paper.volume || '');
    setIssue(paper.issue || '');
    setPages(paper.pages || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/40 text-xs">
        <div className="flex items-center justify-between pb-1 border-b border-border/30">
          <span className="font-semibold text-foreground">Edit Metadata</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 px-2 text-xs">
              <X className="size-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2 text-xs">
              <Check className="size-3.5 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Authors (comma separated)</label>
            <Input value={authors} onChange={(e) => setAuthors(e.target.value)} className="h-8 text-xs mt-0.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Year</label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} className="h-8 text-xs mt-0.5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-muted-foreground">DOI</label>
                <button
                  type="button"
                  onClick={handleCrawlDoi}
                  disabled={refState.isLookingUp}
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  {refState.isLookingUp ? <Loader2 className="size-2.5 animate-spin" /> : <Sparkles className="size-2.5" />}
                  <span>Auto-fill</span>
                </button>
              </div>
              <Input value={doi} onChange={(e) => setDoi(e.target.value)} className="h-8 text-xs mt-0.5" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Journal / Publisher</label>
            <Input value={journal} onChange={(e) => setJournal(e.target.value)} className="h-8 text-xs mt-0.5" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Volume</label>
              <Input value={volume} onChange={(e) => setVolume(e.target.value)} className="h-8 text-xs mt-0.5" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Issue</label>
              <Input value={issue} onChange={(e) => setIssue(e.target.value)} className="h-8 text-xs mt-0.5" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Pages</label>
              <Input value={pages} onChange={(e) => setPages(e.target.value)} className="h-8 text-xs mt-0.5" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Abstract</label>
            <Textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={4}
              className="text-xs mt-0.5 resize-none"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action to Edit */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Item Details</span>
        <div className="flex items-center gap-2">
          {paper.doi && (
            <button
              onClick={handleCrawlDoi}
              disabled={refState.isLookingUp}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium disabled:opacity-50"
              title="Re-fetch metadata from CrossRef via DOI"
            >
              {refState.isLookingUp ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              <span>Crawl DOI</span>
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            <Edit3 className="size-3" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Fields List */}
      <div className="flex flex-col">
        <DetailRow label="Item Type" value={paper.itemType || 'Journal Article'} />
        <DetailRow label="Title" value={paper.title} />
        <DetailRow label="Author(s)" value={paper.authors?.join('; ')} />
        <DetailRow label="Publication" value={paper.journal || paper.publisher} />
        <DetailRow label="Date / Year" value={paper.year} />
        <DetailRow
          label="DOI"
          value={paper.doi}
          href={paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : undefined}
        />
        {paper.url && <DetailRow label="URL" value={paper.url} href={paper.url} />}
        {paper.volume && <DetailRow label="Volume" value={paper.volume} />}
        {paper.issue && <DetailRow label="Issue" value={paper.issue} />}
        {paper.pages && <DetailRow label="Pages" value={paper.pages} />}
        {paper.issn && <DetailRow label="ISSN" value={paper.issn} />}
        {paper.isbn && <DetailRow label="ISBN" value={paper.isbn} />}
      </div>

      {/* Abstract */}
      {paper.abstract && (
        <div className="pt-2 border-t border-border/20">
          <span className="block text-[11px] font-medium text-muted-foreground mb-1">Abstract</span>
          <p className="text-xs text-foreground/80 leading-relaxed max-h-48 overflow-y-auto bg-muted/20 p-2.5 rounded-md border border-border/30">
            {paper.abstract}
          </p>
        </div>
      )}
    </div>
  );
}
