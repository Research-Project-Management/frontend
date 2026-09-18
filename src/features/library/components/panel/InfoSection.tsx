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
  ShieldAlert,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { Item, CreatorCredit } from '@/features/library/types/library.types';
import { normalizeAuthors, splitAuthorString, cleanDoi, extractArxivId, formatAndSanitizeExtraMetadata, generateCitationKey } from '@/features/library/utils/library.util';
import {
  LIBRARY_ITEM_TYPES,
  getItemTypeDefinition,
  mapRegistryItemTypes,
  ALL_CREATOR_TYPES,
  getPrimaryCreatorType,
  SchemaFieldDefinition,
  SchemaItemTypeDefinition,
} from '@/features/library/schemas/item-type.schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui";
import ConvertModal from '../modals/ConvertModal';
import { toast } from 'sonner';
import { copyToClipboard as copyText } from "@/shared/lib/utils";
import { useItemTypes } from '@/features/library/hooks/use-items';
import { useConversion } from '@/features/library/hooks/use-conversion';

interface InfoSectionProps {
  paper: Item;
  onUpdatePaper?: (data: Partial<Item>) => void;
}

/** Fields backed by first-class Item columns. All other registry fields
 * are persisted through extraFields, which survives registry additions without
 * another frontend allow-list change. */
