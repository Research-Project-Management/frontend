'use client';

import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Edit3,
  Check,
  X,
  RefreshCw,
  Loader2,
  Copy,
  Sparkles,
  BookOpen,
  Quote,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { resolveAcademicQuery } from '@/features/workspaces/library/services/reference.service';
import type { Paper } from '@/features/workspaces/library/types/library.types';
import { Badge } from '@/shared/components/ui/badge';

interface InfoSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

function DetailRow({
  label,
  value,
  href,
  mono,
  children,
}: {
  label: string;
  value?: string | number | null;
  href?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;

  return (
    <div className="flex items-start py-2 text-xs border-b border-border/20 last:border-0">
      <span className="w-24 shrink-0 font-medium text-muted-foreground select-none pr-2 pt-0.5">
        {label}
      </span>
      <div
        className={cn(
          'flex-1 min-w-0 font-normal text-foreground leading-relaxed select-text',
          mono && 'font-mono text-xs',
        )}
      >
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
  const paperId = paper.id;

  const [isEditing, setIsEditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const [title, setTitle] = useState(paper.title || '');
  const [authors, setAuthors] = useState(paper.authors?.join(', ') || '');
  const [journal, setJournal] = useState(paper.journal || '');
  const [publisher, setPublisher] = useState(paper.publisher || '');
  const [year, setYear] = useState(paper.year ? String(paper.year) : '');
  const [doi, setDoi] = useState(paper.doi || '');
  const [abstract, setAbstract] = useState(paper.abstract || '');
  const [volume, setVolume] = useState(paper.volume || '');
  const [issue, setIssue] = useState(paper.issue || '');
  const [pages, setPages] = useState(paper.pages || '');
  const [itemType, setItemType] = useState(paper.itemType || 'journalArticle');

  // Synchronize internal state when paper changes
  useEffect(() => {
    setTitle(paper.title || '');
    setAuthors(paper.authors?.join(', ') || '');
    setJournal(paper.journal || '');
    setPublisher(paper.publisher || '');
    setYear(paper.year ? String(paper.year) : '');
    setDoi(paper.doi || '');
    setAbstract(paper.abstract || '');
    setVolume(paper.volume || '');
    setIssue(paper.issue || '');
    setPages(paper.pages || '');
    setItemType(paper.itemType || 'journalArticle');
    setIsEditing(false);
  }, [paperId]);

  // Determine if title is a raw arXiv ID (e.g. 1706.03762 or 1810.04805v2)
  const isRawArxivTitle = /^\d{4}\.\d{4,5}(v\d+)?$/i.test(paper.title || '');
  const isMissingMetadata = !paper.authors?.length || !paper.year || isRawArxivTitle;

  const handleAutoResolveMetadata = async () => {
    const query = (paper.doi || paper.title || paper.filename || '').trim();
    if (!query) {
      toast.error('No DOI, arXiv ID, or title available to resolve metadata');
      return;
    }

    setIsResolving(true);
    try {
      const res = await resolveAcademicQuery(query);
      if (res && res.metadata && res.metadata.title) {
        const meta = res.metadata;
        const nextTitle = meta.title || title;
        const nextAuthors = meta.authors || (authors ? authors.split(',').map((a) => a.trim()).filter(Boolean) : []);
        const nextJournal = meta.journal || journal;
        const nextPublisher = meta.publisher || publisher;
        const nextYear = meta.year ? String(meta.year) : year;
        const nextDoi = meta.doi || doi;
        const nextAbstract = meta.abstract || abstract;
        const nextVolume = meta.volume || volume;
        const nextIssue = meta.issue || issue;
        const nextPages = meta.pages || pages;
        const nextItemType = meta.itemType || itemType;

        setTitle(nextTitle);
        setAuthors(nextAuthors.join(', '));
        setJournal(nextJournal);
        setPublisher(nextPublisher);
        setYear(nextYear);
        setDoi(nextDoi);
        setAbstract(nextAbstract);
        setVolume(nextVolume);
        setIssue(nextIssue);
        setPages(nextPages);
        setItemType(nextItemType);

        if (onUpdatePaper) {
          onUpdatePaper({
            title: nextTitle.trim() || undefined,
            authors: nextAuthors.length ? nextAuthors : undefined,
            journal: nextJournal.trim() || undefined,
            publisher: nextPublisher.trim() || undefined,
            year: nextYear ? parseInt(nextYear, 10) || undefined : undefined,
            doi: nextDoi.trim() || undefined,
            abstract: nextAbstract.trim() || undefined,
            volume: nextVolume.trim() || undefined,
            issue: nextIssue.trim() || undefined,
            pages: nextPages.trim() || undefined,
            type: nextItemType || undefined,
          });
        }

        toast.success(`Metadata resolved via ${res.provider} (${res.queryType})!`);
      } else {
        toast.error('Could not find metadata for this identifier.');
      }
    } catch (err) {
      console.warn('Auto resolve error:', err);
      toast.error(getErrorMessage(err) || 'Failed to auto-resolve metadata');
    } finally {
      setIsResolving(false);
    }
  };

  const handleCopyCitationKey = () => {
    if (paper.citationKey) {
      navigator.clipboard.writeText(`\\cite{${paper.citationKey}}`);
      toast.success(`Copied \\cite{${paper.citationKey}}`);
    }
  };

  const handleSave = () => {
    if (onUpdatePaper) {
      onUpdatePaper({
        title: title.trim() || undefined,
        authors: authors
          ? authors
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : undefined,
        journal: journal.trim() || undefined,
        publisher: publisher.trim() || undefined,
        year: year ? parseInt(year, 10) || undefined : undefined,
        doi: doi.trim() || undefined,
        abstract: abstract.trim() || undefined,
        volume: volume.trim() || undefined,
        issue: issue.trim() || undefined,
        pages: pages.trim() || undefined,
        type: itemType.trim() || undefined,
      });
    }
    setIsEditing(false);
    toast.success('Metadata updated successfully');
  };

  const handleCancel = () => {
    setTitle(paper.title || '');
    setAuthors(paper.authors?.join(', ') || '');
    setJournal(paper.journal || '');
    setPublisher(paper.publisher || '');
    setYear(paper.year ? String(paper.year) : '');
    setDoi(paper.doi || '');
    setAbstract(paper.abstract || '');
    setVolume(paper.volume || '');
    setIssue(paper.issue || '');
    setPages(paper.pages || '');
    setItemType(paper.itemType || 'journalArticle');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-3.5 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <span className="font-semibold text-foreground uppercase tracking-wider">
            Edit Item Metadata
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="h-7 px-2.5 text-xs cursor-pointer"
            >
              <X className="size-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 px-2.5 text-xs cursor-pointer"
            >
              <Check className="size-3 mr-1" />
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Item Type</label>
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className="w-full p-1.5 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary font-mono"
            >
              <option value="journalArticle">Journal Article</option>
              <option value="conferencePaper">Conference Paper</option>
              <option value="preprint">Preprint (arXiv / SSRN)</option>
              <option value="book">Book</option>
              <option value="bookSection">Book Section</option>
              <option value="thesis">Thesis</option>
              <option value="report">Report</option>
              <option value="webpage">Webpage</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Paper title"
              className="h-8 text-xs font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Authors (comma separated)
            </label>
            <Input
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g. Ashish Vaswani, Noam Shazeer, Niki Parmar"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Publication / Venue</label>
              <Input
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="e.g. NeurIPS / Nature"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Year</label>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2017"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Publisher</label>
              <Input
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="e.g. IEEE / Springer / arXiv"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">DOI</label>
              <Input
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.xxxx/..."
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Volume</label>
              <Input
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Issue</label>
              <Input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Pages</label>
              <Input
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Abstract</label>
            <Textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={4}
              placeholder="Abstract text..."
              className="text-xs leading-relaxed"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 text-xs">
      {/* 1. CLASSIFICATION & TOPBAR */}
      <div className="flex items-center justify-between pb-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono capitalize">
            {paper.itemType === 'preprint' ? 'Preprint' : paper.itemType || 'Journal Article'}
          </Badge>
          {paper.citationKey && (
            <button
              onClick={handleCopyCitationKey}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 bg-muted/40 hover:bg-muted px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              title="Click to copy \cite{key}"
            >
              <Quote className="size-2.5 text-primary" />
              <span>@{paper.citationKey}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAutoResolveMetadata}
            disabled={isResolving}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium disabled:opacity-50 cursor-pointer"
            title="Auto-fetch full title, authors, year from CrossRef/arXiv"
          >
            {isResolving ? (
              <Loader2 className="size-3 animate-spin text-primary" />
            ) : (
              <Sparkles className="size-3 text-primary" />
            )}
            <span>Sync Info</span>
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs text-foreground hover:underline font-medium cursor-pointer ml-2"
          >
            <Edit3 className="size-3" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Suggestion Banner when metadata is incomplete (e.g. arXiv ID filename) */}
      {isMissingMetadata && (
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-foreground">
              {isRawArxivTitle ? 'Raw arXiv ID detected' : 'Incomplete metadata'}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              Click Sync to automatically pull title, authors & abstract.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleAutoResolveMetadata}
            disabled={isResolving}
            className="h-6 px-2 text-[10px] gap-1 cursor-pointer shrink-0"
          >
            {isResolving ? <Loader2 className="size-2.5 animate-spin" /> : <Sparkles className="size-2.5" />}
            Auto-Retrieve
          </Button>
        </div>
      )}

      {/* 2. TITLE & AUTHORSHIP (Typography) */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground leading-snug select-text">
          {paper.title || 'Untitled Document'}
        </h3>
        <p className="text-xs text-muted-foreground font-medium select-text">
          {paper.authors?.length ? paper.authors.join('; ') : <span className="italic opacity-60">No authors listed</span>}
        </p>
      </div>

      {/* 3. PUBLICATION DETAILS */}
      <div className="pt-2 border-t border-border/20 space-y-1">
        <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Publication Details
        </span>
        <DetailRow label="Venue / Journal" value={paper.journal || paper.publisher} />
        <DetailRow label="Year" value={paper.year} mono />
        {paper.volume && <DetailRow label="Volume" value={paper.volume} mono />}
        {paper.issue && <DetailRow label="Issue" value={paper.issue} mono />}
        {paper.pages && <DetailRow label="Pages" value={paper.pages} mono />}
        {paper.publisher && <DetailRow label="Publisher" value={paper.publisher} />}
        {paper.createdAt && (
          <DetailRow
            label="Date Added"
            value={new Date(paper.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            mono
          />
        )}
      </div>

      {/* 4. ACADEMIC IDENTIFIERS */}
      <div className="pt-2 border-t border-border/20 space-y-1">
        <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Identifiers
        </span>
        <DetailRow
          label="DOI"
          value={paper.doi}
          href={
            paper.doi
              ? paper.doi.startsWith('http')
                ? paper.doi
                : `https://doi.org/${paper.doi}`
              : undefined
          }
          mono
        />
        {paper.url && <DetailRow label="URL" value={paper.url} href={paper.url} />}
        {paper.issn && <DetailRow label="ISSN" value={paper.issn} mono />}
        {paper.isbn && <DetailRow label="ISBN" value={paper.isbn} mono />}
      </div>

      {/* 5. ABSTRACT */}
      {paper.abstract && (
        <div className="pt-2 border-t border-border/20 space-y-1">
          <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Abstract
          </span>
          <p className="text-xs text-foreground/90 leading-relaxed max-h-48 overflow-y-auto bg-muted/20 p-2.5 rounded-lg border border-border/30 select-text whitespace-pre-wrap">
            {paper.abstract}
          </p>
        </div>
      )}
    </div>
  );
}
