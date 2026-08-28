'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ExternalLink,
  Copy,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import type { Paper } from '@/features/workspaces/library/types/library.types';
import { normalizeAuthors, cleanDoi } from '@/features/workspaces/library/utils/library.util';
import {
  ALL_ITEM_TYPES_FLAT,
  getZoteroItemTypeDefinition,
  ALL_CREATOR_TYPES,
  SchemaFieldDefinition,
} from '@/features/workspaces/library/schemas/zotero-schema';

interface InfoSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

/** Filter out empty, null, undefined, or junk placeholder string values */
function isValidValue(val?: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val) && val > 0;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return false;
    const lower = str.toLowerCase();
    return (
      lower !== 'null' &&
      lower !== 'undefined' &&
      lower !== 'n/a' &&
      lower !== 'na' &&
      lower !== 'none' &&
      lower !== 'nil' &&
      lower !== '{}' &&
      lower !== '[]' &&
      lower !== '[object object]' &&
      lower !== '0000' &&
      lower !== 'unknown' &&
      lower !== 'untitled'
    );
  }
  return false;
}

/** Clean string value or return empty string */
function cleanValue(val?: any): string {
  if (!isValidValue(val)) return '';
  return String(val).trim();
}

/** Format ISO date into clean readable string */
function formatAuditDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export interface CreatorEntry {
  creatorType: string;
  name: string;
  firstName?: string;
  lastName?: string;
}

/** Parse & sanitize creators array into structured list */
function parseCreators(paper: Paper): CreatorEntry[] {
  const rawCreators = (paper as any).creators;
  if (Array.isArray(rawCreators) && rawCreators.length > 0) {
    const parsed = rawCreators
      .map((c: any) => {
        const creatorType = c.creatorType || 'author';
        let name = cleanValue(c.name || c.fullName);
        const firstName = cleanValue(c.firstName || c.given);
        const lastName = cleanValue(c.lastName || c.family);
        if (!name && (firstName || lastName)) {
          name = [lastName, firstName].filter(Boolean).join(', ');
        }
        return {
          creatorType,
          name,
          firstName,
          lastName,
        };
      })
      .filter((c: CreatorEntry) => isValidValue(c.name));
    if (parsed.length > 0) return parsed;
  }

  const authors = normalizeAuthors(paper.authors, null);
  return authors.filter(isValidValue).map((name) => ({
    creatorType: 'author',
    name,
  }));
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

/** Clean Inline Editable Auto-Expanding Textarea for Title */
function InlineTextarea({
  value,
  placeholder,
  ariaLabel,
  onSave,
  className,
  rows = 1,
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

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [draft, adjustHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      adjustHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [adjustHeight]);

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
      onChange={(e) => {
        setDraft(e.target.value);
        adjustHeight();
      }}
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
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-relaxed resize-none overflow-hidden placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none break-words [overflow-wrap:anywhere] whitespace-pre-wrap',
        className,
      )}
    />
  );
}

