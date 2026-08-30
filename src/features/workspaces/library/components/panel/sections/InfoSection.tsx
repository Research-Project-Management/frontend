'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ExternalLink,
  Copy,
  Plus,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import type { Paper } from '@/features/workspaces/library/types/library.types';
import { normalizeAuthors, cleanDoi, extractArxivId } from '@/features/workspaces/library/utils/library.util';
import {
  ALL_ITEM_TYPES_FLAT,
  getZoteroItemTypeDefinition,
  ALL_CREATOR_TYPES,
  SchemaFieldDefinition,
} from '@/features/workspaces/library/schemas/zotero-schema';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface InfoSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

/** Filter out empty, null, undefined, or junk placeholder string values */
function isValidValue(val?: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val) && Number.isFinite(val);
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
      lower !== 'unknown'
    );
  }
  return false;
}

/** Clean string value or return empty string */
function cleanValue(val?: any): string {
  if (!isValidValue(val)) return '';
  return String(val).trim();
}

/** Format ISO date into exact Zotero locale format (e.g. 8/20/2026, 3:53:43 PM) */
function formatAuditDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
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
    const parsed = rawCreators.map((c: any) => {
      const creatorType = c.creatorType || 'author';
      let name = cleanValue(c.name || c.fullName);
      const firstName = cleanValue(c.firstName || c.given);
      const lastName = cleanValue(c.lastName || c.family);
      if (!name && (firstName || lastName)) {
        name = [lastName, firstName].filter(Boolean).join(', ');
      }
      return {
        creatorType,
        name: name || '',
        firstName,
        lastName,
      };
    });
    if (parsed.length > 0) return parsed;
  }

  const authors = normalizeAuthors(paper.authors, null);
  if (authors.length > 0) {
    return authors.map((name) => ({
      creatorType: 'author',
      name: name || '',
    }));
  }

  return [];
}

/** Clean Inline Editable Text Input (Saves on Enter / Blur, Cancels on Escape, No Placeholders) */
function InlineField({
  value,
  ariaLabel,
  onSave,
  className,
  mono,
}: {
  value: string;
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
      aria-label={ariaLabel || 'Metadata field'}
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
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-normal font-normal truncate focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
        mono && 'font-mono text-xs',
        className,
      )}
    />
  );
}

