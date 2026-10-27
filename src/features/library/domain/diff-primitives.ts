/**
 * Pure Domain Model: Deep Metadata Diff & Asset Aggregation Engine
 *
 * Native Deep Metadata Diff & Asset Aggregation Engine for Duplicate Merging.
 * Inspects all canonical bibliographic fields, flags field conflicts,
 * computes smart value recommendations, and calculates non-destructive asset union.
 */

import type { Item } from '@/features/library/domain/types/library.types';
import {
  getItemTypeDefinition,
} from '@/features/library/domain/types/item-types.types';
import {
  isValidValue,
  normalizeTags,
  getItemDisplayTitle,
  getItemDisplayDate,
  getPublicationVenue,
} from './metadata';
import {
  prepareInspectorFieldContext,
  resolveInspectorFieldValue,
  type PreparedInspectorFieldContext,
} from './item-field-schema';

export interface MergeFieldDefinition {
  key: string;
  label: string;
  category: 'core' | 'details' | 'identifiers' | 'publishing';
  description?: string;
}

export const MERGEABLE_FIELDS: MergeFieldDefinition[] = [
  // Core Bibliographic
  { key: 'itemType', label: 'Item Type', category: 'core' },
  { key: 'title', label: 'Title', category: 'core' },
  { key: 'authors', label: 'Authors', category: 'core' },
  { key: 'year', label: 'Publication Year', category: 'core' },
  { key: 'publicationTitle', label: 'Publication / Journal', category: 'core' },
  { key: 'doi', label: 'DOI', category: 'core' },
  { key: 'arxivId', label: 'arXiv ID', category: 'core' },

  // Details
  { key: 'abstract', label: 'Abstract', category: 'details' },
  { key: 'volume', label: 'Volume', category: 'details' },
  { key: 'issue', label: 'Issue', category: 'details' },
  { key: 'pages', label: 'Pages', category: 'details' },
  { key: 'publisher', label: 'Publisher', category: 'details' },
  { key: 'place', label: 'Place of Publication', category: 'details' },
  { key: 'publicationDate', label: 'Publication Date', category: 'details' },

  // Identifiers & Web
  { key: 'url', label: 'URL', category: 'identifiers' },
  { key: 'openAccessPdfUrl', label: 'Open Access PDF URL', category: 'identifiers' },
  { key: 'isbn', label: 'ISBN', category: 'identifiers' },
  { key: 'issn', label: 'ISSN', category: 'identifiers' },
  { key: 'pmid', label: 'PMID', category: 'identifiers' },
  { key: 'citationKey', label: 'Citation Key', category: 'identifiers' },

  // Publishing & Extras
  { key: 'language', label: 'Language', category: 'publishing' },
  { key: 'series', label: 'Series', category: 'publishing' },
  { key: 'seriesTitle', label: 'Series Title', category: 'publishing' },
  { key: 'seriesNumber', label: 'Series Number', category: 'publishing' },
  { key: 'rights', label: 'Rights / License', category: 'publishing' },
  { key: 'extra', label: 'Extra Notes / BibTeX Extra', category: 'publishing' },
];

const IDENTIFIER_SCHEMA_KEYS = new Set<string>([
  'doi',
  'isbn',
  'issn',
  'pmid',
  'pmcid',
  'arxivid',
  'archiveid',
  'url',
  'openaccesspdfurl',
  'citationkey',
  'callnumber',
  'patentnumber',
  'applicationnumber',
  'docketnumber',
  'publiclawnumber',
  'reportnumber',
  'billnumber',
  'documentnumber',
]);

function inferMergeFieldCategory(
  fieldKey: string,
): 'core' | 'details' | 'identifiers' | 'publishing' {
  const lower = fieldKey.toLowerCase();
  if (IDENTIFIER_SCHEMA_KEYS.has(lower)) return 'identifiers';
  if (
    lower.includes('series') ||
    lower.includes('archive') ||
    lower.includes('catalog') ||
    lower === 'language' ||
    lower === 'rights' ||
    lower === 'license'
  ) {
    return 'publishing';
  }
  return 'details';
}

