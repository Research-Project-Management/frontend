'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ExternalLink,
  Edit3,
  Check,
  X,
  RefreshCw,
  Loader2,
  Sparkles,
  FileText,
  BookOpen,
  Download,
  Plus,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import { Button, Input, Textarea } from '@/shared/components/ui';
import { useReferences } from '@/features/workspaces/library/hooks/data/use-references';
import { API_BASE_URL } from '@/shared/constants';
import { getLibraryEntityId, getPaperFileUrl } from '@/features/workspaces/library/utils/library.util';
import type { Paper, ReferenceData } from '@/features/workspaces/library/types/library.types';

interface InfoSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
  onUpdateTags?: (tags: string[]) => void;
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

export default function InfoSection({ paper, onUpdatePaper, onUpdateTags }: InfoSectionProps) {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();
  const paperId = getLibraryEntityId(paper);
  const fileUrl = getPaperFileUrl(paper);
  const hasFile = Boolean(fileUrl);

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

  // Synchronize internal state only when paper identity changes
  useEffect(() => {
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
    setIsAddingTag(false);
    setNewTag('');
  }, [paperId]);

  // Tag editing state
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const tags = paper.labels || [];

  const { state: refState, actions: refActions } = useReferences();

  const handleCrawlDoi = async () => {
    const targetDoi = (doi || paper.doi || '').trim();
    if (!targetDoi) {
      toast.error('Please provide a valid DOI');
      return;
    }
    try {
      const metadata = await refActions.lookupDoi(targetDoi);
      if (metadata) {
        const nextTitle = metadata.title || title;
        const nextAuthors = metadata.authors ? metadata.authors.join(', ') : authors;
        const nextJournal = metadata.journal || journal;
        const nextYear = metadata.year ? String(metadata.year) : year;
        const nextAbstract = metadata.abstract || abstract;
        const nextVolume = metadata.volume || volume;
        const nextIssue = metadata.issue || issue;
        const nextPages = metadata.pages || pages;

        if (metadata.title) setTitle(metadata.title);
        if (metadata.authors) setAuthors(metadata.authors.join(', '));
        if (metadata.journal) setJournal(metadata.journal);
        if (metadata.year) setYear(String(metadata.year));
        if (metadata.abstract) setAbstract(metadata.abstract);
        if (metadata.volume) setVolume(metadata.volume);
        if (metadata.issue) setIssue(metadata.issue);
        if (metadata.pages) setPages(metadata.pages);

        // If not in editing mode, persist the crawled metadata directly
        if (!isEditing && onUpdatePaper) {
          onUpdatePaper({
            title: nextTitle.trim() || undefined,
            authors: metadata.authors || (authors ? authors.split(',').map((a) => a.trim()).filter(Boolean) : undefined),
            journal: nextJournal.trim() || undefined,
            year: nextYear ? parseInt(nextYear, 10) || undefined : undefined,
            doi: targetDoi,
            abstract: nextAbstract.trim() || undefined,
            volume: nextVolume.trim() || undefined,
            issue: nextIssue.trim() || undefined,
            pages: nextPages.trim() || undefined,
          });
        }

        toast.success('Metadata fetched from CrossRef');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to fetch DOI metadata');
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
        year: year ? parseInt(year, 10) || undefined : undefined,
        doi: doi.trim() || undefined,
        abstract: abstract.trim() || undefined,
        volume: volume.trim() || undefined,
        issue: issue.trim() || undefined,
        pages: pages.trim() || undefined,
      });
    }
    setIsEditing(false);
    toast.success('Reference details updated');
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

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags, trimmed];
      if (onUpdateTags) onUpdateTags(updated);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    if (onUpdateTags) onUpdateTags(updated);
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Edit Reference</span>
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
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
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
    <div className="space-y-4 min-w-0">
      {/* File Attachment & Quick Read Card */}
      {hasFile && (
        <div className="p-3 bg-muted/20 rounded-lg border border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0 border border-border/30">
              <FileText className="size-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate" title={paper.filename || 'PDF Document'}>
                {paper.filename || `${paper.title || 'Paper'}.pdf`}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">
                {paper.mimeType?.split('/')[1] || 'PDF'} Attached
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => paperId && router.push(`/${workspaceUrl}/library/papers/${paperId}`)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-[11px] font-medium rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <BookOpen className="size-3" />
              <span>Read</span>
            </button>
            {fileUrl && (
              <a
                href={fileUrl.startsWith('/api/files/') ? `${API_BASE_URL}${fileUrl}` : fileUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Download PDF"
              >
                <Download className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Metadata Fields Header */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Metadata</span>
          <div className="flex items-center gap-2">
            {paper.doi && (
              <button
                onClick={handleCrawlDoi}
                disabled={refState.isLookingUp}
                className="flex items-center gap-1 text-[11px] text-foreground hover:underline font-medium disabled:opacity-50 cursor-pointer"
                title="Re-fetch metadata from CrossRef via DOI"
              >
                {refState.isLookingUp ? <Loader2 className="size-3 animate-spin text-foreground" /> : <RefreshCw className="size-3 text-foreground" />}
                <span>Crawl DOI</span>
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-[11px] text-foreground hover:underline transition-colors cursor-pointer"
            >
              <Edit3 className="size-3 text-foreground" />
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
      </div>

      {/* Abstract */}
      {paper.abstract && (
        <div className="pt-2 border-t border-border/20">
          <span className="block text-[11px] font-medium text-muted-foreground mb-1">Abstract</span>
          <p className="text-xs text-foreground/80 leading-relaxed max-h-40 overflow-y-auto bg-muted/10 p-2.5 rounded-md border border-border/30 break-words [overflow-wrap:anywhere]">
            {paper.abstract}
          </p>
        </div>
      )}

      {/* Tags Section */}
      <div className="pt-2 border-t border-border/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Tags ({tags.length})
          </span>
          {!isAddingTag && (
            <button
              onClick={() => setIsAddingTag(true)}
              className="flex items-center gap-1 text-[11px] text-foreground hover:underline font-medium cursor-pointer"
            >
              <Plus className="size-3 text-foreground" />
              <span>Add Tag</span>
            </button>
          )}
        </div>

        {isAddingTag && (
          <div className="flex items-center gap-1.5 p-1.5 bg-muted/20 rounded-md border border-border/40">
            <Input
              autoFocus
              placeholder="Tag name..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                } else if (e.key === 'Escape') {
                  setIsAddingTag(false);
                  setNewTag('');
                }
              }}
              className="h-6 text-xs bg-background"
            />
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="px-2 h-6 bg-primary text-primary-foreground text-[11px] font-medium rounded hover:bg-primary/90 disabled:opacity-50 cursor-pointer shrink-0"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAddingTag(false);
                setNewTag('');
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted/50 text-foreground border border-border/40 group hover:border-primary/40 transition-colors"
            >
              <Hash className="size-2.5 text-muted-foreground/60" />
              <span>{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="opacity-40 group-hover:opacity-100 hover:text-destructive cursor-pointer ml-0.5"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          {tags.length === 0 && !isAddingTag && (
            <span className="text-[11px] text-muted-foreground/60 italic">No tags assigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
