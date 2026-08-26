'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ExternalLink,
  Copy,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
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
  return (
    lower !== 'null' &&
    lower !== 'undefined' &&
    lower !== 'n/a' &&
    lower !== 'none' &&
    lower !== '{}' &&
    lower !== '[object object]'
  );
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
  ariaLabel,
  onSave,
  className,
  mono,
}: {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
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
      aria-label={ariaLabel || placeholder || 'Metadata field'}
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
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-normal font-normal truncate placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
        mono && 'font-mono text-[11px]',
        className,
      )}
    />
  );
}

/**
 * Reference-Manager-style Creator/Author Inline Field
 * - Enter: Saves and inserts a new author row below
 * - Backspace on empty: Removes current author row and focuses previous author
 * - Blur on empty: Removes author row automatically
 */
function AuthorInlineField({
  value,
  index,
  total,
  ariaLabel,
  onSave,
  onInsertNext,
  onRemoveEmpty,
  inputRef,
}: {
  value: string;
  index: number;
  total: number;
  ariaLabel?: string;
  onSave: (index: number, val: string) => void;
  onInsertNext: (index: number) => void;
  onRemoveEmpty: (index: number) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed && total > 1) {
      onRemoveEmpty(index);
    } else if (trimmed !== value) {
      onSave(index, trimmed);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      aria-label={ariaLabel || `Author ${index + 1}`}
      placeholder="Author name (e.g. Lastname, Firstname)..."
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const trimmed = draft.trim();
          if (trimmed !== value) {
            onSave(index, trimmed);
          }
          onInsertNext(index);
        } else if (e.key === 'Backspace' && draft === '' && total > 1) {
          e.preventDefault();
          onRemoveEmpty(index);
        } else if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-normal font-normal truncate placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    />
  );
}

/** Clean Inline Editable Auto-Expanding Textarea for Title or Extra */
function InlineTextarea({
  value,
  placeholder,
  ariaLabel,
  onSave,
  className,
  rows = 2,
}: {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
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
      aria-label={ariaLabel || placeholder || 'Field content'}
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
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-relaxed resize-none placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    />
  );
}