/**
 * Dynamically derives the complete set of mergeable fields for a cluster's item types,
 * combining `MERGEABLE_FIELDS` with all type-specific Zotero Schema v42 fields (`proceedingsTitle`,
 * `conferenceName`, `bookTitle`, `university`, `thesisType`, `patentNumber`, `court`, `repository`, etc.).
 */
export function getMergeableFieldsForTypes(
  itemTypes?: readonly (string | undefined | null)[],
): MergeFieldDefinition[] {
  if (!itemTypes || itemTypes.length === 0) return MERGEABLE_FIELDS;
  const seenKeys = new Set<string>(
    MERGEABLE_FIELDS.map((f) => f.key.toLowerCase()),
  );
  seenKeys.add('abstractnote');
  seenKeys.add('date');

  const extraFieldDefs: MergeFieldDefinition[] = [];
  for (const rawType of itemTypes) {
    if (!rawType) continue;
    const def = getItemTypeDefinition(rawType);
    if (!def || !def.fields) continue;
    for (const f of def.fields) {
      const key = f.field;
      const lower = key.toLowerCase();
      if (!key || seenKeys.has(lower) || lower === 'title' || lower === 'extra') {
        continue;
      }
      seenKeys.add(lower);
      extraFieldDefs.push({
        key,
        label: f.label || key,
        category: inferMergeFieldCategory(key),
      });
    }
  }

  if (extraFieldDefs.length === 0) return MERGEABLE_FIELDS;
  const baseWithoutExtra = MERGEABLE_FIELDS.filter((f) => f.key !== 'extra');
  const extraField = MERGEABLE_FIELDS.find((f) => f.key === 'extra');
  return [
    ...baseWithoutExtra,
    ...extraFieldDefs,
    ...(extraField ? [extraField] : []),
  ];
}

export type DiffStatus =
  | 'IDENTICAL'
  | 'CONFLICT'
  | 'MISSING_IN_MASTER'
  | 'MISSING_IN_CANDIDATE';

export interface FieldOptionValue {
  itemId: string;
  itemTitle: string;
  isMaster: boolean;
  rawValue: unknown;
  displayValue: string;
  isEmpty: boolean;
  sourceItemIndex: number;
  value?: unknown;
  formattedDisplay?: string;
}

export interface ItemFieldDiff {
  key: string;
  label: string;
  category: 'core' | 'details' | 'identifiers' | 'publishing';
  status: DiffStatus;
  hasConflict: boolean;
  options: FieldOptionValue[];
  masterValue?: FieldOptionValue;
  recommendedItemId: string;
  recommendedValue?: unknown;
  candidateValue?: unknown;
}

export interface MergeInspectionResult {
  masterItemId: string;
  fields: ItemFieldDiff[];
  hasConflicts: boolean;
  conflictCount: number;
  identicalCount: number;
  missingInMasterCount: number;
}

export function isFieldEmpty(val: unknown): boolean {
  if (!isValidValue(val)) return true;
  if (typeof val === 'number' && val === 0) return true;
  if (Array.isArray(val)) {
    return !val.some((v) => isValidValue(v));
  }
  return false;
}

const EXTRA_FIELD_FALLBACKS: Record<string, readonly string[]> = {
  publicationDate: ['date', 'issueDate', 'dateDecided', 'dateEnacted', 'filingDate'],
  issue: [
    'number',
    'patentNumber',
    'reportNumber',
    'docketNumber',
    'publicLawNumber',
    'billNumber',
    'documentNumber',
    'identifier',
    'episodeNumber',
  ],
  place: ['eventPlace', 'country', 'repositoryLocation'],
  publisher: [
    'university',
    'institution',
    'issuingAuthority',
    'authority',
    'organization',
    'company',
    'repository',
    'court',
    'distributor',
    'studio',
    'network',
    'label',
  ],
  series: ['seriesTitle'],
  seriesTitle: ['series'],
};

