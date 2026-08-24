'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ExternalLink,
  Copy,
  Plus,
  Minus,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveAcademicQuery } from '../../../services/reference.service';
import { cn } from '@/shared/lib/utils';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface InfoSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

/** Filter out empty, null, undefined, or junk placeholder string values */
function isValidValue(val?: string | number | null): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (!str) return false;
  const lower = str.toLowerCase();
  return lower !== 'null' && lower !== 'undefined' && lower !== 'n/a' && lower !== 'none' && lower !== '{}' && lower !== '[object object]';
}

/** Sanitize authors array into clean string array */
function sanitizeAuthors(rawAuthors?: string[] | null): string[] {
  if (!rawAuthors || !Array.isArray(rawAuthors)) return [];
  const result: string[] = [];
  for (const item of rawAuthors) {
    if (!item) continue;
    if (typeof item === 'string' && item.includes(';') && !item.includes(',')) {
      result.push(...item.split(';').map((s) => s.trim()).filter(isValidValue));
    } else {
      const trimmed = item.trim();
      if (isValidValue(trimmed)) {
        result.push(trimmed);
      }
    }
  }
  return result;
}

/** Clean Inline Editable Text Input (Saves on Enter / Blur, Cancels on Escape) */
function InlineField({
  value,
  placeholder,
  onSave,
  className,
  mono,
}: {
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
  className?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder || '—'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-normal font-normal truncate placeholder:text-muted-foreground/30',
        mono && 'font-mono text-[11px]',
        className,
      )}
    />
  );
}

/** Clean Inline Editable Auto-Expanding Textarea for Title */
function InlineTextarea({
  value,
  placeholder,
  onSave,
  className,
  rows = 2,
}: {
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
  className?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      rows={rows}
      placeholder={placeholder || '—'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commit();
          textareaRef.current?.blur();
        } else if (e.key === 'Escape') {
          setDraft(value);
          textareaRef.current?.blur();
        }
      }}
      className={cn(
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-relaxed resize-none placeholder:text-muted-foreground/30',
        className,
      )}
    />
  );
}