export default function InfoSection({ paper, onUpdatePaper }: InfoSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const authorInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const MAX_COLLAPSED_AUTHORS = 3;

  const authorList = useMemo(() => sanitizeAuthors(paper.authors), [paper.authors]);

  const visibleAuthors = useMemo(() => {
    if (isAuthorsExpanded || authorList.length <= 4) {
      return authorList;
    }
    return authorList.slice(0, MAX_COLLAPSED_AUTHORS);
  }, [authorList, isAuthorsExpanded]);

  useEffect(() => {
    if (focusIndex !== null && authorInputRefs.current[focusIndex]) {
      authorInputRefs.current[focusIndex]?.focus();
      setFocusIndex(null);
    }
  }, [focusIndex, authorList]);

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

  // Reference-Manager-style author operations
  const handleUpdateAuthorAtIndex = (index: number, newName: string) => {
    const updated = [...authorList];
    if (newName.trim()) {
      updated[index] = newName.trim();
    } else {
      updated.splice(index, 1);
    }
    handleFieldChange('authors', updated.length ? updated : undefined);
  };

  const handleInsertNextAuthor = (afterIndex: number) => {
    const updated = [...authorList];
    updated.splice(afterIndex + 1, 0, '');
    setIsAuthorsExpanded(true);
    setFocusIndex(afterIndex + 1);
    handleFieldChange('authors', updated);
  };

  const handleRemoveEmptyAuthor = (index: number) => {
    const updated = authorList.filter((_, idx) => idx !== index);
    if (index > 0) {
      setFocusIndex(index - 1);
    }
    handleFieldChange('authors', updated.length ? updated : undefined);
  };

  const handleAddFirstAuthor = () => {
    setIsAuthorsExpanded(true);
    setFocusIndex(0);
    handleFieldChange('authors', ['']);
  };

  const isPublicUrl = paper.url && paper.url.startsWith('http') && !paper.url.includes('/api/files/');

  return (
    <div className="space-y-4 select-text">
      {/* ── Group 1: Core Bibliographic Information ──────────────────────────── */}
      <div className="space-y-0.5 divide-y divide-border/10">
        {/* 1. Item Type */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs py-1">
          <span className="text-muted-foreground font-medium select-none" id="label-item-type">Item Type</span>
          <div className="flex items-center gap-2 min-w-0">
            <select
              aria-labelledby="label-item-type"
              aria-label="Item Type"
              value={paper.itemType || 'journalArticle'}
              onChange={(e) => handleFieldChange('itemType', e.target.value)}
              className="w-full bg-transparent hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border text-foreground text-xs font-medium outline-none cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="journalArticle">Journal Article</option>
              <option value="conferencePaper">Conference Paper</option>
              <option value="preprint">Preprint (arXiv / SSRN)</option>
              <option value="book">Book</option>
              <option value="bookSection">Book Section</option>
              <option value="thesis">Thesis</option>
              <option value="report">Report</option>
              <option value="patent">Patent</option>
              <option value="dataset">Dataset</option>
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
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-title">Title</span>
          <InlineTextarea
            value={paper.title || ''}
            ariaLabel="Paper Title"
            placeholder="Click to enter title..."
            onSave={(val) => handleFieldChange('title', val || undefined)}
            className="font-semibold text-foreground text-xs leading-snug"
            rows={2}
          />
        </div>

        {/* 3. Authors */}
        <div className="py-1 space-y-1">
          {authorList.length === 0 ? (
            <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
              <span className="text-muted-foreground font-medium select-none">Author</span>
              <button
                onClick={handleAddFirstAuthor}
                className="text-[11px] text-primary hover:underline text-left cursor-pointer flex items-center gap-1 font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded px-1"
                aria-label="Add first author"
              >
                <Plus className="size-3" aria-hidden="true" />
                <span>Add Author</span>
              </button>
            </div>
          ) : (
            <>
              {visibleAuthors.map((authorName, idx) => (
                <div key={idx} className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs">
                  <span className="text-muted-foreground font-medium select-none truncate">
                    {idx === 0 ? (authorList.length > 1 ? `Authors (${authorList.length})` : 'Author') : ''}
                  </span>
                  <div className="flex items-center gap-1 min-w-0">
                    <AuthorInlineField
                      value={authorName}
                      index={idx}
                      total={authorList.length}
                      ariaLabel={`Author ${idx + 1} of ${authorList.length}`}
                      onSave={handleUpdateAuthorAtIndex}
                      onInsertNext={handleInsertNextAuthor}
                      onRemoveEmpty={handleRemoveEmptyAuthor}
                      inputRef={(el) => {
                        authorInputRefs.current[idx] = el;
                      }}
                    />
                  </div>
                </div>
              ))}

              {authorList.length > 4 && (
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs pt-0.5">
                  <span />
                  <button
                    onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer py-0.5 transition-colors hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded px-1"
                    aria-expanded={isAuthorsExpanded}
                  >
                    {isAuthorsExpanded ? (
                      <>
                        <ChevronUp className="size-3" aria-hidden="true" />
                        <span>Show less ({MAX_COLLAPSED_AUTHORS} of {authorList.length})</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3" aria-hidden="true" />
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
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-publication">Publication</span>
          <InlineField
            value={paper.journal || paper.publicationTitle || ''}
            ariaLabel="Publication or Journal Venue"
            placeholder="Journal / Conference venue..."
            onSave={(val) => {
              handleFieldChange('journal', val || undefined);
              handleFieldChange('publicationTitle', val || undefined);
            }}
            className="text-foreground font-medium"
          />
        </div>

        {/* 5. Date / Year */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-date">Date</span>
          <InlineField
            value={paper.publicationDate || (paper.year ? String(paper.year) : '')}
            ariaLabel="Publication Date or Year"
            placeholder="e.g. 2024 or 2024-05-18"
            onSave={(val) => {
              const parsed = parseInt(val, 10);
              handleFieldChange('year', isNaN(parsed) ? undefined : parsed);
              handleFieldChange('publicationDate', val || undefined);
            }}
            className="text-foreground font-mono"
            mono
          />
        </div>
      </div>

      {/* ── Toggle Details Button ────────────────────────────────────────────── */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded px-1"
          aria-expanded={isDetailsExpanded}
        >
          {isDetailsExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          <span>{isDetailsExpanded ? 'Hide extended publication fields' : 'Show extended publication fields (Publisher, Series, Place...)'}</span>
        </button>
      </div>

      {/* ── Group 2: Publication & Series Details (Expandable) ──────────────── */}
      {isDetailsExpanded && (
        <div className="space-y-0.5 divide-y divide-border/10 border-t border-border/20 pt-1">
          {/* Journal Abbr */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Journal Abbr</span>
            <InlineField
              value={paper.journalAbbr || ''}
              ariaLabel="Journal abbreviation"
              placeholder="e.g. IEEE Trans. PAMI"
              onSave={(val) => handleFieldChange('journalAbbr', val || undefined)}
              className="text-foreground font-mono text-[11px]"
              mono
            />
          </div>

          {/* Publisher */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Publisher</span>
            <InlineField
              value={paper.publisher || ''}
              ariaLabel="Publisher name"
              placeholder="e.g. IEEE / Springer / Nature"
              onSave={(val) => handleFieldChange('publisher', val || undefined)}
              className="text-foreground"
            />
          </div>

          {/* Place */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Place</span>
            <InlineField
              value={paper.place || ''}
              ariaLabel="Publication place"
              placeholder="e.g. New York, NY"
              onSave={(val) => handleFieldChange('place', val || undefined)}
              className="text-foreground"
            />
          </div>

          {/* Volume & Issue */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Vol / Issue</span>
            <div className="grid grid-cols-2 gap-1.5">
              <InlineField
                value={paper.volume || ''}
                ariaLabel="Volume number"
                placeholder="Vol (e.g. 30)"
                onSave={(val) => handleFieldChange('volume', val || undefined)}
                className="text-foreground font-mono"
                mono
              />
              <InlineField
                value={paper.issue || ''}
                ariaLabel="Issue number"
                placeholder="Issue (e.g. 2)"
                onSave={(val) => handleFieldChange('issue', val || undefined)}
                className="text-foreground font-mono"
                mono
              />
            </div>
          </div>

          {/* Pages */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Pages</span>
            <InlineField
              value={paper.pages || ''}
              ariaLabel="Page range"
              placeholder="e.g. 5998–6008"
              onSave={(val) => handleFieldChange('pages', val || undefined)}
              className="text-foreground font-mono"
              mono
            />
          </div>

          {/* Series */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Series</span>
            <InlineField
              value={paper.series || ''}
              ariaLabel="Book series or collection"
              placeholder="e.g. LNCS Vol. 1234"
              onSave={(val) => handleFieldChange('series', val || undefined)}
              className="text-foreground"
            />
          </div>

          {/* Language */}
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">Language</span>
            <InlineField
              value={paper.language || ''}
              ariaLabel="Language"
              placeholder="e.g. en"
              onSave={(val) => handleFieldChange('language', val || undefined)}
              className="text-foreground font-mono text-[11px]"
              mono
            />
          </div>
        </div>
      )}

      {/* ── Group 3: Identifiers & Standard Keys ───────────────────────────── */}
      <div className="space-y-0.5 divide-y divide-border/10 border-t border-border/20 pt-1">
        {/* DOI */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-doi">DOI</span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={paper.doi || ''}
              ariaLabel="DOI identifier"
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
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  title="Open DOI Link"
                  aria-label="Open DOI Link in new tab"
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                <button
                  onClick={() => copyToClipboard(paper.doi!, 'DOI')}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  title="Copy DOI"
                  aria-label="Copy DOI"
                >
                  {copiedKey === 'DOI' ? <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* arXiv ID (if present or preprint) */}
        {(isValidValue(paper.arxivId) || paper.itemType === 'preprint') && (
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1 group">
            <span className="text-muted-foreground font-medium select-none pt-1">arXiv</span>
            <div className="flex items-center gap-1 min-w-0">
              <InlineField
                value={paper.arxivId || ''}
                ariaLabel="arXiv identifier"
                placeholder="e.g. 2305.18290"
                onSave={(val) => handleFieldChange('arxivId', val || undefined)}
                className="text-foreground font-mono text-[11px] flex-1"
                mono
              />
              {isValidValue(paper.arxivId) && (
                <a
                  href={`https://arxiv.org/abs/${paper.arxivId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  title="Open arXiv page"
                  aria-label="Open arXiv page in new tab"
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* PMID / PMCID (if present) */}
        {(isValidValue(paper.pmid) || isValidValue(paper.pmcid)) && (
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">PubMed</span>
            <div className="grid grid-cols-2 gap-1.5">
              <InlineField
                value={paper.pmid || ''}
                ariaLabel="PubMed PMID"
                placeholder="PMID (e.g. 32800000)"
                onSave={(val) => handleFieldChange('pmid', val || undefined)}
                className="text-foreground font-mono"
                mono
              />
              <InlineField
                value={paper.pmcid || ''}
                ariaLabel="PubMed Central PMCID"
                placeholder="PMCID (e.g. PMC7423000)"
                onSave={(val) => handleFieldChange('pmcid', val || undefined)}
                className="text-foreground font-mono"
                mono
              />
            </div>
          </div>
        )}

        {/* ISSN / ISBN (if present) */}
        {(isValidValue(paper.issn) || isValidValue(paper.isbn)) && (
          <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1">
            <span className="text-muted-foreground font-medium select-none pt-1">ISSN / ISBN</span>
            <div className="grid grid-cols-2 gap-1.5">
              <InlineField
                value={paper.issn || ''}
                ariaLabel="ISSN"
                placeholder="ISSN"
                onSave={(val) => handleFieldChange('issn', val || undefined)}
                className="text-foreground font-mono text-[11px]"
                mono
              />
              <InlineField
                value={paper.isbn || ''}
                ariaLabel="ISBN"
                placeholder="ISBN"
                onSave={(val) => handleFieldChange('isbn', val || undefined)}
                className="text-foreground font-mono text-[11px]"
                mono
              />
            </div>
          </div>
        )}

        {/* Public URL */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-url">URL</span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={paper.url || ''}
              ariaLabel="Document URL"
              placeholder="https://..."
              onSave={(val) => handleFieldChange('url', val || undefined)}
              className="text-foreground flex-1"
            />
            {isPublicUrl && (
              <a
                href={paper.url}
                target="_blank"
                rel="noreferrer noopener"
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                title="Open URL"
                aria-label="Open Document URL in new tab"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {/* Cite Key */}
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none" id="label-citekey">Cite Key</span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={paper.citationKey || ''}
              ariaLabel="BibTeX Citation Key"
              placeholder="e.g. zhao2023large"
              onSave={(val) => handleFieldChange('citationKey', val || undefined)}
              className="text-foreground font-mono text-[11px] flex-1"
              mono
            />
            {isValidValue(paper.citationKey) && (
              <button
                onClick={() => copyToClipboard(`\\cite{${paper.citationKey}}`, 'Citation Key')}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 shrink-0 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded"
                title="Copy \cite{key}"
                aria-label={`Copy citation key \\cite{${paper.citationKey}}`}
              >
                {copiedKey === 'Citation Key' ? <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Group 4: Reference Extra & Archival Fields ────────────────────────── */}
      <div className="space-y-1.5 border-t border-border/20 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
            Extra & Archival Notes
          </h3>
          {isValidValue(paper.license) && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.2 rounded border border-border/20">
              {paper.license}
            </span>
          )}
        </div>
        <InlineTextarea
          value={paper.extra || ''}
          ariaLabel="Reference Extra field"
          placeholder="Extra lines (e.g. arXiv: 2305.18290, Funder: NSF)..."
          onSave={(val) => handleFieldChange('extra', val || undefined)}
          className="font-mono text-[11px] bg-muted/10 border-border/30 rounded p-1.5"
          rows={3}
        />
      </div>
    </div>
  );
}