/**
 * Resolves a field value from an item, delegating to `resolveInspectorFieldValue` (`item-field-schema.ts`)
 * as the Single Source of Truth for scalar Zotero fields so Table, Inspector, and Merge Diff never disagree.
 */
export function resolveItemFieldValue(
  item: Record<string, unknown> | undefined,
  key: string,
  precomputedContext?: PreparedInspectorFieldContext | null,
): unknown {
  if (!item) return undefined;
  const direct = item[key];
  const ef = item.extraFields as Record<string, unknown> | undefined;

  if (key === 'authors') {
    const rawAuthors = item.authors;
    if (!isFieldEmpty(rawAuthors)) return rawAuthors;
    const creators = item.creators ?? ef?.creators;
    if (!isFieldEmpty(creators)) return creators;
    return direct;
  }

  if (key === 'creators') {
    return !isFieldEmpty(direct) ? direct : ef?.creators;
  }

  if (key === 'year') {
    if (!isFieldEmpty(direct)) return direct;
    const derivedDate = getItemDisplayDate(item);
    return typeof derivedDate === 'number' ? derivedDate : direct;
  }

  if (key === 'title') {
    const derivedTitle = getItemDisplayTitle(item);
    return derivedTitle || direct;
  }

  if (key === 'publicationTitle') {
    if (!isFieldEmpty(direct)) return direct;
    const derivedVenue = getPublicationVenue(item);
    if (derivedVenue) return derivedVenue;
  }

  if (key === 'extra') {
    return !isFieldEmpty(direct) ? direct : ef?.extra;
  }

  if (key === 'arxivId') {
    const rawArxiv =
      direct ||
      ef?.arxivId ||
      ef?.archiveID ||
      ef?.archiveId ||
      resolveInspectorFieldValue(item as Partial<Item>, 'arxivId', precomputedContext);
    if (!isFieldEmpty(rawArxiv)) {
      return String(rawArxiv)
        .replace(/^arxiv:\s*/i, '')
        .replace(/\s*\[.*?\]\s*$/, '')
        .trim();
    }
  }

  const inspectorResolved = resolveInspectorFieldValue(
    item as Partial<Item>,
    key === 'abstract' ? 'abstractNote' : key,
    precomputedContext,
  );
  if (!isFieldEmpty(inspectorResolved)) return inspectorResolved;

  if (!isFieldEmpty(direct)) return direct;
  if (ef && !isFieldEmpty(ef[key])) return ef[key];

  const aliases = EXTRA_FIELD_FALLBACKS[key];
  if (aliases) {
    for (const alias of aliases) {
      if (!isFieldEmpty(item[alias])) return item[alias];
      if (ef && !isFieldEmpty(ef[alias])) return ef[alias];
    }
  }

  return direct;
}

export const extractFieldValue = resolveItemFieldValue;

function extractCreatorObjectName(obj: Record<string, unknown>, fallback: unknown): string {
  const fullName = [obj.firstName || obj.given, obj.lastName || obj.family].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (obj.fullName) return String(obj.fullName);
  if (obj.name) return String(obj.name);
  if (obj.lastName) {
    return `${obj.lastName}${obj.firstName ? `, ${obj.firstName}` : ''}`;
  }
  if (obj.family) {
    return `${obj.family}${obj.given ? `, ${obj.given}` : ''}`;
  }
  return JSON.stringify(fallback);
}

const UNORDERED_SET_FIELD_KEYS = new Set<string>(['tags', 'collections', 'collectionIds', 'keywords']);