export default function InfoSection({ paper, onUpdatePaper }: InfoSectionProps) {
  const paperId = paper.id;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const MAX_COLLAPSED_AUTHORS = 3;

  const authorList = useMemo(() => sanitizeAuthors(paper.authors), [paper.authors]);

  const visibleAuthors = useMemo(() => {
    if (isAuthorsExpanded || authorList.length <= 4) {
      return authorList;
    }
    return authorList.slice(0, MAX_COLLAPSED_AUTHORS);
  }, [authorList, isAuthorsExpanded]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFieldChange = (field: keyof Paper, value: any) => {
    if (onUpdatePaper) {
      onUpdatePaper({ [field]: value });
      toast.success('Saved', { duration: 800 });
    }
  };

  const handleAutoEnrich = async () => {
    const queryCandidate =
      paper.doi ||
      (paper as any).arxivId ||
      (paper.title && paper.title.length > 3 ? paper.title : '');

    if (!queryCandidate) {
      toast.error('Enter DOI or Title first to fetch metadata');
      return;
    }

    setIsEnriching(true);
    const toastId = toast.loading(`Resolving metadata from CrossRef / Semantic Scholar / OpenAlex...`);

    try {
      const res = await resolveAcademicQuery(queryCandidate);
      if (res && res.metadata) {
        const m = res.metadata;
        const updates: Partial<Paper> = {};
        if (m.title && m.title !== 'Untitled') updates.title = m.title;
        if (m.authors && m.authors.length > 0) updates.authors = m.authors;
        if (m.year) updates.year = Number(m.year);
        if (m.doi) updates.doi = m.doi;
        if (m.journal || m.publicationTitle) updates.journal = m.journal || m.publicationTitle;
        if (m.publisher) updates.publisher = m.publisher;
        if (m.volume) updates.volume = m.volume;
        if (m.issue) updates.issue = m.issue;
        if (m.pages) updates.pages = m.pages;
        if (m.abstract) updates.abstract = m.abstract;
        if (m.url) updates.url = m.url;
        if (m.itemType) updates.itemType = m.itemType;
        if (m.keywords && m.keywords.length > 0 && (!paper.labels || paper.labels.length === 0)) {
          updates.labels = m.keywords;
        }
        if (m.tldr && (!paper.notes || paper.notes.length === 0)) {
          const now = new Date().toISOString();
          updates.notes = [
            {
              id: `note-${Date.now()}`,
              content: `💡 **TL;DR Summary**:\n${m.tldr}`,
              createdAt: now,
              updatedAt: now,
            },
          ];
        }
        if (m.openAccessPdfUrl && !paper.fileUrl) {
          updates.fileUrl = m.openAccessPdfUrl;
        }

        if (onUpdatePaper) {
          onUpdatePaper(updates);
        }
        toast.dismiss(toastId);
        toast.success(`✨ Enriched metadata via ${res.provider || 'Academic Registry'}!`);
      } else {
        toast.dismiss(toastId);
        toast.error('No matching academic record found');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Failed to enrich metadata');
    } finally {
      setIsEnriching(false);
    }
  };

  // Author Management (Zotero-style add/remove/edit)
  const handleUpdateAuthorAtIndex = (index: number, newName: string) => {
    const updated = [...authorList];
    if (newName.trim()) {
      updated[index] = newName.trim();
    } else {
      updated.splice(index, 1);
    }
    handleFieldChange('authors', updated.length ? updated : undefined);
  };

  const handleAddAuthorAfter = (index: number) => {
    const updated = [...authorList];
    updated.splice(index + 1, 0, 'New Author');
    setIsAuthorsExpanded(true);
    handleFieldChange('authors', updated);
  };

  const handleRemoveAuthorAtIndex = (index: number) => {
    const updated = authorList.filter((_, idx) => idx !== index);
    handleFieldChange('authors', updated.length ? updated : undefined);
  };

  const handleAddFirstAuthor = () => {
    setIsAuthorsExpanded(true);
    handleFieldChange('authors', ['New Author']);
  };

  const isPublicUrl = paper.url && paper.url.startsWith('http') && !paper.url.includes('/api/files/');

  return (
    <div className="space-y-1 select-text">
      {/* Zotero 7 Authentic 2-Column Fields Grid (Strictly Aligned) */}
      <div className="space-y-0.5 divide-y divide-border/10">
        {/* 1. Item Type */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs py-1">
          <span className="text-muted-foreground font-medium select-none">Item Type</span>
          <div className="flex items-center gap-2 min-w-0">
            <select
              value={paper.itemType || 'journalArticle'}
              onChange={(e) => handleFieldChange('itemType', e.target.value)}
              className="w-full bg-transparent hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border text-foreground text-xs font-medium outline-none cursor-pointer transition-colors"
            >
              <option value="journalArticle">Journal Article</option>
              <option value="conferencePaper">Conference Paper</option>
              <option value="preprint">Preprint (arXiv / SSRN)</option>
              <option value="book">Book</option>
              <option value="bookSection">Book Section</option>
              <option value="thesis">Thesis</option>
              <option value="report">Report</option>
              <option value="patent">Patent</option>
              <option value="webpage">Web Page</option>
            </select>
            {paper.provenance?.isOpenAccess && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 font-medium select-none px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                Open Access
              </span>
            )}
          </div>
        </div>

        {/* 2. Title */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Title</span>
          <InlineTextarea
            value={paper.title || ''}
            placeholder="Click to enter title..."
            onSave={(val) => handleFieldChange('title', val || undefined)}
            className="font-semibold text-foreground text-xs leading-snug"
            rows={2}
          />
        </div>

        {/* 3. Authors (Scalable multi-row with collapse/expand + Zotero-style add/remove) */}
        <div className="py-1 space-y-1">
          {authorList.length === 0 ? (
            <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
              <span className="text-muted-foreground font-medium select-none">Author</span>
              <button
                onClick={handleAddFirstAuthor}
                className="text-[11px] text-primary hover:underline text-left cursor-pointer flex items-center gap-1 font-medium"
              >
                <Plus className="size-3" />
                <span>Add Author</span>
              </button>
            </div>
          ) : (
            <>
              {visibleAuthors.map((authorName, idx) => (
                <div key={idx} className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs group">
                  <span className="text-muted-foreground font-medium select-none truncate">
                    {idx === 0 ? (authorList.length > 1 ? `Authors (${authorList.length})` : 'Author') : ''}
                  </span>
                  <div className="flex items-center gap-1 min-w-0">
                    <InlineField
                      value={authorName}
                      placeholder="Author name..."
                      onSave={(val) => handleUpdateAuthorAtIndex(idx, val)}
                      className="text-foreground flex-1"
                    />
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleAddAuthorAfter(idx)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Add author below"
                      >
                        <Plus className="size-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveAuthorAtIndex(idx)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Remove author"
                      >
                        <Minus className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Expand / Collapse Toggle for Long Author Lists (>4 authors) */}
              {authorList.length > 4 && (
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs pt-0.5">
                  <span />
                  <button
                    onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer py-0.5 transition-colors hover:underline"
                  >
                    {isAuthorsExpanded ? (
                      <>
                        <ChevronUp className="size-3" />
                        <span>Show less ({MAX_COLLAPSED_AUTHORS} of {authorList.length})</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3" />
                        <span>+ {authorList.length - MAX_COLLAPSED_AUTHORS} more authors (Show all {authorList.length})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 4. Publication / Journal */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Publication</span>
          <InlineField
            value={paper.journal || paper.publicationTitle || ''}
            placeholder="Journal / Conference venue..."
            onSave={(val) => {
              handleFieldChange('journal', val || undefined);
              handleFieldChange('publicationTitle', val || undefined);
            }}
            className="text-foreground font-medium"
          />
        </div>

        {/* 5. Publisher */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Publisher</span>
          <InlineField
            value={paper.publisher || ''}
            placeholder="e.g. IEEE / Springer / Nature"
            onSave={(val) => handleFieldChange('publisher', val || undefined)}
            className="text-foreground"
          />
        </div>

        {/* 6. Volume */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Volume</span>
          <InlineField
            value={paper.volume || ''}
            placeholder="e.g. 30"
            onSave={(val) => handleFieldChange('volume', val || undefined)}
            className="text-foreground font-mono"
            mono
          />
        </div>

        {/* 7. Issue */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Issue</span>
          <InlineField
            value={paper.issue || ''}
            placeholder="e.g. 2"
            onSave={(val) => handleFieldChange('issue', val || undefined)}
            className="text-foreground font-mono"
            mono
          />
        </div>

        {/* 8. Pages */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Pages</span>
          <InlineField
            value={paper.pages || ''}
            placeholder="e.g. 5998–6008"
            onSave={(val) => handleFieldChange('pages', val || undefined)}
            className="text-foreground font-mono"
            mono
          />
        </div>

        {/* 9. Date / Year */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1">Date</span>
          <InlineField
            value={paper.year ? String(paper.year) : ''}
            placeholder="e.g. 2024"
            onSave={(val) => {
              const parsed = parseInt(val, 10);
              handleFieldChange('year', isNaN(parsed) ? undefined : parsed);
            }}
            className="text-foreground font-mono"
            mono
          />
        </div>

        {/* 10. DOI */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none pt-1">DOI</span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={paper.doi || ''}
              placeholder="10.xxxx/..."
              onSave={(val) => handleFieldChange('doi', val || undefined)}
              className="text-foreground font-mono text-[11px] flex-1"
              mono
            />
            {isValidValue(paper.doi) && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={paper.doi!.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Open DOI Link"
                >
                  <ExternalLink className="size-3" />
                </a>
                <button
                  onClick={() => copyToClipboard(paper.doi!, 'DOI')}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Copy DOI"
                >
                  {copiedKey === 'DOI' ? <CheckCircle2 className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 11. Public URL */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none pt-1">URL</span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={paper.url || ''}
              placeholder="https://..."
              onSave={(val) => handleFieldChange('url', val || undefined)}
              className="text-foreground flex-1"
            />
            {isPublicUrl && (
              <a
                href={paper.url}
                target="_blank"
                rel="noreferrer noopener"
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                title="Open URL"
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>

        {/* 12. Cite Key */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none">Cite Key</span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={paper.citationKey || ''}
              placeholder="e.g. zhao2023large"
              onSave={(val) => handleFieldChange('citationKey', val || undefined)}
              className="text-foreground font-mono text-[11px] flex-1"
              mono
            />
            {isValidValue(paper.citationKey) && (
              <button
                onClick={() => copyToClipboard(`\\cite{${paper.citationKey}}`, 'Citation Key')}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 shrink-0 transition-opacity"
                title="Copy \cite{key}"
              >
                {copiedKey === 'Citation Key' ? <CheckCircle2 className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Source Footer + Auto Enrich Button */}
      <div className="pt-2.5 border-t border-border/20 flex items-center justify-between text-[11px] text-muted-foreground select-none">
        <div className="flex items-center gap-1.5">
          <span>
            Catalog: <strong className="font-medium text-foreground">{paper.provenance?.originProvider || (paper.doi ? 'CrossRef' : 'Manual')}</strong>
          </span>
          <button
            onClick={handleAutoEnrich}
            disabled={isEnriching}
            className="inline-flex items-center gap-1 text-[11px] text-foreground hover:text-primary font-medium hover:underline cursor-pointer ml-1.5 transition-colors disabled:opacity-50"
            title="Fetch full metadata from CrossRef, Semantic Scholar, OpenAlex & arXiv"
          >
            {isEnriching ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : <RefreshCw className="size-3 text-muted-foreground" />}
            <span>{isEnriching ? 'Enriching...' : 'Auto-enrich'}</span>
          </button>
        </div>
        {paper.createdAt && (
          <span>Added {new Date(paper.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
        )}
      </div>
    </div>
  );
}