/** Clean Inline Editable Auto-Expanding Textarea for Title (No Placeholders) */
function InlineTextarea({
  value,
  ariaLabel,
  onSave,
  className,
  rows = 1,
}: {
  value: string;
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
      aria-label={ariaLabel || 'Field content'}
      rows={rows}
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
        'w-full bg-transparent text-foreground hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border transition-colors outline-none text-xs leading-relaxed resize-none overflow-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none break-words [overflow-wrap:anywhere] whitespace-pre-wrap',
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

  const creatorTypesList = useMemo(() => {
    const list = [...typeDefinition.creatorTypes];
    const standardRoles = ['author', 'contributor', 'editor', 'reviewedAuthor', 'translator'];
    for (const role of standardRoles) {
      if (!list.some((ct) => ct.creatorType === role)) {
        list.push({
          creatorType: role,
          label: ALL_CREATOR_TYPES[role] || role,
          primary: false,
        });
      }
    }
    return list;
  }, [typeDefinition]);

  const [localCreators, setLocalCreators] = useState<CreatorEntry[]>(() => parseCreators(paper));

  const paperId = paper.id;
  const paperCreators = (paper as any).creators;
  const paperAuthors = paper.authors;

  useEffect(() => {
    setLocalCreators(parseCreators(paper));
  }, [paper, paperId, paperCreators, paperAuthors]);

  const visibleCreators = useMemo(() => {
    if (isAuthorsExpanded || localCreators.length <= MAX_COLLAPSED_AUTHORS + 1) {
      return localCreators;
    }
    return localCreators.slice(0, MAX_COLLAPSED_AUTHORS);
  }, [localCreators, isAuthorsExpanded]);

  useEffect(() => {
    if (focusAuthorIndex !== null && authorInputRefs.current[focusAuthorIndex]) {
      authorInputRefs.current[focusAuthorIndex]?.focus();
      setFocusAuthorIndex(null);
    }
  }, [focusAuthorIndex, localCreators]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFieldChange = (field: keyof Paper | string, value: any) => {
    if (onUpdatePaper) {
      onUpdatePaper({ [field]: value });
    }
  };

  // Creator management
  const handleUpdateCreatorName = (index: number, newName: string) => {
    const updated = [...localCreators];
    if (updated[index]) {
      updated[index] = { ...updated[index], name: newName };
      setLocalCreators(updated);
      const validNames = updated.map((c) => c.name.trim()).filter(Boolean);
      handleFieldChange('authors', validNames.length ? validNames : undefined);
      handleFieldChange('creators', updated);
    }
  };

  const handleUpdateCreatorType = (index: number, newType: string) => {
    const updated = [...localCreators];
    if (updated[index]) {
      updated[index] = { ...updated[index], creatorType: newType };
      setLocalCreators(updated);
      handleFieldChange('creators', updated);
    }
  };

  const handleAddCreator = (afterIndex?: number) => {
    const role = typeDefinition.primaryCreatorType || 'author';
    const insertAt = typeof afterIndex === 'number' ? afterIndex + 1 : localCreators.length;
    const updated = [...localCreators];
    updated.splice(insertAt, 0, { creatorType: role, name: '' });
    setLocalCreators(updated);
    setIsAuthorsExpanded(true);
    setFocusAuthorIndex(insertAt);
  };

  const handleRemoveCreator = (index: number) => {
    const updated = localCreators.filter((_, idx) => idx !== index);
    setLocalCreators(updated);
    const validNames = updated.map((c) => c.name.trim()).filter(Boolean);
    handleFieldChange('authors', validNames.length ? validNames : undefined);
    handleFieldChange('creators', updated.length ? updated : undefined);
  };

  const displayDoi = cleanDoi(paper.doi);
  const isPublicUrl = paper.url && paper.url.startsWith('http') && !paper.url.includes('/api/files/');

  /**
   * Helper to retrieve value for a field definition key from paper
   */
  const getFieldValue = (fieldKey: string): string => {
    const p = paper as any;
    const derivedArxiv =
      cleanValue(p.arxivId || p.arXivId || p.arxiv) ||
      (p.url ? extractArxivId(p.url) : '') ||
      (p.callNumber ? extractArxivId(p.callNumber) : '');

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
      return cleanValue(p.arxivId || p.arXivId || p.arxiv || extractArxivId(p.url) || extractArxivId(p.callNumber));
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
    if (fieldKey === 'genre') {
      return cleanValue(p.genre || p.type);
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
    if (fieldKey === 'bookTitle') {
      return cleanValue(p.bookTitle || p.publicationTitle || p.journal || p.extraFields?.bookTitle);
    }
    if (fieldKey === 'proceedingsTitle') {
      return cleanValue(p.proceedingsTitle || p.publicationTitle || p.extraFields?.proceedingsTitle);
    }
    if (fieldKey === 'conferenceName') {
      return cleanValue(p.conferenceName || p.proceedingsTitle || p.publicationTitle || p.extraFields?.conferenceName);
    }
    if (fieldKey === 'university' || fieldKey === 'institution') {
      return cleanValue(p.university || p.institution || p.publisher || p.extraFields?.university || p.extraFields?.institution);
    }
    if (fieldKey === 'websiteTitle') {
      return cleanValue(p.websiteTitle || p.publicationTitle || p.extraFields?.websiteTitle);
    }
    if (fieldKey === 'websiteType' || fieldKey === 'thesisType' || fieldKey === 'reportType') {
      return cleanValue(p[fieldKey] || p.type || p.genre || p.extraFields?.[fieldKey]);
    }
    if (fieldKey === 'country') {
      return cleanValue(p.country || p.place || p.extraFields?.country);
    }
    return cleanValue(p[fieldKey] ?? p.extraFields?.[fieldKey] ?? p.customFields?.[fieldKey]);
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

  // Filter out fields that are handled specially (title, abstractNote, extra, citationKey)
  const dynamicFields = useMemo(() => {
    return typeDefinition.fields.filter(
      (f) =>
        f.field !== 'title' &&
        f.field !== 'abstractNote' &&
        f.field !== 'abstract' &&
        f.field !== 'extra' &&
        f.field !== 'citationKey' &&
        f.field !== 'citeKey',
    );
  }, [typeDefinition]);

  return (
    <div className="space-y-0.5 select-text font-sans antialiased">
      {/* Item Type (Shadcn DropdownMenu matching Zotero UI) */}
      <div className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs py-0.5">
        <span className="text-muted-foreground text-right font-normal select-none whitespace-nowrap" id="label-item-type">
          Item Type
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium text-foreground hover:bg-muted/40 data-[state=open]:bg-muted/60 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none truncate"
                aria-label="Item Type"
              >
                {ALL_ITEM_TYPES_FLAT.find((t) => t.value === currentItemType)?.label || typeDefinition.label || currentItemType}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[360px] min-w-[210px] overflow-y-auto p-1 text-xs rounded-lg shadow-none border border-border bg-popover text-popover-foreground">
              {ALL_ITEM_TYPES_FLAT.map((t) => {
                const isSelected = t.value === currentItemType;
                return (
                  <DropdownMenuItem
                    key={t.value}
                    onClick={() => handleFieldChange('itemType', t.value)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer transition-colors',
                      isSelected && 'font-medium text-foreground bg-muted/60',
                    )}
                  >
                    <span className="w-2.5 text-center text-xs font-bold text-foreground shrink-0 select-none">
                      {isSelected ? '•' : ''}
                    </span>
                    <span className="truncate">{t.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {paper.provenance?.isOpenAccess && (
            <span className="text-xs font-mono text-foreground shrink-0 font-medium select-none px-1.5 py-0.5 rounded bg-muted/40 border border-border/50">
              Open Access
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="grid grid-cols-[66px_1fr] gap-1.5 items-start text-xs py-0.5">
        <span className="text-muted-foreground text-right font-normal select-none pt-0.5 whitespace-nowrap" id="label-title">
          Title
        </span>
        <InlineTextarea
          value={cleanValue(paper.title)}
          ariaLabel="Paper Title"
          onSave={(val) => handleFieldChange('title', val || undefined)}
          className="font-medium text-foreground text-xs leading-snug"
          rows={1}
        />
      </div>

      {/* Creators / Authors */}
      <div className="py-0.5 space-y-0.5">
        {localCreators.length === 0 ? (
          <div className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs">
            <span className="text-muted-foreground text-right font-normal select-none whitespace-nowrap">
              {typeDefinition.creatorTypes[0]?.label || 'Author'}
            </span>
            <button
              type="button"
              onClick={() => handleAddCreator()}
              className="text-xs text-muted-foreground hover:text-foreground text-left cursor-pointer flex items-center gap-1 font-normal focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded px-1"
              aria-label="Add author"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Add {typeDefinition.creatorTypes[0]?.label || 'Author'}</span>
            </button>
          </div>
        ) : (
          <>
            {visibleCreators.map((creator, idx) => (
              <div key={idx} className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs group">
                {/* Left Role Column (Shadcn DropdownMenu matching Zotero UI) */}
                <div className="flex items-center justify-end min-w-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-end px-1 py-0.5 rounded text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted/40 data-[state=open]:bg-muted/60 data-[state=open]:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none text-right"
                        aria-label={`Change role for creator ${idx + 1}`}
                      >
                        <span className="whitespace-nowrap">
                          {ALL_CREATOR_TYPES[creator.creatorType] || creator.creatorType || 'Author'}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px] p-1 text-xs rounded-lg shadow-none border border-border bg-popover text-popover-foreground">
                      {creatorTypesList.map((ct) => (
                        <DropdownMenuItem
                          key={ct.creatorType}
                          onClick={() => handleUpdateCreatorType(idx, ct.creatorType)}
                          className={cn(
                            'flex items-center justify-between px-2 py-1.5 text-xs rounded cursor-pointer',
                            creator.creatorType === ct.creatorType && 'font-medium text-foreground bg-muted/60',
                          )}
                        >
                          <span>{ct.label}</span>
                          {creator.creatorType === ct.creatorType && (
                            <Check className="size-3 text-foreground shrink-0" aria-hidden="true" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Right Input Column */}
                <div className="flex items-center gap-1 min-w-0">
                  <input
                    ref={(el) => {
                      authorInputRefs.current[idx] = el;
                    }}
                    type="text"
                    value={creator.name}
                    aria-label={`Creator ${idx + 1}`}
                    onChange={(e) => {
                      const updated = [...localCreators];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setLocalCreators(updated);
                    }}
                    onBlur={() => {
                      const validNames = localCreators.map((c) => c.name.trim()).filter(Boolean);
                      handleFieldChange('authors', validNames.length ? validNames : undefined);
                      handleFieldChange('creators', localCreators);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCreator(idx);
                      }
                    }}
                    className="flex-1 bg-transparent hover:bg-muted/40 focus:bg-background px-1.5 py-0.5 rounded border border-transparent focus:border-border text-foreground text-xs outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none min-w-0 font-normal"
                  />
                  {/* Action Buttons (Add / Remove) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleAddCreator(idx)}
                            className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label="Add creator below"
                          >
                            <Plus className="size-3 text-foreground" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs py-0.5 px-1.5">
                          Add creator
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {localCreators.length > 1 && (
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleRemoveCreator(idx)}
                              className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                              aria-label="Remove creator"
                            >
                              <Minus className="size-3 text-foreground" aria-hidden="true" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs py-0.5 px-1.5">
                            Remove creator
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {localCreators.length > MAX_COLLAPSED_AUTHORS + 1 && (
              <div className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs pt-0.5">
                <span />
                <button
                  type="button"
                  onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-normal cursor-pointer py-0.5 transition-colors hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded"
                  aria-expanded={isAuthorsExpanded}
                >
                  {isAuthorsExpanded ? (
                    <>
                      <ChevronUp className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span>Show less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span>Show more</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dynamic Schema Fields for Selected Item Type in Zotero Schema Order */}
      {dynamicFields.map((fieldDef) => {
        const val = getFieldValue(fieldDef.field);
        const isDoi = fieldDef.field.toLowerCase() === 'doi';
        const isUrl = fieldDef.field === 'url';

        return (
          <div key={fieldDef.field} className="grid grid-cols-[66px_1fr] gap-1.5 items-start text-xs py-0.5 group">
            <span className="text-muted-foreground text-right font-normal select-none pt-0.5 whitespace-nowrap">
              {fieldDef.label}
            </span>
            <div className="flex items-center gap-1 min-w-0">
              <InlineField
                value={val}
                ariaLabel={fieldDef.label}
                onSave={(newVal) => saveFieldValue(fieldDef, newVal)}
                className="text-foreground flex-1 font-normal"
                mono={fieldDef.mono}
              />

              {/* DOI Quick Actions */}
              {isDoi && displayDoi && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://doi.org/${displayDoi}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                          aria-label="Open DOI link in new tab"
                        >
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs py-1 px-2">
                        Open DOI link
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(displayDoi, 'DOI')}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                          aria-label="Copy DOI"
                        >
                          {copiedKey === 'DOI' ? (
                            <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                          ) : (
                            <Copy className="size-3" aria-hidden="true" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs py-1 px-2">
                        Copy DOI
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {/* URL Quick Action */}
              {isUrl && val && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={val.startsWith('http') ? val : `https://${val}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label="Open URL in new tab"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs py-1 px-2">
                      Open in new tab
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* PubMed Quick Action */}
              {(fieldDef.field.toLowerCase() === 'pmid' || fieldDef.field.toLowerCase() === 'pmcid') && val && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={
                          fieldDef.field.toLowerCase() === 'pmid'
                            ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(val)}/`
                            : `https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(val)}/`
                        }
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={`Open in PubMed ${fieldDef.field.toUpperCase()} in new tab`}
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs py-1 px-2">
                      Open in {fieldDef.field.toUpperCase()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* arXiv Quick Action */}
              {(fieldDef.field.toLowerCase() === 'arxivid' || fieldDef.field.toLowerCase() === 'arxiv') && val && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`https://arxiv.org/abs/${encodeURIComponent(val.replace(/^arxiv:/i, ''))}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label="Open in arXiv in new tab"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs py-1 px-2">
                      Open in arXiv
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        );
      })}

      {/* Cite Key */}
      <div className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs py-0.5 group">
        <span className="text-muted-foreground text-right font-normal select-none whitespace-nowrap" id="label-citekey">
          Cite Key
        </span>
        <div className="flex items-center gap-1 min-w-0">
          <InlineField
            value={cleanValue(paper.citationKey)}
            ariaLabel="BibTeX Citation Key"
            onSave={(val) => handleFieldChange('citationKey', val || undefined)}
            className="text-foreground font-mono text-xs flex-1 font-normal"
            mono
          />
          {isValidValue(paper.citationKey) && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`\\cite{${paper.citationKey}}`, 'Citation Key')}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 shrink-0 transition-opacity focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded"
                    aria-label={`Copy citation key \\cite{${paper.citationKey}}`}
                  >
                    {copiedKey === 'Citation Key' ? (
                      <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3" aria-hidden="true" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs py-1 px-2">
                  Copy \cite&#123;key&#125;
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Extra Field */}
      <div className="grid grid-cols-[66px_1fr] gap-1.5 items-start text-xs py-0.5">
        <span className="text-muted-foreground text-right font-normal select-none pt-0.5 whitespace-nowrap" id="label-extra">
          Extra
        </span>
        <InlineField
          value={cleanValue(paper.extra)}
          ariaLabel="Extra"
          onSave={(val) => handleFieldChange('extra', val || undefined)}
          className="text-foreground flex-1 font-normal"
        />
      </div>

      {/* Date Added */}
      {isValidValue(paper.createdAt) && (
        <div className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none whitespace-nowrap">
            Date Added
          </span>
          <span className="text-foreground text-xs px-1.5 py-0.5 select-text truncate font-normal">
            {formatAuditDate(paper.createdAt)}
          </span>
        </div>
      )}

      {/* Modified */}
      {isValidValue(paper.updatedAt) && (
        <div className="grid grid-cols-[66px_1fr] gap-1.5 items-center text-xs py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none whitespace-nowrap">
            Modified
          </span>
          <span className="text-foreground text-xs px-1.5 py-0.5 select-text truncate font-normal">
            {formatAuditDate(paper.updatedAt)}
          </span>
        </div>
      )}
    </div>
  );
}