export function normalizeCompareValue(val: unknown, fieldKey?: string): string {
  if (isFieldEmpty(val)) return '';
  if (Array.isArray(val)) {
    const normalizedItems = val
      .filter((x) => isValidValue(x))
      .map((x) => {
        if (typeof x === 'object' && x !== null) {
          return extractCreatorObjectName(x as Record<string, unknown>, x).trim().toLowerCase();
        }
        return String(x).trim().toLowerCase();
      });
    if (fieldKey && UNORDERED_SET_FIELD_KEYS.has(fieldKey)) {
      normalizedItems.sort();
    }
    return normalizedItems.join(';');
  }
  return String(val).trim().toLowerCase();
}

export function formatFieldValueDisplay(key: string, value: unknown): string {
  if (isFieldEmpty(value)) {
    return '- (Empty)';
  }
  if (Array.isArray(value)) {
    const validItems = value.filter((v) => isValidValue(v));
    if (validItems.length === 0) return '- (Empty)';
    return validItems
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return extractCreatorObjectName(item as Record<string, unknown>, item);
        }
        return String(item);
      })
      .join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

export type MasterSelectionStrategy = 'smart' | 'oldest' | 'newest';

function parseItemTimestamp(item: Record<string, unknown>): number | null {
  const raw = item.createdAt || item.dateAdded || item.updatedAt;
  if (typeof raw === 'string' && raw.trim()) {
    const ts = Date.parse(raw);
    if (!Number.isNaN(ts)) return ts;
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return null;
}

/**
 * Selects the best default master item ID in a duplicate cluster following academic deduplication conventions:
 * - `'smart'` (default): Prefers non-retracted published items (`journalArticle`, `conferencePaper`, `book`, `bookSection`)
 *   with a peer-reviewed DOI over unpublished `preprint` / `arXiv` / `document` items, scoring metadata completeness
 *   across `MERGEABLE_FIELDS`, attachments, and notes (breaking ties by oldest `createdAt`).
 * - `'oldest'`: Zoplicate-style earliest `createdAt` / `dateAdded` item (preserves oldest Zotero item key/URI).
 * - `'newest'`: Zoplicate-style most recently added `createdAt` / `dateAdded` item.
 */
export function selectBestMasterItemId(
  items: readonly Item[],
  strategy: MasterSelectionStrategy = 'smart',
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!.id;

  if (strategy === 'oldest' || strategy === 'newest') {
    let chosen = items[0]!;
    let chosenTs = parseItemTimestamp(chosen as Record<string, unknown>);
    for (let i = 1; i < items.length; i++) {
      const candidate = items[i]!;
      const ts = parseItemTimestamp(candidate as Record<string, unknown>);
      if (ts !== null) {
        if (
          chosenTs === null ||
          (strategy === 'oldest' && ts < chosenTs) ||
          (strategy === 'newest' && ts > chosenTs)
        ) {
          chosen = candidate;
          chosenTs = ts;
        }
      }
    }
    return chosen.id;
  }

  let bestId = items[0]!.id;
  let bestScore = -Infinity;
  let bestTs: number | null = null;

  for (const item of items) {
    let score = 0;
    const rec = item as Record<string, unknown>;
    const itemCtx = prepareInspectorFieldContext(item);

    // Penalize retracted items heavily so a retracted record isn't auto-selected over a valid one
    if (rec.isRetracted === true || rec.retractionStatus === 'retracted') {
      score -= 500;
    }

    const itemType = String(item.itemType || 'journalArticle').trim();
    const doi = String(resolveItemFieldValue(rec, 'doi', itemCtx) || '').trim();
    const isArxivDoi = /10\.48550\/arxiv/i.test(doi);

    if (
      itemType === 'journalArticle' ||
      itemType === 'conferencePaper' ||
      itemType === 'book' ||
      itemType === 'bookSection'
    ) {
      score += 40;
    } else if (itemType === 'preprint' || itemType === 'document') {
      score -= 15;
    }

    if (doi && !isArxivDoi) {
      score += 35;
    } else if (doi) {
      score += 10;
    }

    // Count populated canonical fields
    for (const field of MERGEABLE_FIELDS) {
      const val = resolveItemFieldValue(rec, field.key, itemCtx);
      if (!isFieldEmpty(val)) {
        score += 5;
      }
    }

    // Attachments and notes bonus
    if (Array.isArray(item.attachments)) {
      score += item.attachments.length * 8;
    }
    if (Array.isArray(item.notes)) {
      score += item.notes.length * 4;
    }

    const ts = parseItemTimestamp(rec);
    if (
      score > bestScore ||
      (score === bestScore && ts !== null && (bestTs === null || ts < bestTs))
    ) {
      bestScore = score;
      bestId = item.id;
      bestTs = ts;
    }
  }

  return bestId;
}

/**
 * Non-destructively merges structured `Key: Value` and free-text lines from `extra` / `extraFields.extra`
 * across all items in a duplicate cluster (starting with the master item's lines in order, then appending
 * unique normalized lines from duplicates such as `PMID: ...`, `PMCID: ...`, `arXiv: ...`, `Original Date: ...`),
 * while also collecting alternate `citationKey` values into `tex.ids` if different from the master item's `citationKey`.
 */
export function mergeItemExtraFields(
  items: readonly Item[],
  masterItemId: string,
  fieldOverrides?: Record<string, unknown>,
  customFieldTexts?: Record<string, string>,
): string {
  if (items.length === 0) return '';
  const master = items.find((i) => i.id === masterItemId) || items[0]!;
  const orderedItems = [master, ...items.filter((i) => i.id !== master.id)];

  const lines: string[] = [];
  const seenNormalizedLines = new Set<string>();
  const existingTexIds = new Set<string>();

  const masterCtx = prepareInspectorFieldContext(master);
  const masterRec = master as Record<string, unknown>;
  const masterEf =
    masterRec.extraFields && typeof masterRec.extraFields === 'object'
      ? (masterRec.extraFields as Record<string, unknown>)
      : {};

  const resolveEffectiveTopLevelOrOverride = (
    key: string,
    fallbackVal: unknown,
  ): unknown => {
    if (customFieldTexts && key in customFieldTexts && customFieldTexts[key] !== undefined) {
      return customFieldTexts[key];
    }
    if (fieldOverrides && key in fieldOverrides && fieldOverrides[key] !== undefined) {
      return fieldOverrides[key];
    }
    return fallbackVal;
  };

  const rawMasterCiteKey = String(
    resolveItemFieldValue(masterRec, 'citationKey', masterCtx) || '',
  ).trim();
  const effectiveMasterCiteKey = String(
    resolveEffectiveTopLevelOrOverride('citationKey', rawMasterCiteKey) ?? '',
  ).trim();

  if (rawMasterCiteKey && rawMasterCiteKey !== effectiveMasterCiteKey) {
    existingTexIds.add(rawMasterCiteKey);
  }

  let hasPmid = isValidValue(
    resolveEffectiveTopLevelOrOverride(
      'pmid',
      resolveItemFieldValue(masterRec, 'pmid', masterCtx),
    ),
  );
  let hasPmcid = isValidValue(
    resolveEffectiveTopLevelOrOverride(
      'pmcid',
      masterRec.pmcid ?? masterEf.pmcid ?? resolveItemFieldValue(masterRec, 'pmcid', masterCtx),
    ),
  );
  let hasOrigDate = isValidValue(
    resolveEffectiveTopLevelOrOverride(
      'originalDate',
      masterRec.originalDate ??
        masterEf.originalDate ??
        resolveItemFieldValue(masterRec, 'originalDate', masterCtx),
    ),
  );

  const addLine = (rawLine: string, isMasterItem = true) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // Check if this is a tex.ids line so we can consolidate all citation key aliases
    const texIdsMatch = trimmed.match(/^tex\.ids\s*[:=]\s*(.+)$/i);
    if (texIdsMatch && texIdsMatch[1]) {
      for (const token of texIdsMatch[1].split(/[,;\s]+/)) {
        const cleanToken = token.trim();
        if (cleanToken && cleanToken !== effectiveMasterCiteKey) {
          existingTexIds.add(cleanToken);
        }
      }
      return;
    }

    if (!isMasterItem) {
      const kvMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/);
      if (kvMatch) {
        const keyNorm = kvMatch[1]!.trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (keyNorm === 'pmid') {
          if (hasPmid) return;
          hasPmid = true;
        } else if (keyNorm === 'pmcid') {
          if (hasPmcid) return;
          hasPmcid = true;
        } else if (keyNorm === 'originaldate') {
          if (hasOrigDate) return;
          hasOrigDate = true;
        }
      }
    }

    const norm = trimmed
      .toLowerCase()
      .replace(/\s*:\s*/g, ': ')
      .replace(/\s+/g, ' ');
    if (!seenNormalizedLines.has(norm)) {
      seenNormalizedLines.add(norm);
      lines.push(trimmed);
    }
  };

  for (const item of orderedItems) {
    const isMasterItem = item.id === master.id;
    const rec = item as Record<string, unknown>;
    const itemCtx = isMasterItem ? masterCtx : prepareInspectorFieldContext(item);
    const ef =
      rec.extraFields && typeof rec.extraFields === 'object'
        ? (rec.extraFields as Record<string, unknown>)
        : {};

    const rawExtra =
      typeof rec.extra === 'string' && rec.extra.trim()
        ? rec.extra
        : typeof ef.extra === 'string' && ef.extra.trim()
          ? ef.extra
          : '';

    if (rawExtra) {
      for (const line of rawExtra.split(/\r?\n/)) {
        addLine(line, isMasterItem);
      }
    }

    // Back-fill explicit PMID / PMCID / Original Date from a duplicate only when the master lacks that identifier/date
    if (isMasterItem || !hasPmid) {
      const pmid = isMasterItem
        ? resolveEffectiveTopLevelOrOverride('pmid', resolveItemFieldValue(rec, 'pmid', itemCtx))
        : resolveItemFieldValue(rec, 'pmid', itemCtx);
      if (typeof pmid === 'string' && isValidValue(pmid)) {
        addLine(`PMID: ${pmid.trim()}`, true);
        hasPmid = true;
      }
    }
    if (isMasterItem || !hasPmcid) {
      const pmcid = isMasterItem
        ? resolveEffectiveTopLevelOrOverride('pmcid', rec.pmcid ?? ef.pmcid)
        : (rec.pmcid ?? ef.pmcid);
      if (typeof pmcid === 'string' && isValidValue(pmcid)) {
        addLine(`PMCID: ${pmcid.trim()}`, true);
        hasPmcid = true;
      }
    }
    if (isMasterItem || !hasOrigDate) {
      const origDate = isMasterItem
        ? resolveEffectiveTopLevelOrOverride('originalDate', rec.originalDate ?? ef.originalDate)
        : (rec.originalDate ?? ef.originalDate);
      if (typeof origDate === 'string' && isValidValue(origDate)) {
        addLine(`Original Date: ${origDate.trim()}`, true);
        hasOrigDate = true;
      }
    }

    // Collect alternate citationKey from non-master items into tex.ids
    if (item.id !== master.id) {
      const altCiteKey = String(
        resolveItemFieldValue(rec, 'citationKey', itemCtx) || '',
      ).trim();
      if (altCiteKey && altCiteKey !== effectiveMasterCiteKey) {
        existingTexIds.add(altCiteKey);
      }
    }
  }

  if (existingTexIds.size > 0) {
    lines.push(`tex.ids: ${Array.from(existingTexIds).join(', ')}`);
  }

  return lines.join('\n');
}