export default function InfoSection({ paper, onUpdatePaper }: InfoSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const [focusAuthorIndex, setFocusAuthorIndex] = useState<number | null>(null);
  const authorInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const MAX_COLLAPSED_AUTHORS = 4;

  const currentItemType = paper.itemType || 'journalArticle';
  const typeDefinition = useMemo(
    () => getZoteroItemTypeDefinition(currentItemType),
    [currentItemType],
  );

  const creatorsList = useMemo(() => parseCreators(paper), [paper]);

  const visibleCreators = useMemo(() => {
    if (isAuthorsExpanded || creatorsList.length <= MAX_COLLAPSED_AUTHORS + 1) {
      return creatorsList;
    }
    return creatorsList.slice(0, MAX_COLLAPSED_AUTHORS);
  }, [creatorsList, isAuthorsExpanded]);

  useEffect(() => {
    if (focusAuthorIndex !== null && authorInputRefs.current[focusAuthorIndex]) {
      authorInputRefs.current[focusAuthorIndex]?.focus();
      setFocusAuthorIndex(null);
    }
  }, [focusAuthorIndex, creatorsList]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFieldChange = (field: keyof Paper | string, value: any) => {
    if (onUpdatePaper) {
      onUpdatePaper({ [field]: value });
      toast.success('Saved', { duration: 800 });
    }
  };

  // Creator management
  const handleUpdateCreatorName = (index: number, newName: string) => {
    const updated = [...creatorsList];
    if (newName.trim()) {
      updated[index] = { ...updated[index], name: newName.trim() };
    } else {
      updated.splice(index, 1);
    }
    const authorNames = updated.map((c) => c.name);
    handleFieldChange('authors', authorNames.length ? authorNames : undefined);
    handleFieldChange('creators', updated.length ? updated : undefined);
  };

  const handleUpdateCreatorType = (index: number, newType: string) => {
    const updated = [...creatorsList];
    updated[index] = { ...updated[index], creatorType: newType };
    const authorNames = updated.map((c) => c.name);
    handleFieldChange('authors', authorNames);
    handleFieldChange('creators', updated);
  };

  const handleAddCreator = (afterIndex?: number) => {
    const updated = [...creatorsList];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : updated.length;
    const defaultRole = typeDefinition.primaryCreatorType || 'author';
    updated.splice(insertAt, 0, { creatorType: defaultRole, name: '' });
    setIsAuthorsExpanded(true);
    setFocusAuthorIndex(insertAt);
    const authorNames = updated.map((c) => c.name);
    handleFieldChange('authors', authorNames);
    handleFieldChange('creators', updated);
  };

  const handleRemoveCreator = (index: number) => {
    const updated = creatorsList.filter((_, idx) => idx !== index);
    const authorNames = updated.map((c) => c.name);
    handleFieldChange('authors', authorNames.length ? authorNames : undefined);
    handleFieldChange('creators', updated.length ? updated : undefined);
  };

  const displayDoi = cleanDoi(paper.doi);
  const isPublicUrl = paper.url && paper.url.startsWith('http') && !paper.url.includes('/api/files/');

  /**
   * Helper to retrieve value for a field definition key from paper
   */
  const getFieldValue = (fieldKey: string): string => {
    const p = paper as any;
    if (fieldKey === 'date') {
      return cleanValue(p.publicationDate || (p.year ? String(p.year) : ''));
    }
    if (fieldKey === 'publicationTitle' || fieldKey === 'journal') {
      return cleanValue(p.publicationTitle || p.journal);
    }
    if (fieldKey === 'journalAbbreviation' || fieldKey === 'journalAbbr') {
      return cleanValue(p.journalAbbr || p.journalAbbreviation);
    }
    if (fieldKey === 'accessDate' || fieldKey === 'accessedAt') {
      return cleanValue(p.accessDate || (p.accessedAt ? formatAuditDate(p.accessedAt) : ''));
    }
    if (fieldKey === 'doi' || fieldKey === 'DOI') {
      return displayDoi;
    }
    if (fieldKey === 'pmid' || fieldKey === 'PMID') {
      return cleanValue(p.pmid || p.PMID);
    }
    if (fieldKey === 'pmcid' || fieldKey === 'PMCID') {
      return cleanValue(p.pmcid || p.PMCID);
    }
    if (fieldKey === 'arxivId' || fieldKey === 'arXivId' || fieldKey === 'arxiv') {
      return cleanValue(p.arxivId || p.arXivId || p.arxiv);
    }
    if (fieldKey === 'series' || fieldKey === 'seriesTitle') {
      return cleanValue(p.series || p.seriesTitle);
    }
    if (fieldKey === 'seriesNumber' || fieldKey === 'seriesText') {
      return cleanValue(p.seriesNumber || p.seriesText);
    }
    if (fieldKey === 'rights' || fieldKey === 'license') {
      return cleanValue(p.rights || p.license);
    }
    if (fieldKey === 'publisher') {
      return cleanValue(p.publisher);
    }
    if (fieldKey === 'place') {
      return cleanValue(p.place);
    }
    if (fieldKey === 'issn') {
      return cleanValue(p.issn);
    }
    if (fieldKey === 'isbn') {
      return cleanValue(p.isbn);
    }
    if (fieldKey === 'language') {
      return cleanValue(p.language);
    }
    if (fieldKey === 'callNumber') {
      return cleanValue(p.callNumber);
    }
    if (fieldKey === 'archive') {
      return cleanValue(p.archive);
    }
    if (fieldKey === 'archiveLocation') {
      return cleanValue(p.archiveLocation);
    }
    if (fieldKey === 'libraryCatalog') {
      return cleanValue(p.libraryCatalog);
    }
    if (fieldKey === 'abstractNote' || fieldKey === 'abstract') {
      return cleanValue(p.abstract || p.abstractNote);
    }
    return cleanValue(p[fieldKey]);
  };

  /**
   * Helper to save value for a dynamic field definition
   */
  const saveFieldValue = (fieldDef: SchemaFieldDefinition, val: string) => {
    const key = fieldDef.field;
    if (key === 'date') {
      const parsedYear = parseInt(val, 10);
      handleFieldChange('year', isNaN(parsedYear) || parsedYear === 0 ? undefined : parsedYear);
      handleFieldChange('publicationDate', val || undefined);
    } else if (key === 'doi' || key === 'DOI') {
      handleFieldChange('doi', cleanDoi(val) || undefined);
    } else if (key === 'publicationTitle' || key === 'journal') {
      handleFieldChange('publicationTitle', val || undefined);
      handleFieldChange('journal', val || undefined);
    } else if (key === 'journalAbbreviation' || key === 'journalAbbr') {
      handleFieldChange('journalAbbr', val || undefined);
      handleFieldChange('journalAbbreviation', val || undefined);
    } else if (key === 'accessDate' || key === 'accessedAt') {
      handleFieldChange('accessDate', val || undefined);
    } else if (key === 'pmid' || key === 'PMID') {
      handleFieldChange('pmid', val || undefined);
    } else if (key === 'pmcid' || key === 'PMCID') {
      handleFieldChange('pmcid', val || undefined);
    } else if (key === 'arxivId' || key === 'arXivId') {
      handleFieldChange('arxivId', val || undefined);
    } else if (key === 'rights' || key === 'license') {
      handleFieldChange('rights', val || undefined);
      handleFieldChange('license', val || undefined);
    } else if (key === 'abstractNote' || key === 'abstract') {
      handleFieldChange('abstract', val || undefined);
      handleFieldChange('abstractNote', val || undefined);
    } else {
      handleFieldChange(key, val || undefined);
    }
  };

  // Filter out fields that are handled specially (title, abstractNote, extra)
  const dynamicFields = useMemo(() => {
    return typeDefinition.fields.filter(
      (f) => f.field !== 'title' && f.field !== 'abstractNote' && f.field !== 'extra',
    );
  }, [typeDefinition]);

  // Group dynamic fields by category for clean visual separation
  const venueAndPubFields = useMemo(
    () => dynamicFields.filter((f) => f.category === 'venue' || f.category === 'publication'),
    [dynamicFields],
  );

  const identifierAndAccessFields = useMemo(
    () => dynamicFields.filter((f) => f.category === 'identifiers' || f.category === 'archive'),
    [dynamicFields],
  );

  const otherFields = useMemo(
    () =>
      dynamicFields.filter(
        (f) =>
          f.category !== 'venue' &&
          f.category !== 'publication' &&
          f.category !== 'identifiers' &&
          f.category !== 'archive',
      ),
    [dynamicFields],
  );

  return (
    <div className="space-y-4 select-text">
      {/* ── 1. Core Header (Item Type, Title, Creators, Abstract) ────────────── */}
      <div className="space-y-0.5 divide-y divide-border/10">
        {/* Item Type */}
        <div className="grid grid-cols-[84px_1fr] gap-2 items-center text-xs py-1">
          <span className="text-muted-foreground font-medium select-none" id="label-item-type">
            Item Type
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <select
              aria-labelledby="label-item-type"
              aria-label="Item Type"
              value={currentItemType}
              onChange={(e) => handleFieldChange('itemType', e.target.value)}
              className="w-full bg-transparent hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border text-foreground text-xs font-medium outline-none cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              {ALL_ITEM_TYPES_FLAT.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {paper.provenance?.isOpenAccess && (
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 font-medium select-none px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                Open Access
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="grid grid-cols-[84px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-title">
            Title
          </span>
          <InlineTextarea
            value={cleanValue(paper.title)}
            ariaLabel="Paper Title"
            placeholder="Click to enter title..."
            onSave={(val) => handleFieldChange('title', val || undefined)}
            className="font-semibold text-foreground text-xs leading-snug"
            rows={1}
          />
        </div>

        {/* Creators / Authors */}
        <div className="py-1 space-y-1">
          {creatorsList.length === 0 ? (
            <div className="grid grid-cols-[84px_1fr] gap-2 items-center text-xs">
              <span className="text-muted-foreground font-medium select-none">
                {typeDefinition.creatorTypes[0]?.label || 'Author'}
              </span>
              <button
                onClick={() => handleAddCreator()}
                className="text-[11px] text-primary hover:underline text-left cursor-pointer flex items-center gap-1 font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded px-1"
                aria-label="Add author"
              >
                <Plus className="size-3" aria-hidden="true" />
                <span>Add {typeDefinition.creatorTypes[0]?.label || 'Author'}</span>
              </button>
            </div>
          ) : (
            <>
              {visibleCreators.map((creator, idx) => (
                <div key={idx} className="grid grid-cols-[84px_1fr] gap-2 items-center text-xs group">
                  {/* Left Role Column */}
                  <div className="flex items-center min-w-0">
                    <select
                      value={creator.creatorType}
                      onChange={(e) => handleUpdateCreatorType(idx, e.target.value)}
                      className="appearance-none bg-transparent text-muted-foreground hover:text-foreground text-xs font-medium border-0 outline-none cursor-pointer p-0 select-none w-full truncate"
                      aria-label="Creator Role"
                      title="Click to change creator role"
                    >
                      {typeDefinition.creatorTypes.map((ct) => (
                        <option key={ct.creatorType} value={ct.creatorType}>
                          {ct.label}
                        </option>
                      ))}
                      {!typeDefinition.creatorTypes.some((ct) => ct.creatorType === creator.creatorType) && (
                        <option value={creator.creatorType}>
                          {ALL_CREATOR_TYPES[creator.creatorType] || creator.creatorType}
                        </option>
                      )}
                    </select>
                  </div>
                  {/* Right Input Column */}
                  <div className="flex items-center gap-1 min-w-0">
                    <input
                      ref={(el) => {
                        authorInputRefs.current[idx] = el;
                      }}
                      type="text"
                      value={creator.name}
                      placeholder="Lastname, Firstname or Org..."
                      aria-label={`Creator ${idx + 1}`}
                      onChange={(e) => {
                        const updated = [...creatorsList];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        handleFieldChange('authors', updated.map((c) => c.name));
                      }}
                      onBlur={(e) => handleUpdateCreatorName(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdateCreatorName(idx, (e.target as HTMLInputElement).value);
                          handleAddCreator(idx);
                        } else if (e.key === 'Backspace' && creator.name === '' && creatorsList.length > 1) {
                          e.preventDefault();
                          handleRemoveCreator(idx);
                        }
                      }}
                      className="w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-normal font-normal truncate placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                    />
                    <button
                      onClick={() => handleAddCreator(idx)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-opacity cursor-pointer shrink-0"
                      title="Insert creator below (or press Enter)"
                      aria-label="Insert creator below"
                    >
                      <Plus className="size-3" />
                    </button>
                    {creatorsList.length > 1 && (
                      <button
                        onClick={() => handleRemoveCreator(idx)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-muted transition-opacity cursor-pointer shrink-0"
                        title="Remove creator"
                        aria-label="Remove creator"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {creatorsList.length > MAX_COLLAPSED_AUTHORS + 1 && (
                <div className="grid grid-cols-[84px_1fr] gap-2 items-center text-xs pt-0.5">
                  <span />
                  <button
                    onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer py-0.5 transition-colors hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded px-1"
                    aria-expanded={isAuthorsExpanded}
                  >
                    {isAuthorsExpanded ? (
                      <>
                        <ChevronUp className="size-3" aria-hidden="true" />
                        <span>Show less ({MAX_COLLAPSED_AUTHORS} of {creatorsList.length})</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3" aria-hidden="true" />
                        <span>+ {creatorsList.length - MAX_COLLAPSED_AUTHORS} more (Show all {creatorsList.length})</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 2. Venue & Publication Metadata (Dynamic fields) ────────────────── */}
      {venueAndPubFields.length > 0 && (
        <div className="space-y-0.5 divide-y divide-border/10 border-t border-border/20 pt-1">
          {venueAndPubFields.map((fieldDef) => {
            const val = getFieldValue(fieldDef.field);
            return (
              <div key={fieldDef.field} className="grid grid-cols-[84px_1fr] gap-2 items-start text-xs py-1">
                <span className="text-muted-foreground font-medium select-none pt-1">
                  {fieldDef.label}
                </span>
                <InlineField
                  value={val}
                  ariaLabel={fieldDef.label}
                  placeholder={fieldDef.placeholder || `${fieldDef.label}...`}
                  onSave={(newVal) => saveFieldValue(fieldDef, newVal)}
                  className="text-foreground"
                  mono={fieldDef.mono}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. Identifiers & Access (Dynamic fields: DOI, URL, ISBN, etc.) ────── */}
      {identifierAndAccessFields.length > 0 && (
        <div className="space-y-0.5 divide-y divide-border/10 border-t border-border/20 pt-1">
          {identifierAndAccessFields.map((fieldDef) => {
            const val = getFieldValue(fieldDef.field);
            const isDoi = fieldDef.field.toLowerCase() === 'doi';
            const isUrl = fieldDef.field === 'url';

            return (
              <div key={fieldDef.field} className="grid grid-cols-[84px_1fr] gap-2 items-start text-xs py-1 group">
                <span className="text-muted-foreground font-medium select-none pt-1">
                  {fieldDef.label}
                </span>
                <div className="flex items-center gap-1 min-w-0">
                  <InlineField
                    value={val}
                    ariaLabel={fieldDef.label}
                    placeholder={fieldDef.placeholder || `${fieldDef.label}...`}
                    onSave={(newVal) => saveFieldValue(fieldDef, newVal)}
                    className="text-foreground flex-1"
                    mono={fieldDef.mono}
                  />

                  {/* DOI Quick Actions */}
                  {isDoi && displayDoi && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`https://doi.org/${displayDoi}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                        title="Open DOI link"
                        aria-label="Open DOI Link in new tab"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                      <button
                        onClick={() => copyToClipboard(displayDoi, 'DOI')}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                        title="Copy DOI"
                        aria-label="Copy DOI"
                      >
                        {copiedKey === 'DOI' ? (
                          <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* URL Quick Action */}
                  {isUrl && isPublicUrl && (
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                      title="Open URL"
                      aria-label="Open URL in new tab"
                    >
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}

                  {/* PMID Quick Action */}
                  {fieldDef.field.toLowerCase() === 'pmid' && val && (
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(val)}/`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                      title="Open in PubMed"
                      aria-label="Open in PubMed in new tab"
                    >
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}

                  {/* PMCID Quick Action */}
                  {fieldDef.field.toLowerCase() === 'pmcid' && val && (
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(val)}/`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                      title="Open in PubMed Central"
                      aria-label="Open in PubMed Central in new tab"
                    >
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}

                  {/* arXiv Quick Action */}
                  {(fieldDef.field.toLowerCase() === 'arxivid' || fieldDef.field.toLowerCase() === 'arxiv') && val && (
                    <a
                      href={`https://arxiv.org/abs/${encodeURIComponent(val.replace(/^arxiv:/i, ''))}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                      title="Open in arXiv"
                      aria-label="Open in arXiv in new tab"
                    >
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. Other Specialized Fields (if any) ────────────────────────────── */}
      {otherFields.length > 0 && (
        <div className="space-y-0.5 divide-y divide-border/10 border-t border-border/20 pt-1">
          {otherFields.map((fieldDef) => {
            const val = getFieldValue(fieldDef.field);
            return (
              <div key={fieldDef.field} className="grid grid-cols-[84px_1fr] gap-2 items-start text-xs py-1">
                <span className="text-muted-foreground font-medium select-none pt-1">
                  {fieldDef.label}
                </span>
                <InlineField
                  value={val}
                  ariaLabel={fieldDef.label}
                  placeholder={fieldDef.placeholder || `${fieldDef.label}...`}
                  onSave={(newVal) => saveFieldValue(fieldDef, newVal)}
                  className="text-foreground"
                  mono={fieldDef.mono}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. Rights, Citation Key & Extra ──────────────────────────────────── */}
      <div className="space-y-0.5 divide-y divide-border/10 border-t border-border/20 pt-1">
        {/* Cite Key */}
        <div className="grid grid-cols-[84px_1fr] gap-2 items-center text-xs py-1 group">
          <span className="text-muted-foreground font-medium select-none" id="label-citekey">
            Cite Key
          </span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={cleanValue(paper.citationKey)}
              ariaLabel="BibTeX Citation Key"
              placeholder="e.g. vaswani2017attention"
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
                {copiedKey === 'Citation Key' ? (
                  <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Copy className="size-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Extra Field */}
        <div className="grid grid-cols-[84px_1fr] gap-2 items-start text-xs py-1">
          <span className="text-muted-foreground font-medium select-none pt-1" id="label-extra">
            Extra
          </span>
          <textarea
            rows={2}
            value={cleanValue(paper.extra)}
            placeholder="Extra lines (key: value or CSL overrides)..."
            aria-labelledby="label-extra"
            onChange={(e) => handleFieldChange('extra', e.target.value)}
            className="w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-1 rounded border border-transparent focus:border-border transition-colors outline-none text-[11px] font-mono leading-relaxed resize-none placeholder:font-sans placeholder:text-muted-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>
      </div>

      {/* ── 6. Audit & History Footer (Date Added / Modified) ────────────────── */}
      {(isValidValue(paper.createdAt) || isValidValue(paper.updatedAt)) && (
        <div className="border-t border-border/20 pt-2 pb-1 text-[10px] text-muted-foreground/70 space-y-0.5 select-none font-mono">
          {isValidValue(paper.createdAt) && (
            <div className="flex items-center justify-between">
              <span>Date Added</span>
              <span className="text-foreground/70">{formatAuditDate(paper.createdAt)}</span>
            </div>
          )}
          {isValidValue(paper.updatedAt) && (
            <div className="flex items-center justify-between">
              <span>Modified</span>
              <span className="text-foreground/70">{formatAuditDate(paper.updatedAt)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