const DIRECT_METADATA_FIELDS = new Set([
  'publisher', 'place', 'volume', 'issue', 'section', 'partNumber', 'partTitle',
  'pages', 'series', 'seriesTitle', 'seriesText', 'seriesNumber', 'issn', 'ISSN',
  'isbn', 'ISBN', 'url', 'type', 'language', 'shortTitle', 'archive', 'archiveLocation',
  'callNumber', 'publicationDate', 'date', 'libraryCatalog', 'journalAbbr',
  'journalAbbreviation', 'doi', 'DOI', 'pmid', 'PMID', 'pmcid', 'PMCID', 'arxivId',
  'archiveId', 'archiveID', 'citationCount', 'referenceCount', 'openAccessPdfUrl',
  'rights', 'license', 'citationKey', 'citeKey', 'abstract', 'abstractNote',
  'publicationTitle', 'journal', 'accessedAt', 'accessDate',
  'bookTitle', 'proceedingsTitle', 'conferenceName', 'eventPlace', 'websiteTitle',
  'websiteType', 'university', 'institution', 'repository', 'edition', 'numPages',
  'numberOfPages', 'numberOfVolumes', 'thesisType', 'reportType', 'reportNumber',
  'genre', 'blogTitle', 'issueDate', 'priorityDate', 'patentNumber', 'issuingAuthority',
  'assignee', 'programmingLanguage',
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
function parseCreators(paper: Item): CreatorEntry[] {
  const rawCreators = paper.creators && paper.creators.length > 0
    ? paper.creators
    : paper.contributors;
  if (Array.isArray(rawCreators) && rawCreators.length > 0) {
    const parsedCreators: CreatorEntry[] = [];
    for (const rawCreatorItem of rawCreators) {
      const creatorType = rawCreatorItem.creatorType || 'author';
      let creatorName = cleanValue(rawCreatorItem.name || rawCreatorItem.fullName);
      const firstName = cleanValue(
        rawCreatorItem.firstName || (rawCreatorItem as Record<string, unknown>).given,
      );
      const lastName = cleanValue(
        rawCreatorItem.lastName || (rawCreatorItem as Record<string, unknown>).family,
      );
      if (!creatorName && (firstName || lastName)) {
        creatorName = [lastName, firstName].filter(Boolean).join(', ');
      }

      if (creatorName) {
        const splitNameParts = splitAuthorString(creatorName);
        for (const authorPart of splitNameParts) {
          parsedCreators.push({
            creatorType,
            name: authorPart,
          });
        }
      } else {
        parsedCreators.push({
          creatorType,
          name: '',
          firstName,
          lastName,
        });
      }
    }
    if (parsedCreators.length > 0) return parsedCreators;
  }

  const normalizedAuthorList = normalizeAuthors(
    paper.authors,
    paper.creators,
    paper.contributors,
  );
  if (normalizedAuthorList.length > 0) {
    const defaultRole = getPrimaryCreatorType(paper.itemType) || 'author';
    return normalizedAuthorList.map((authorName) => ({
      creatorType: defaultRole,
      name: authorName || '',
    }));
  }

  return [];
}

/** Compare two creator arrays for semantic equality to prevent redundant mutations */
function areCreatorsEqual(
  firstCreators: CreatorEntry[],
  secondCreators: CreatorEntry[],
): boolean {
  const normalizedFirstCreators = firstCreators.filter(
    (creatorItem) => creatorItem.name.trim().length > 0,
  );
  const normalizedSecondCreators = secondCreators.filter(
    (creatorItem) => creatorItem.name.trim().length > 0,
  );

  if (normalizedFirstCreators.length !== normalizedSecondCreators.length) {
    return false;
  }

  for (let creatorIndex = 0; creatorIndex < normalizedFirstCreators.length; creatorIndex += 1) {
    const firstCreator = normalizedFirstCreators[creatorIndex];
    const secondCreator = normalizedSecondCreators[creatorIndex];
    if (!firstCreator || !secondCreator) {
      return false;
    }
    const firstCreatorRole = firstCreator.creatorType || 'author';
    const secondCreatorRole = secondCreator.creatorType || 'author';
    if (firstCreatorRole !== secondCreatorRole) {
      return false;
    }
    const firstCreatorName = firstCreator.name.trim();
    const secondCreatorName = secondCreator.name.trim();
    if (firstCreatorName !== secondCreatorName) {
      return false;
    }
  }

  return true;
}

/** Convert CreatorEntry items into strongly typed CreatorCredit items for Item */
function toItemCreators(creatorEntries: CreatorEntry[]): CreatorCredit[] {
  return creatorEntries.map((creatorEntry, indexPosition) => ({
    orderIndex: indexPosition,
    creatorType: creatorEntry.creatorType || 'author',
    fullName: creatorEntry.name.trim(),
    name: creatorEntry.name.trim(),
    firstName: creatorEntry.firstName,
    lastName: creatorEntry.lastName,
  }));
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
        'w-full h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-12 leading-normal font-normal truncate focus:outline-none focus-visible:outline-none font-sans',
        mono && 'font-mono text-11 tabular-nums tracking-normal',
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
        'w-full min-h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-12 leading-normal font-normal resize-none overflow-hidden focus:outline-none focus-visible:outline-none break-words [overflow-wrap:anywhere] whitespace-pre-wrap font-sans',
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
  const scopeId = (paper as any).projectId || '';

  const { previewAsync, convertAsync } = useConversion(scopeId);
  const { types: registryItemTypes } = useItemTypes(scopeId || undefined);
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
  const paperCreators = paper.creators;
  const paperContributors = paper.contributors;
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

  const copyToClipboard = async (text: string, label: string) => {
    if (!text || !text.trim()) {
      toast.error('Nothing to copy', { id: 'library-clipboard' });
      return;
    }
    const ok = await copyText(text);
    if (ok) {
      toast.success(`Copied ${label}`, { id: 'library-clipboard' });
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 1500);
    } else {
      toast.error('Failed to copy to clipboard', { id: 'library-clipboard' });
    }
  };

  const handleFieldChange = (field: keyof Item | string, value: any) => {
    if (onUpdatePaper) {
      onUpdatePaper({ [field]: value });
    }
  };

  // Creator management
  const handleUpdateCreatorName = (targetIndex: number, newCreatorName: string) => {
    const currentCreator = localCreators[targetIndex];
    if (!currentCreator || currentCreator.name === newCreatorName) {
      return;
    }
    const updatedCreators = [...localCreators];
    updatedCreators[targetIndex] = { ...currentCreator, name: newCreatorName };
    setLocalCreators(updatedCreators);
    const existingCreators = parseCreators(paper);
    if (areCreatorsEqual(updatedCreators, existingCreators)) {
      return;
    }
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const allCreatorNames = updatedCreators
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const primaryCreatorNames = updatedCreators
      .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
    if (onUpdatePaper) {
      onUpdatePaper({
        authors: finalAuthors.length ? finalAuthors : undefined,
        creators: toItemCreators(updatedCreators),
      });
    }
  };

  const handleUpdateCreatorType = (targetIndex: number, newCreatorType: string) => {
    const currentCreator = localCreators[targetIndex];
    if (!currentCreator) return;
    const currentRole = currentCreator.creatorType || 'author';
    if (currentRole === newCreatorType) {
      return;
    }
    const updatedCreators = [...localCreators];
    updatedCreators[targetIndex] = { ...currentCreator, creatorType: newCreatorType };
    setLocalCreators(updatedCreators);
    const existingCreators = parseCreators(paper);
    if (areCreatorsEqual(updatedCreators, existingCreators)) {
      return;
    }
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const allCreatorNames = updatedCreators
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const primaryCreatorNames = updatedCreators
      .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
    if (onUpdatePaper) {
      onUpdatePaper({
        authors: finalAuthors.length ? finalAuthors : undefined,
        creators: toItemCreators(updatedCreators),
      });
    }
  };

  const handleAddCreator = (afterIndex?: number) => {
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const insertPosition = typeof afterIndex === 'number' ? afterIndex + 1 : localCreators.length;
    const updatedCreators = [...localCreators];
    updatedCreators.splice(insertPosition, 0, { creatorType: primaryRole, name: '' });
    setLocalCreators(updatedCreators);
    setIsAuthorsExpanded(true);
    setFocusAuthorIndex(insertPosition);
  };

  const handleRemoveCreator = (targetIndex: number) => {
    const updatedCreators = localCreators.filter((_, creatorIndex) => creatorIndex !== targetIndex);
    setLocalCreators(updatedCreators);
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const allCreatorNames = updatedCreators
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const primaryCreatorNames = updatedCreators
      .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
    if (onUpdatePaper) {
      onUpdatePaper({
        authors: finalAuthors.length ? finalAuthors : undefined,
        creators: updatedCreators.length ? toItemCreators(updatedCreators) : undefined,
      });
    }
  };

  const displayDoi = cleanDoi(paper.doi || (paper as any).DOI);
  const isPublicUrl = paper.url && paper.url.startsWith('http') && !paper.url.includes('/api/files/');

  /**
   * Helper to retrieve value for a field definition key from paper
   */
  const getFieldValue = useCallback(
    (fieldKey: string): string => {
      const p = paper as any;
      const keyLower = fieldKey.toLowerCase();
      const ef = (p.extraFields as Record<string, any>) || {};

      if (keyLower === 'date' || keyLower === 'publicationdate') {
        return cleanValue(p.publicationDate || (p.year ? String(p.year) : '') || p.date || ef.date || ef.publicationDate);
      }
      if (keyLower === 'issuedate') {
        return cleanValue(p.issueDate || ef.issueDate);
      }
      if (keyLower === 'prioritydate') {
        return cleanValue(p.priorityDate || ef.priorityDate);
      }
      if (keyLower === 'publicationtitle' || keyLower === 'journal') {
        return cleanValue(p.publicationTitle || (p.itemType === 'journalArticle' ? p.journal : '') || ef.publicationTitle);
      }
      if (keyLower === 'journalabbreviation' || keyLower === 'journalabbr') {
        return cleanValue(p.journalAbbr || p.journalAbbreviation || ef.journalAbbr || ef.journalAbbreviation);
      }
      if (keyLower === 'accessdate' || keyLower === 'accessedat') {
        return cleanValue(p.accessDate || (p.accessedAt ? formatAuditDate(p.accessedAt) : '') || ef.accessDate);
      }
      if (keyLower === 'doi') {
        return cleanValue(displayDoi || p.doi || p.DOI || ef.doi);
      }
      if (keyLower === 'pmid') {
        return cleanValue(p.pmid || p.PMID || ef.pmid);
      }
      if (keyLower === 'pmcid') {
        return cleanValue(p.pmcid || p.PMCID || ef.pmcid);
      }
      if (keyLower === 'issn') {
        return cleanValue(p.issn || p.ISSN || ef.issn);
      }
      if (keyLower === 'isbn') {
        return cleanValue(p.isbn || p.ISBN || ef.isbn);
      }
      if (keyLower === 'archiveid' || keyLower === 'arxivid' || keyLower === 'arxiv') {
        const raw = cleanValue(
          p.archiveId ||
          p.archiveID ||
          p.arxivId ||
          ef.archiveId ||
          ef.archiveID ||
          ef.arxivId ||
          extractArxivId(p.url) ||
          extractArxivId(p.callNumber),
        );
        if (!raw) return '';
        const clean = raw
          .replace(/^arxiv:\s*/i, '')
          .replace(/\s*\[.*?\]\s*$/, '')
          .replace(/v\d+$/i, '')
          .trim();
        return p.itemType === 'preprint' && clean ? `arXiv:${clean}` : clean;
      }
      if (keyLower === 'citationkey' || keyLower === 'citekey') {
        return cleanValue(p.citationKey || generateCitationKey(p));
      }
      if (keyLower === 'series' || keyLower === 'seriestitle') {
        return cleanValue(p.series || p.seriesTitle || ef.series || ef.seriesTitle);
      }
      if (keyLower === 'seriesnumber' || keyLower === 'seriestext') {
        return cleanValue(p.seriesNumber || p.seriesText || ef.seriesNumber || ef.seriesText);
      }
      if (keyLower === 'rights' || keyLower === 'license') {
        return cleanValue(p.rights || p.license || ef.rights || ef.license);
      }
      if (keyLower === 'publisher') {
        return cleanValue(p.publisher || ef.publisher);
      }
      if (keyLower === 'place') {
        return cleanValue(p.place || ef.place);
      }
      if (keyLower === 'genre') {
        return cleanValue(p.genre || p.type || ef.genre);
      }
      if (keyLower === 'language') {
        return cleanValue(p.language || ef.language);
      }
      if (keyLower === 'programminglanguage') {
        return cleanValue(p.programmingLanguage || ef.programmingLanguage);
      }
      if (keyLower === 'callnumber') {
        return cleanValue(p.callNumber || ef.callNumber);
      }
      if (keyLower === 'archive') {
        return cleanValue(p.archive || ef.archive);
      }
      if (keyLower === 'archivelocation') {
        return cleanValue(p.archiveLocation || ef.archiveLocation);
      }
      if (keyLower === 'librarycatalog') {
        return cleanValue(p.libraryCatalog || ef.libraryCatalog);
      }
      if (keyLower === 'abstractnote' || keyLower === 'abstract') {
        return cleanValue(p.abstract || p.abstractNote || ef.abstractNote || ef.abstract);
      }
      if (keyLower === 'booktitle') {
        return cleanValue(p.bookTitle || ef.bookTitle);
      }
      if (keyLower === 'proceedingstitle') {
        return cleanValue(p.proceedingsTitle || ef.proceedingsTitle);
      }
      if (keyLower === 'conferencename') {
        return cleanValue(p.conferenceName || ef.conferenceName);
      }
      if (keyLower === 'eventplace') {
        return cleanValue(p.eventPlace || ef.eventPlace || p.place || ef.place);
      }
      if (keyLower === 'university' || keyLower === 'institution') {
        return cleanValue(p.university || p.institution || ef.university || ef.institution);
      }
      if (keyLower === 'repository') {
        return cleanValue(p.repository || ef.repository);
      }
      if (keyLower === 'company' || keyLower === 'distributor' || keyLower === 'studio' || keyLower === 'network' || keyLower === 'label') {
        return cleanValue(p[fieldKey] || ef[fieldKey] || p.publisher || ef.publisher);
      }
      if (keyLower === 'issuingauthority' || keyLower === 'authority') {
        return cleanValue(p.issuingAuthority || ef.issuingAuthority || p.authority || p.country);
      }
      if (keyLower === 'patentnumber') {
        return cleanValue(p.patentNumber || ef.patentNumber || (p as any).number);
      }
      if (keyLower === 'assignee') {
        return cleanValue(p.assignee || ef.assignee);
      }
      if (keyLower === 'websitetitle' || keyLower === 'blogtitle' || keyLower === 'dictionarytitle' || keyLower === 'encyclopediatitle' || keyLower === 'forumtitle' || keyLower === 'sessiontitle' || keyLower === 'programtitle') {
        return cleanValue(p[fieldKey] || ef[fieldKey]);
      }
      if (keyLower === 'websitetype' || keyLower === 'thesistype' || keyLower === 'reporttype' || keyLower === 'posttype') {
        return cleanValue(p[fieldKey] || ef[fieldKey] || p.type || p.genre);
      }
      if (keyLower === 'reportnumber') {
        return cleanValue(p.reportNumber || (p as any).number || ef.reportNumber);
      }
      if (keyLower === 'country') {
        return cleanValue(p.country || p.place || ef.country);
      }
      if (keyLower === 'numpages' || keyLower === 'numberofpages') {
        return cleanValue(p.numPages || p.numberOfPages || ef.numPages || ef.numberOfPages);
      }
      if (keyLower === 'edition') {
        return cleanValue(p.edition || ef.edition);
      }
      if (keyLower === 'citationcount') {
        const currentCitationCount = p.citationCount ?? ef.citationCount;
        return cleanValue(currentCitationCount);
      }
      if (keyLower === 'referencecount') {
        const currentReferenceCount = p.referenceCount ?? ef.referenceCount;
        return cleanValue(currentReferenceCount);
      }

      return cleanValue(p[fieldKey] ?? ef[fieldKey] ?? p.customFields?.[fieldKey]);
    },
    [paper, displayDoi],
  );

  /**
   * Helper to save value for a dynamic field definition atomically.
   * Batches all multi-field mutations into a single onUpdatePaper call
   * to eliminate 409 Version Mismatch race conditions and preserve extraFields.
   */
  const saveFieldValue = (fieldDef: SchemaFieldDefinition, val: string) => {
    if (!onUpdatePaper) return;

    const key = fieldDef.field;
    const keyLower = key.toLowerCase();
    const currentExtraFields =
      (paper.extraFields as Record<string, unknown> | undefined) || {};

    let patch: Record<string, any> = {};

    if (keyLower === 'date' || keyLower === 'publicationdate') {
      const yearMatch = val.match(/(?:^|[^\d])(1[7-9]\d{2}|20\d{2})(?:[^\d]|$)/);
      const parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(val, 10);
      const finalYear = !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999 ? parsedYear : undefined;
      patch = {
        year: finalYear,
        publicationDate: val || '',
        date: val || '',
      };
    } else if (keyLower === 'doi') {
      const cleaned = cleanDoi(val);
      patch = {
        doi: cleaned || '',
        DOI: cleaned || '',
      };
    } else if (keyLower === 'isbn') {
      patch = { isbn: val || '', ISBN: val || '' };
    } else if (keyLower === 'issn') {
      patch = { issn: val || '', ISSN: val || '' };
    } else if (keyLower === 'pmid') {
      patch = { pmid: val || '', PMID: val || '' };
    } else if (keyLower === 'pmcid') {
      patch = { pmcid: val || '', PMCID: val || '' };
    } else if (keyLower === 'archiveid' || keyLower === 'arxivid') {
      const cleanVal = val.replace(/\s*\[.*?\]\s*$/, '').trim();
      const rawArxiv = cleanVal.replace(/^arxiv:\s*/i, '');
      patch = {
        arxivId: rawArxiv || '',
        archiveId: cleanVal || '',
        archiveID: cleanVal || '',
      };
    } else if (keyLower === 'publicationtitle' || keyLower === 'journal') {
      patch = {
        publicationTitle: val || '',
        journal: val || '',
      };
    } else if (keyLower === 'journalabbreviation' || keyLower === 'journalabbr') {
      patch = {
        journalAbbr: val || '',
        journalAbbreviation: val || '',
      };
    } else if (keyLower === 'accessdate' || keyLower === 'accessedat') {
      patch = {
        accessedAt: val || '',
        accessDate: val || '',
      };
    } else if (keyLower === 'rights' || keyLower === 'license') {
      patch = {
        rights: val || '',
        license: val || '',
      };
    } else if (keyLower === 'citationkey' || keyLower === 'citekey') {
      patch = { citationKey: val || '' };
    } else if (keyLower === 'abstractnote' || keyLower === 'abstract') {
      patch = {
        abstract: val || '',
        abstractNote: val || '',
      };
    } else if (keyLower === 'citationcount') {
      const parsedCitationCount = parseInt(val.replace(/,/g, ''), 10);
      const validCitationCount = isNaN(parsedCitationCount) ? null : parsedCitationCount;
      patch = {
        citationCount: validCitationCount,
        extraFields: {
          ...currentExtraFields,
          citationCount: validCitationCount,
        },
      };
    } else if (keyLower === 'referencecount') {
      const parsedReferenceCount = parseInt(val.replace(/,/g, ''), 10);
      const validReferenceCount = isNaN(parsedReferenceCount) ? null : parsedReferenceCount;
      patch = {
        referenceCount: validReferenceCount,
        extraFields: {
          ...currentExtraFields,
          referenceCount: validReferenceCount,
        },
      };
    } else if (keyLower === 'numpages' || keyLower === 'numberofpages') {
      const parsed = parseInt(val, 10);
      const validNum = isNaN(parsed) ? (val || null) : parsed;
      patch = {
        numPages: validNum,
        numberOfPages: validNum,
      };
    } else if (keyLower === 'issuedate') {
      const yearMatch = val.match(/(?:^|[^\d])(1[7-9]\d{2}|20\d{2})(?:[^\d]|$)/);
      const parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(val, 10);
      const finalYear = !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999 ? parsedYear : undefined;
      patch = {
        issueDate: val || '',
        ...(finalYear ? { year: finalYear } : {}),
      };
    } else if (keyLower === 'issuingauthority' || keyLower === 'authority') {
      patch = {
        issuingAuthority: val || '',
        authority: val || '',
      };
    } else if (DIRECT_METADATA_FIELDS.has(key) || DIRECT_METADATA_FIELDS.has(keyLower)) {
      patch = { [key]: val || '' };
    } else {
      patch = {
        extraFields: {
          ...currentExtraFields,
          [key]: val || null,
        },
      };
    }

    onUpdatePaper(patch);
  };

  // Render all schema fields for the selected item type in registry order
  const dynamicFields = useMemo(() => {
    const raw = (typeDefinition?.fields || []).filter(
      (f: SchemaFieldDefinition) =>
        f.field !== 'title' &&
        f.field !== 'abstractNote' &&
        f.field !== 'abstract' &&
        f.field !== 'extra' &&
        f.field !== 'dateAdded' &&
        f.field !== 'dateModified',
    );
    const academicTypes = new Set([
      'journalArticle',
      'preprint',
      'conferencePaper',
      'thesis',
      'report',
      'dataset',
      'book',
      'bookSection',
    ]);
    if (
      academicTypes.has(currentItemType) &&
      !raw.some((f) => f.field.toLowerCase() === 'citationcount')
    ) {
      const doiIdx = raw.findIndex((f) => f.field.toLowerCase() === 'doi');
      const citationDef: SchemaFieldDefinition = {
        field: 'citationCount',
        label: 'Citations',
        type: 'number',
        category: 'identifiers',
        mono: true,
      };
      if (doiIdx >= 0) {
        raw.splice(doiIdx + 1, 0, citationDef);
      } else {
        raw.push(citationDef);
      }
    }
    if (
      academicTypes.has(currentItemType) &&
      !raw.some((f) => f.field.toLowerCase() === 'referencecount')
    ) {
      const citIdx = raw.findIndex((f) => f.field.toLowerCase() === 'citationcount');
      const refDef: SchemaFieldDefinition = {
        field: 'referenceCount',
        label: 'References',
        type: 'number',
        category: 'identifiers',
        mono: true,
      };
      if (citIdx >= 0) {
        raw.splice(citIdx + 1, 0, refDef);
      } else {
        raw.push(refDef);
      }
    }
    return raw;
  }, [typeDefinition, currentItemType]);

  const formattedExtraMetadata = useMemo(() => {
    return formatAndSanitizeExtraMetadata(paper.extra, paper.extraFields, paper);
  }, [paper]);

  return (
    <div className="space-y-0.5 select-text font-sans antialiased">
      {/* ⚠️ Retraction Warning Alert Banner */}
      {paper.isRetracted && (
        <div className="mb-3 p-3 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs select-none">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-11 text-rose-700 dark:text-rose-400">
                {paper.retractionNature === 'expression_of_concern'
                  ? '⚠️ Expression of Concern'
                  : paper.retractionNature === 'correction'
                  ? 'ℹ️ Publisher Correction Notice'
                  : '🚨 Retracted Publication'}
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300">
                {((paper.retractionDetails as any)?.reason) ||
                  'This publication has been flagged as retracted or unreliable by academic integrity audits.'}
              </p>
              {((paper.retractionDetails as any)?.noticeUrl) && (
                <a
                  href={(paper.retractionDetails as any).noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 font-medium text-rose-700 dark:text-rose-400 underline hover:text-rose-900 mt-1"
                >
                  View publisher retraction notice
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Type Selector */}
      <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
        <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate" id="label-item-type">
          Item Type
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full h-7 text-left px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary data-[state=open]:border-primary data-[state=open]:bg-muted text-12 leading-normal font-normal text-foreground bg-transparent cursor-pointer outline-none select-none truncate flex items-center justify-between"
                aria-label="Item Type"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isCheckingType ? (
                    <Loader2 className="size-3 animate-spin text-foreground shrink-0" />
                  ) : null}
                  <span className="truncate">
                    {selectableItemTypes.find((t) => t.value === currentItemType)?.label || typeDefinition.label || currentItemType}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[420px] min-w-[250px] overflow-y-auto p-1.5 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5">
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
                          // Lossless: convert immediately without dialog and without notification
                          const result = await convertAsync({
                            itemId: paper.id,
                            targetType: t.value,
                            expectedVersion: (paper as any).version,
                            retainUnmappedInExtra: true,
                            silent: true,
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
                      'flex items-center gap-2.5 h-7 px-2.5 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted',
                      isSelected && 'bg-muted text-foreground font-medium',
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
        <span className="text-muted-foreground text-right font-normal select-none pr-2 pt-1 text-12 leading-normal whitespace-nowrap" id="label-title">
          Title
        </span>
        <InlineTextarea
          value={cleanValue(paper.title)}
          ariaLabel="Item Title"
          onSave={(val) => handleFieldChange('title', val || undefined)}
          className="font-normal text-foreground text-12 leading-normal"
          rows={1}
        />
      </div>

      {/* Creators / Authors */}
      <div className="py-0.5 space-y-0.5">
        {localCreators.length === 0 ? (
          <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
            <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate">
              {typeDefinition.creatorTypes[0]?.label || 'Author'}
            </span>
            <input
              type="text"
              aria-label="Author"
              onBlur={(blurEvent) => {
                const trimmedValue = blurEvent.target.value.trim();
                const existingAuthors = normalizeAuthors(paper.authors, paper.creators, paper.contributors);
                if (trimmedValue && (!existingAuthors.length || existingAuthors[0] !== trimmedValue)) {
                  if (onUpdatePaper) {
                    onUpdatePaper({
                      authors: [trimmedValue],
                      creators: [
                        {
                          orderIndex: 0,
                          creatorType: 'author',
                          fullName: trimmedValue,
                          name: trimmedValue,
                        },
                      ],
                    });
                  }
                }
              }}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter') {
                  const trimmedValue = (keyboardEvent.target as HTMLInputElement).value.trim();
                  const existingAuthors = normalizeAuthors(paper.authors, paper.creators, paper.contributors);
                  if (trimmedValue && (!existingAuthors.length || existingAuthors[0] !== trimmedValue)) {
                    if (onUpdatePaper) {
                      onUpdatePaper({
                        authors: [trimmedValue],
                        creators: [
                          {
                            orderIndex: 0,
                            creatorType: 'author',
                            fullName: trimmedValue,
                            name: trimmedValue,
                          },
                        ],
                      });
                    }
                  }
                  (keyboardEvent.target as HTMLInputElement).blur();
                }
              }}
              className="flex-1 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-12 leading-normal outline-none min-w-0 font-normal font-sans"
            />
          </div>
        ) : (
          <>
            {visibleCreators.map((creatorEntry, creatorIndex) => (
              <div key={creatorIndex} className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5 group">
                {/* Left Role Column */}
                <div className="flex items-center justify-end min-w-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full h-7 flex items-center justify-end pr-2 rounded-md text-12 leading-normal font-normal text-muted-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-right"
                        aria-label={`Change role for creator ${creatorIndex + 1}`}
                      >
                        <span className="truncate">
                          {ALL_CREATOR_TYPES[creatorEntry.creatorType] || creatorEntry.creatorType || 'Author'}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[170px] p-1.5 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5">
                      {creatorTypesList.map((creatorTypeItem) => (
                        <DropdownMenuItem
                          key={creatorTypeItem.creatorType}
                          onClick={() => handleUpdateCreatorType(creatorIndex, creatorTypeItem.creatorType)}
                          className={cn(
                            'flex items-center justify-between h-7 px-2 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted',
                            creatorEntry.creatorType === creatorTypeItem.creatorType && 'bg-muted text-foreground font-medium',
                          )}
                        >
                          <span className="text-foreground">{creatorTypeItem.label}</span>
                          {creatorEntry.creatorType === creatorTypeItem.creatorType && (
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
                    ref={(inputElement) => {
                      authorInputRefs.current[creatorIndex] = inputElement;
                    }}
                    type="text"
                    value={creatorEntry.name}
                    aria-label={`Creator ${creatorIndex + 1}`}
                    onChange={(changeEvent) => {
                      const inputValue = changeEvent.target.value;
                      if (inputValue.includes(';') || /\s+and\s+/i.test(inputValue) || inputValue.includes('\n')) {
                        const splitParts = splitAuthorString(inputValue);
                        if (splitParts.length > 1) {
                          const updatedCreators = [...localCreators];
                          const newCreatorEntries = splitParts.map((authorNamePart) => ({
                            creatorType: updatedCreators[creatorIndex]?.creatorType || 'author',
                            name: authorNamePart,
                          }));
                          updatedCreators.splice(creatorIndex, 1, ...newCreatorEntries);
                          setLocalCreators(updatedCreators);
                          return;
                        }
                      }
                      const updatedCreators = [...localCreators];
                      updatedCreators[creatorIndex] = { ...updatedCreators[creatorIndex], name: inputValue };
                      setLocalCreators(updatedCreators);
                    }}
                    onBlur={() => {
                      const originalCreators = parseCreators(paper);
                      if (areCreatorsEqual(localCreators, originalCreators)) {
                        return;
                      }
                      const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
                      const allCreatorNames = localCreators
                        .map((creatorItem) => creatorItem.name.trim())
                        .filter(Boolean);
                      const primaryCreatorNames = localCreators
                        .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
                        .map((creatorItem) => creatorItem.name.trim())
                        .filter(Boolean);
                      const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
                      if (onUpdatePaper) {
                        onUpdatePaper({
                          authors: finalAuthors.length ? finalAuthors : undefined,
                          creators: toItemCreators(localCreators),
                        });
                      }
                    }}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === 'Enter') {
                        keyboardEvent.preventDefault();
                        handleAddCreator(creatorIndex);
                      }
                    }}
                    className="flex-1 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-12 leading-normal outline-none min-w-0 font-normal font-sans"
                  />
                  {/* Action Buttons (Add / Remove) */}
                  <div className="invisible group-hover:visible flex items-center gap-0.5 shrink-0">
                    <Tooltip delayDuration={700}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleAddCreator(creatorIndex)}
                          className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer focus-visible:outline-none"
                          aria-label="Add creator below"
                        >
                          <Plus className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        alignOffset={2}
                        className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                      >
                        Add author below
                      </TooltipContent>
                    </Tooltip>

                    {localCreators.length > 1 && (
                      <Tooltip delayDuration={700}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleRemoveCreator(creatorIndex)}
                            className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer focus-visible:outline-none"
                            aria-label="Remove creator"
                          >
                            <Minus className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          alignOffset={2}
                          className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                        >
                          Remove author
                        </TooltipContent>
                      </Tooltip>
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
                  className="flex items-center gap-1.5 text-12 text-foreground font-medium cursor-pointer py-1 px-1.5 -ml-1 hover:bg-sidebar-accent focus-visible:outline-none rounded-md w-fit transition-colors select-none"
                  aria-expanded={isAuthorsExpanded}
                >
                  {isAuthorsExpanded ? (
                    <>
                      <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                      <span>Show less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                      <span>Show {localCreators.length - MAX_COLLAPSED_AUTHORS} more authors</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dynamic Schema Fields for Selected Item Type in Canonical Zotero Order */}
      {dynamicFields.map((fieldDef: SchemaFieldDefinition) => {
        const rawVal = getFieldValue(fieldDef.field);
        const isDoi = fieldDef.field.toLowerCase() === 'doi';
        const isUrl = fieldDef.field === 'url';
        const isCitations = fieldDef.field.toLowerCase() === 'citationcount';
        const isCitationKey =
          fieldDef.field.toLowerCase() === 'citationkey' ||
          fieldDef.field.toLowerCase() === 'citekey';
        const isRights =
          fieldDef.field.toLowerCase() === 'rights' ||
          fieldDef.field.toLowerCase() === 'license';

        const val = isCitations && rawVal && !isNaN(Number(rawVal))
          ? new Intl.NumberFormat('en-US').format(Number(rawVal))
          : isCitationKey
          ? cleanValue(paper.citationKey || generateCitationKey(paper))
          : isRights
          ? cleanValue(
              paper.rights ??
              paper.license ??
              (paper.extraFields?.rights as string) ??
              (paper.extraFields?.license as string)
            )
          : rawVal;

        const onSaveField = (newVal: string) => {
          if (isCitationKey) {
            handleFieldChange('citationKey', newVal || undefined);
          } else if (isRights) {
            handleFieldChange('rights', newVal || undefined);
          } else {
            saveFieldValue(fieldDef, newVal);
          }
        };

        return (
          <div key={fieldDef.field} className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5 group">
            <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate" title={fieldDef.label}>
              {fieldDef.label}
            </span>
            <div className="flex items-center gap-1 min-w-0">
              <InlineField
                value={val}
                ariaLabel={isCitationKey ? 'BibTeX Citation Key' : fieldDef.label}
                onSave={onSaveField}
                mono={fieldDef.mono || isCitationKey}
              />

              {/* Citations Provider Quick Action */}
              {isCitations && rawVal && (
                <div className="invisible group-hover:visible flex items-center shrink-0">
                  <a
                    href={
                      displayDoi
                        ? `https://openalex.org/works?search=${encodeURIComponent(displayDoi)}`
                        : `https://openalex.org/works?search=${encodeURIComponent(paper.title || '')}`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="View citations on OpenAlex in new tab"
                    title="View citations on OpenAlex"
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
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
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Open DOI link in new tab"
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(displayDoi, 'DOI')}
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Copy DOI"
                  >
                    {copiedKey === 'DOI' ? (
                      <CheckCircle2 className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                    )}
                  </button>
                </div>
              )}

              {/* Citation Key Quick Action */}
              {isCitationKey && isValidValue(val) && (
                <div className="invisible group-hover:visible flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`\\cite{${val}}`, 'Citation Key')}
                    className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none"
                    aria-label={`Copy citation key \\cite{${val}}`}
                  >
                    {copiedKey === 'Citation Key' ? (
                      <CheckCircle2 className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
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
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Open URL in new tab"
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
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
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label={`Open in PubMed ${fieldDef.field.toUpperCase()} in new tab`}
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
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
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none"
                    aria-label="Open in arXiv in new tab"
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Extra Field - Always available like native Zotero */}
      <div className="grid grid-cols-[96px_1fr] gap-1.5 items-start py-0.5">
        <span
          className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate pt-1"
          id="label-extra"
        >
          Extra
        </span>
        <InlineTextarea
          value={formattedExtraMetadata}
          ariaLabel="Extra"
          rows={Math.min(4, Math.max(1, formattedExtraMetadata ? formattedExtraMetadata.split('\n').length : 1))}
          onSave={(savedValue) => handleFieldChange('extra', savedValue || undefined)}
        />
      </div>

      {/* Date Added */}
      {isValidValue(paper.createdAt) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate">
            Date Added
          </span>
          <span className="text-foreground text-12 leading-normal px-2 py-1 select-text truncate font-normal h-7 flex items-center font-sans">
            {formatAuditDate(paper.createdAt)}
          </span>
        </div>
      )}

      {/* Modified */}
      {isValidValue(paper.updatedAt) && (
        <div className="grid grid-cols-[96px_1fr] gap-1.5 items-center py-0.5">
          <span className="text-muted-foreground text-right font-normal select-none pr-2 text-12 leading-normal truncate">
            Modified
          </span>
          <span className="text-foreground text-12 leading-normal px-2 py-1 select-text truncate font-normal h-7 flex items-center font-sans">
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
