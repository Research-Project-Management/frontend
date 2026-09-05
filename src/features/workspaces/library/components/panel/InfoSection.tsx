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
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';
import { normalizeAuthors, splitAuthorString, cleanDoi, extractArxivId } from '@/features/workspaces/library/utils/library.util';
import {
  LIBRARY_ITEM_TYPES,
  getItemTypeDefinition,
  mapRegistryItemTypes,
  ALL_CREATOR_TYPES,
  SchemaFieldDefinition,
  SchemaItemTypeDefinition,
} from '@/features/workspaces/library/schemas/item-type.schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import ConvertModal from '../modals/ConvertModal';
import { useLibraryClipboard } from '@/features/workspaces/library/hooks/library/use-clipboard';
import { useItemTypes } from '@/features/workspaces/library/hooks/library/use-items';
import { useConversion } from '@/features/workspaces/library/hooks/library/use-conversion';

interface InfoSectionProps {
  paper: CatalogItem;
  onUpdatePaper?: (data: Partial<CatalogItem>) => void;
}

/** Fields backed by first-class CatalogItem columns. All other registry fields
 * are persisted through extraFields, which survives registry additions without
 * another frontend allow-list change. */
const DIRECT_METADATA_FIELDS = new Set([
  'publisher', 'place', 'volume', 'issue', 'section', 'partNumber', 'partTitle',
  'pages', 'series', 'seriesTitle', 'seriesText', 'issn', 'isbn', 'url', 'type',
  'language', 'shortTitle', 'archive', 'archiveLocation', 'callNumber',
  'publicationDate', 'libraryCatalog',
]);

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

/** Format ISO date into locale format (e.g. 8/20/2026, 3:53:43 PM) */
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
function parseCreators(paper: CatalogItem): CreatorEntry[] {
  const rawCreators = (paper as any).creators || (paper as any).contributors;
  if (Array.isArray(rawCreators) && rawCreators.length > 0) {
    const parsed: CreatorEntry[] = [];
    for (const c of rawCreators) {
      const creatorType = c.creatorType || 'author';
      let name = cleanValue(c.name || c.fullName);
      const firstName = cleanValue(c.firstName || c.given);
      const lastName = cleanValue(c.lastName || c.family);
      if (!name && (firstName || lastName)) {
        name = [lastName, firstName].filter(Boolean).join(', ');
      }

      if (name) {
        const parts = splitAuthorString(name);
        for (const p of parts) {
          parsed.push({
            creatorType,
            name: p,
          });
        }
      } else {
        parsed.push({
          creatorType,
          name: '',
          firstName,
          lastName,
        });
      }
    }
    if (parsed.length > 0) return parsed;
  }

  const authors = normalizeAuthors(
    paper.authors,
    (paper as any).creators,
    (paper as any).contributors,
  );
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
        'w-full h-7 bg-transparent text-foreground px-2 py-[4px] rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-[12px] leading-[18px] font-normal truncate focus:outline-none focus-visible:outline-none font-sans',
        mono && 'font-mono text-[11.5px] tabular-nums tracking-normal',
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
    el.style.height = `${Math.max(28, el.scrollHeight)}px`;
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
        'w-full min-h-[28px] bg-transparent text-foreground px-2 py-[4px] rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-[12px] leading-[18px] font-normal resize-none overflow-hidden focus:outline-none focus-visible:outline-none break-words [overflow-wrap:anywhere] whitespace-pre-wrap font-sans',
        className,
      )}
    />
  );
}

export default function InfoSection({ paper, onUpdatePaper }: InfoSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const [focusAuthorIndex, setFocusAuthorIndex] = useState<number | null>(null);
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [targetConversionType, setTargetConversionType] = useState<string>('');
  const [isCheckingType, setIsCheckingType] = useState(false);
  const authorInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const MAX_COLLAPSED_AUTHORS = 5;

  const currentItemType = paper.itemType || 'journalArticle';
  const workspaceId = (paper as any).workspaceId || '';

  const { previewAsync, convertAsync } = useConversion(workspaceId);
  const { types: registryItemTypes } = useItemTypes(workspaceId || undefined);
  const itemTypeDefinitions = useMemo(() => {
    const serverDefinitions = mapRegistryItemTypes(registryItemTypes);
    return serverDefinitions.length > 0
      ? serverDefinitions
      : Object.values(LIBRARY_ITEM_TYPES);
  }, [registryItemTypes]);
  const selectableItemTypes = useMemo(
    () => itemTypeDefinitions
      .map(({ itemType, label }) => ({ value: itemType, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [itemTypeDefinitions],
  );
  const typeDefinition: SchemaItemTypeDefinition = useMemo(
    () => itemTypeDefinitions.find((type) => type.itemType === currentItemType)
      || getItemTypeDefinition(currentItemType)
      || getItemTypeDefinition('journalArticle')!,
    [currentItemType, itemTypeDefinitions],
  );

  const creatorTypesList = useMemo(() => {
    const list = [...(typeDefinition?.creatorTypes || [])];
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
  const paperContributors = (paper as any).contributors;
  const paperAuthors = paper.authors;

  useEffect(() => {
    setLocalCreators(parseCreators(paper));
  }, [paper, paperId, paperCreators, paperContributors, paperAuthors]);

  const visibleCreators = useMemo(() => {
    if (isAuthorsExpanded || localCreators.length <= MAX_COLLAPSED_AUTHORS) {
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

  const { copyToClipboard: copyWithToast } = useLibraryClipboard();

  const copyToClipboard = (text: string, label: string) => {
    copyWithToast(text, `Copied ${label}`);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFieldChange = (field: keyof CatalogItem | string, value: any) => {
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
  const getFieldValue = useCallback(
    (fieldKey: string): string => {
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
        return cleanValue(p.genre || p.type || p.itemType);
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
        return cleanValue(p.archive || p.extraFields?.repository);
      }
      if (fieldKey === 'archiveLocation') {
        return cleanValue(p.archiveLocation || p.extraFields?.archiveId);
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
        return cleanValue(p.university || p.institution || p.extraFields?.university || p.extraFields?.institution);
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
    },
    [paper, displayDoi],
  );

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
      handleFieldChange('accessedAt', val || undefined);
    } else if (key === 'pmid' || key === 'PMID') {
      handleFieldChange('pmid', val || undefined);
    } else if (key === 'pmcid' || key === 'PMCID') {
      handleFieldChange('pmcid', val || undefined);
    } else if (key === 'arxivId' || key === 'arXivId') {
      handleFieldChange('arxivId', val || undefined);
    } else if (key === 'rights' || key === 'license') {
      handleFieldChange('rights', val || undefined);
      handleFieldChange('license', val || undefined);
    } else if (key === 'citationCount') {
      const parsed = parseInt(val.replace(/,/g, ''), 10);
      handleFieldChange('citationCount', isNaN(parsed) ? undefined : (parsed as any));
    } else if (key === 'abstractNote' || key === 'abstract') {
      handleFieldChange('abstract', val || undefined);
      handleFieldChange('abstractNote', val || undefined);
    } else if (key === 'citationKey' || key === 'citeKey') {
      handleFieldChange('citationKey', val || undefined);
    } else if (DIRECT_METADATA_FIELDS.has(key)) {
      // Keep an empty string for first-class columns so clearing a field is a
      // real update rather than an omitted PATCH property.
      handleFieldChange(key, val);
    } else {
      // Do not send arbitrary registry keys as top-level DTO properties. The
      // backend stores these in its JSON metadata bag and projects them back to
      // the item, so new registry fields work without a client release.
      handleFieldChange('extraFields', { [key]: val || null });
    }
  };

  // Render all schema fields for the selected item type in registry order
  const dynamicFields = useMemo(() => {
    return (typeDefinition?.fields || []).filter(
      (f: SchemaFieldDefinition) =>
        f.field !== 'title' &&
        f.field !== 'abstractNote' &&
        f.field !== 'abstract' &&
        f.field !== 'extra' &&
        f.field !== 'dateAdded' &&
        f.field !== 'dateModified',
    );
  }, [typeDefinition]);

  return (
    <div className="space-y-0.5 select-text font-sans antialiased">
      {/* Item Type Selector */}
      <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
        <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate" id="label-item-type">
          Item Type
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full h-7 text-left px-2 py-[4px] rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary data-[state=open]:border-primary data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/5 text-[12px] leading-[18px] font-normal text-foreground bg-transparent cursor-pointer outline-none select-none truncate flex items-center justify-between"
                aria-label="Item Type"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isCheckingType ? (
                    <Loader2 className="size-3 animate-spin text-foreground" />
                  ) : null}
                  <span className="truncate">
                    {selectableItemTypes.find((t) => t.value === currentItemType)?.label || typeDefinition.label || currentItemType}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[360px] min-w-[210px] overflow-y-auto p-1 rounded-md shadow-none border border-border/60 bg-popover text-popover-foreground space-y-0.5">
              {selectableItemTypes.map((t) => {
                const isSelected = t.value === currentItemType;
                return (
                  <DropdownMenuItem
                    key={t.value}
                    onClick={async () => {
                      if (t.value === currentItemType || isCheckingType) return;
                      setIsCheckingType(true);
                      try {
                        const prev = await previewAsync({
                          itemId: paper.id,
                          targetType: t.value,
                          retainUnmappedInExtra: true,
                        });
                        if (!prev.hasLoss) {
                          // Lossless: convert immediately without dialog
                          const result = await convertAsync({
                            itemId: paper.id,
                            targetType: t.value,
                            expectedVersion: (paper as any).version,
                            retainUnmappedInExtra: true,
                          });
                          const updated = (result as any)?.item ?? (result as any)?.data ?? result;
                          onUpdatePaper?.(updated);
                        } else {
                          // Lossy: open modal with preview already loaded
                          setTargetConversionType(t.value);
                          setIsConversionDialogOpen(true);
                        }
                      } catch {
                        // Errors surfaced by hooks via toast
                        setTargetConversionType(t.value);
                        setIsConversionDialogOpen(true);
                      } finally {
                        setIsCheckingType(false);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2.5 h-7 px-2.5 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-black/5 dark:hover:bg-white/5',
                      isSelected && 'bg-black/10 dark:bg-white/10 font-medium',
                    )}
                  >
                    <span className="w-2.5 text-center text-xs font-normal text-foreground shrink-0 select-none">
                      {isSelected ? '•' : ''}
                    </span>
                    <span className="truncate text-foreground">{t.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <div className="grid grid-cols-[96px_1fr] gap-1.5 items-start py-0.5">
        <span className="text-muted-foreground text-right font-normal select-none pr-2 pt-[5px] text-[12px] leading-[18px] whitespace-nowrap" id="label-title">
          Title
        </span>
        <InlineTextarea
          value={cleanValue(paper.title)}
          ariaLabel="Item Title"
          onSave={(val) => handleFieldChange('title', val || undefined)}
          className="font-normal text-foreground text-[12px] leading-[18px]"
          rows={1}
        />
      </div>

      {/* Creators / Authors */}
      <div className="py-0.5 space-y-0.5">
        {localCreators.length === 0 ? (
          <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
            <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate">
              {typeDefinition.creatorTypes[0]?.label || 'Author'}
            </span>
            <input
              type="text"
              aria-label="Author"
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) {
                  handleFieldChange('authors', [val]);
                  handleFieldChange('creators', [{ name: val, creatorType: 'author' }]);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) {
                    handleFieldChange('authors', [val]);
                    handleFieldChange('creators', [{ name: val, creatorType: 'author' }]);
                  }
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="flex-1 h-7 bg-transparent px-2 py-[4px] rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-[12px] leading-[18px] outline-none min-w-0 font-normal font-sans"
            />
          </div>
        ) : (
          <>
            {visibleCreators.map((creator, idx) => (
              <div key={idx} className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5 group">
                {/* Left Role Column */}
                <div className="flex items-center justify-end min-w-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full h-7 flex items-center justify-end pr-2 rounded-md text-[12px] leading-[18px] font-normal text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-right"
                        aria-label={`Change role for creator ${idx + 1}`}
                      >
                        <span className="truncate">
                          {ALL_CREATOR_TYPES[creator.creatorType] || creator.creatorType || 'Author'}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px] p-1 rounded-md shadow-none border border-border/60 bg-popover text-popover-foreground space-y-0.5">
                      {creatorTypesList.map((ct) => (
                        <DropdownMenuItem
                          key={ct.creatorType}
                          onClick={() => handleUpdateCreatorType(idx, ct.creatorType)}
                          className={cn(
                            'flex items-center justify-between h-7 px-2 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-black/5 dark:hover:bg-white/5',
                            creator.creatorType === ct.creatorType && 'bg-black/10 dark:bg-white/10 font-medium',
                          )}
                        >
                          <span className="text-foreground">{ct.label}</span>
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
                      const val = e.target.value;
                      if (val.includes(';') || /\s+and\s+/i.test(val) || val.includes('\n')) {
                        const parts = splitAuthorString(val);
                        if (parts.length > 1) {
                          const updated = [...localCreators];
                          const newEntries = parts.map((p) => ({
                            creatorType: updated[idx]?.creatorType || 'author',
                            name: p,
                          }));
                          updated.splice(idx, 1, ...newEntries);
                          setLocalCreators(updated);
                          return;
                        }
                      }
                      const updated = [...localCreators];
                      updated[idx] = { ...updated[idx], name: val };
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
                    className="flex-1 h-7 bg-transparent px-2 py-[4px] rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-[12px] leading-[18px] outline-none min-w-0 font-normal font-sans"
                  />
                  {/* Action Buttons (Add / Remove) */}
                  <div className="invisible group-hover:visible flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAddCreator(idx)}
                      className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                      aria-label="Add creator below"
                    >
                      <Plus className="size-3.5 text-foreground" aria-hidden="true" />
                    </button>

                    {localCreators.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCreator(idx)}
                        className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                        aria-label="Remove creator"
                      >
                        <Minus className="size-3.5 text-foreground" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {localCreators.length > MAX_COLLAPSED_AUTHORS && (
              <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center pt-0.5">
                <span />
                <button
                  type="button"
                  onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground font-medium cursor-pointer py-1 px-1 -ml-1 hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none rounded-md w-fit transition-colors select-none"
                  aria-expanded={isAuthorsExpanded}
                >
                  {isAuthorsExpanded ? (
                    <>
                      <ChevronUp className="size-3.5" aria-hidden="true" />
                      <span>Show less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3.5" aria-hidden="true" />
                      <span>Show {localCreators.length - MAX_COLLAPSED_AUTHORS} more authors</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dynamic Schema Fields for Selected Item Type */}
      {dynamicFields.map((fieldDef: SchemaFieldDefinition) => {
        const rawVal = getFieldValue(fieldDef.field);
        const isDoi = fieldDef.field.toLowerCase() === 'doi';
        const isUrl = fieldDef.field === 'url';
        const isCitations = fieldDef.field.toLowerCase() === 'citationcount';
        const val = isCitations && rawVal && !isNaN(Number(rawVal))
          ? new Intl.NumberFormat('en-US').format(Number(rawVal))
          : rawVal;

        return (
          <div key={fieldDef.field} className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5 group">
            <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate" title={fieldDef.label}>
              {fieldDef.label}
            </span>
            <div className="flex items-center gap-1 min-w-0">
              <InlineField
                value={val}
                ariaLabel={fieldDef.label}
                onSave={(newVal) => saveFieldValue(fieldDef, newVal)}
                mono={fieldDef.mono}
              />

              {/* Citations Provider Badge / Quick Action */}
              {isCitations && rawVal && (
                <div className="invisible group-hover:visible flex items-center gap-1 shrink-0">
                  <a
                    href={
                      displayDoi
                        ? `https://openalex.org/works?search=${encodeURIComponent(displayDoi)}`
                        : `https://openalex.org/works?search=${encodeURIComponent(paper.title || '')}`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] text-foreground bg-muted/60 hover:bg-black/5 dark:hover:bg-white/5 px-1.5 py-0.5 rounded-md border border-border/40 select-none"
                    aria-label="View citations on OpenAlex"
                  >
                    <span>OpenAlex</span>
                    <ExternalLink className="size-2.5 text-foreground" aria-hidden="true" />
                  </a>
                </div>
              )}

              {/* DOI Quick Actions */}
              {isDoi && displayDoi && (
                <div className="invisible group-hover:visible flex items-center gap-0.5 shrink-0">
                  <a
                    href={`https://doi.org/${displayDoi}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Open DOI link in new tab"
                  >
                    <ExternalLink className="size-3.5 text-foreground" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(displayDoi, 'DOI')}
                    className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Copy DOI"
                  >
                    {copiedKey === 'DOI' ? (
                      <CheckCircle2 className="size-3.5 text-foreground" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5 text-foreground" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}

              {/* URL Quick Action */}
              {isUrl && val && (
                <div className="invisible group-hover:visible flex items-center shrink-0">
                  <a
                    href={val.startsWith('http') ? val : `https://${val}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Open URL in new tab"
                  >
                    <ExternalLink className="size-3.5 text-foreground" aria-hidden="true" />
                  </a>
                </div>
              )}

              {/* PubMed Quick Action */}
              {(fieldDef.field.toLowerCase() === 'pmid' || fieldDef.field.toLowerCase() === 'pmcid') && val && (
                <div className="invisible group-hover:visible flex items-center shrink-0">
                  <a
                    href={
                      fieldDef.field.toLowerCase() === 'pmid'
                        ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(val)}/`
                        : `https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(val)}/`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label={`Open in PubMed ${fieldDef.field.toUpperCase()} in new tab`}
                  >
                    <ExternalLink className="size-3.5 text-foreground" aria-hidden="true" />
                  </a>
                </div>
              )}

              {/* arXiv Quick Action */}
              {(fieldDef.field.toLowerCase() === 'arxivid' || fieldDef.field.toLowerCase() === 'arxiv') && val && (
                <div className="invisible group-hover:visible flex items-center shrink-0">
                  <a
                    href={`https://arxiv.org/abs/${encodeURIComponent(val.replace(/^arxiv:/i, ''))}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Open in arXiv in new tab"
                  >
                    <ExternalLink className="size-3.5 text-foreground" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Cite Key */}
      {isValidValue(paper.citationKey) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5 group">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate" id="label-citekey">
            Cite Key
          </span>
          <div className="flex items-center gap-1 min-w-0">
            <InlineField
              value={cleanValue(paper.citationKey)}
              ariaLabel="BibTeX Citation Key"
              onSave={(val) => handleFieldChange('citationKey', val || undefined)}
              mono
            />
            <div className="invisible group-hover:visible flex items-center shrink-0">
              <button
                type="button"
                onClick={() => copyToClipboard(`\\cite{${paper.citationKey}}`, 'Citation Key')}
                className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer focus-visible:outline-none"
                aria-label={`Copy citation key \\cite{${paper.citationKey}}`}
              >
                {copiedKey === 'Citation Key' ? (
                  <CheckCircle2 className="size-3.5 text-foreground" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5 text-foreground" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Field */}
      {isValidValue(paper.extra) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate" id="label-extra">
            Extra
          </span>
          <InlineField
            value={cleanValue(paper.extra)}
            ariaLabel="Extra"
            onSave={(val) => handleFieldChange('extra', val || undefined)}
          />
        </div>
      )}

      {/* Date Added */}
      {isValidValue(paper.createdAt) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate">
            Date Added
          </span>
          <span className="text-foreground text-[12px] leading-[18px] px-2 py-[4px] select-text truncate font-normal h-7 flex items-center font-sans">
            {formatAuditDate(paper.createdAt)}
          </span>
        </div>
      )}

      {/* Modified */}
      {isValidValue(paper.updatedAt) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-[12px] leading-[18px] truncate">
            Modified
          </span>
          <span className="text-foreground text-[12px] leading-[18px] px-2 py-[4px] select-text truncate font-normal h-7 flex items-center font-sans">
            {formatAuditDate(paper.updatedAt)}
          </span>
        </div>
      )}

      {/* Item Type Conversion Modal */}
      <ConvertModal
        open={isConversionDialogOpen}
        onOpenChange={setIsConversionDialogOpen}
        paper={paper}
        targetType={targetConversionType}
        onSuccess={(updatedPaper: any) => {
          onUpdatePaper?.(updatedPaper);
        }}
      />
    </div>
  );
}
