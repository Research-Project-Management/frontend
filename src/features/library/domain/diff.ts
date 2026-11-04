import type { Item } from './types/core.types';
import { getItemTypeDefinition, getPrimaryCreatorType } from './types/item-types.types';
import { isValidValue, normalizeTags } from './metadata-sanitizers';
import { getItemDisplayTitle, getItemDisplayDate, getPublicationVenue } from './metadata-extra';
import { splitAuthorString, buildStructuredCreatorsFromAuthors } from './creators';
import { prepareInspectorFieldContext, resolveInspectorFieldValue, EXTRA_FIELD_FALLBACKS, MULTI_KEY_SYNC_SETTERS, type PreparedInspectorFieldContext } from './item-field-schema';

export { buildStructuredCreatorsFromAuthors, EXTRA_FIELD_FALLBACKS };

export interface MergeFieldDefinition { key: string; label: string; category: 'core' | 'details' | 'identifiers' | 'publishing'; description?: string; }

export const MERGEABLE_FIELDS: MergeFieldDefinition[] = [
  { key: 'itemType', label: 'Item Type', category: 'core' }, { key: 'title', label: 'Title', category: 'core' },
  { key: 'authors', label: 'Authors', category: 'core' }, { key: 'year', label: 'Publication Year', category: 'core' },
  { key: 'publicationTitle', label: 'Publication / Journal', category: 'core' }, { key: 'doi', label: 'DOI', category: 'core' },
  { key: 'arxivId', label: 'arXiv ID', category: 'core' }, { key: 'abstract', label: 'Abstract', category: 'details' },
  { key: 'volume', label: 'Volume', category: 'details' }, { key: 'issue', label: 'Issue', category: 'details' },
  { key: 'pages', label: 'Pages', category: 'details' }, { key: 'publisher', label: 'Publisher', category: 'details' },
  { key: 'place', label: 'Place of Publication', category: 'details' }, { key: 'publicationDate', label: 'Publication Date', category: 'details' },
  { key: 'url', label: 'URL', category: 'identifiers' }, { key: 'openAccessPdfUrl', label: 'Open Access PDF URL', category: 'identifiers' },
  { key: 'isbn', label: 'ISBN', category: 'identifiers' }, { key: 'issn', label: 'ISSN', category: 'identifiers' },
  { key: 'pmid', label: 'PMID', category: 'identifiers' }, { key: 'citationKey', label: 'Citation Key', category: 'identifiers' },
  { key: 'language', label: 'Language', category: 'publishing' }, { key: 'series', label: 'Series', category: 'publishing' },
  { key: 'seriesTitle', label: 'Series Title', category: 'publishing' }, { key: 'seriesNumber', label: 'Series Number', category: 'publishing' },
  { key: 'rights', label: 'Rights / License', category: 'publishing' }, { key: 'extra', label: 'Extra Notes / BibTeX Extra', category: 'publishing' },
];

const IDENTIFIER_SCHEMA_KEYS = new Set<string>([
  'doi', 'isbn', 'issn', 'pmid', 'pmcid', 'arxivid', 'archiveid', 'url', 'openaccesspdfurl',
  'citationkey', 'callnumber', 'patentnumber', 'applicationnumber', 'docketnumber', 'publiclawnumber', 'reportnumber', 'billnumber', 'documentnumber',
]);

function inferMergeFieldCategory(fieldKey: string): 'core' | 'details' | 'identifiers' | 'publishing' {
  const lower = fieldKey.toLowerCase();
  return IDENTIFIER_SCHEMA_KEYS.has(lower) ? 'identifiers' : /series|archive|catalog|^(language|rights|license)$/.test(lower) ? 'publishing' : 'details';
}

export function getMergeableFieldsForTypes(itemTypes?: readonly (string | undefined | null)[]): MergeFieldDefinition[] {
  if (!itemTypes || itemTypes.length === 0) return MERGEABLE_FIELDS;
  const seenKeys = new Set<string>([...MERGEABLE_FIELDS.map((f) => f.key.toLowerCase()), 'abstractnote', 'date']);
  const extraFieldDefs: MergeFieldDefinition[] = [];
  for (const rawType of itemTypes) {
    if (!rawType) continue;
    for (const f of getItemTypeDefinition(rawType)?.fields || []) {
      const key = f.field;
      const lower = key.toLowerCase();
      if (!key || seenKeys.has(lower) || lower === 'title' || lower === 'extra') continue;
      seenKeys.add(lower);
      extraFieldDefs.push({ key, label: f.label || key, category: inferMergeFieldCategory(key) });
    }
  }
  if (extraFieldDefs.length === 0) return MERGEABLE_FIELDS;
  const extraField = MERGEABLE_FIELDS.find((f) => f.key === 'extra');
  return [...MERGEABLE_FIELDS.filter((f) => f.key !== 'extra'), ...extraFieldDefs, ...(extraField ? [extraField] : [])];
}

export type DiffStatus = 'IDENTICAL' | 'CONFLICT' | 'MISSING_IN_MASTER' | 'MISSING_IN_CANDIDATE';

export interface FieldOptionValue { itemId: string; itemTitle: string; isMaster: boolean; rawValue: unknown; displayValue: string; isEmpty: boolean; sourceItemIndex: number; value?: unknown; formattedDisplay?: string; }
export interface ItemFieldDiff { key: string; label: string; category: 'core' | 'details' | 'identifiers' | 'publishing'; status: DiffStatus; hasConflict: boolean; options: FieldOptionValue[]; masterValue?: FieldOptionValue; recommendedItemId: string; recommendedValue?: unknown; candidateValue?: unknown; }
export interface MergeInspectionResult { masterItemId: string; fields: ItemFieldDiff[]; hasConflicts: boolean; conflictCount: number; identicalCount: number; missingInMasterCount: number; }

export function isFieldEmpty(val: unknown): boolean {
  return !isValidValue(val) || (typeof val === 'number' && val === 0) || (Array.isArray(val) && !val.some((v) => isValidValue(v)));
}

export function resolveItemFieldValue(item: Record<string, unknown> | undefined, key: string, precomputedContext?: PreparedInspectorFieldContext | null): unknown {
  if (!item) return undefined;
  const direct = item[key];
  const ef = item.extraFields as Record<string, unknown> | undefined;

  if (key === 'authors') {
    if (!isFieldEmpty(item.authors)) return item.authors;
    const creators = item.creators ?? ef?.creators;
    return !isFieldEmpty(creators) ? creators : direct;
  }
  if (key === 'creators') return !isFieldEmpty(direct) ? direct : ef?.creators;
  if (key === 'year') {
    if (!isFieldEmpty(direct)) return direct;
    const derivedDate = getItemDisplayDate(item);
    return typeof derivedDate === 'number' ? derivedDate : direct;
  }
  if (key === 'title') return getItemDisplayTitle(item) || direct;
  if (key === 'publicationTitle') {
    if (!isFieldEmpty(direct)) return direct;
    const derivedVenue = getPublicationVenue(item);
    if (derivedVenue) return derivedVenue;
  }
  if (key === 'extra') return !isFieldEmpty(direct) ? direct : ef?.extra;
  if (key === 'arxivId') {
    const rawArxiv = direct || ef?.arxivId || ef?.archiveID || ef?.archiveId || resolveInspectorFieldValue(item as Partial<Item>, 'arxivId', precomputedContext);
    if (!isFieldEmpty(rawArxiv)) return String(rawArxiv).replace(/^arxiv:\s*/i, '').replace(/\s*\[.*?\]\s*$/, '').trim();
  }

  const inspectorResolved = resolveInspectorFieldValue(item as Partial<Item>, key === 'abstract' ? 'abstractNote' : key, precomputedContext);
  if (!isFieldEmpty(inspectorResolved)) return inspectorResolved;
  if (!isFieldEmpty(direct)) return direct;
  if (ef && !isFieldEmpty(ef[key])) return ef[key];

  for (const alias of EXTRA_FIELD_FALLBACKS[key] ?? []) {
    if (!isFieldEmpty(item[alias])) return item[alias];
    if (ef && !isFieldEmpty(ef[alias])) return ef[alias];
  }
  return direct;
}

function extractCreatorObjectName(obj: Record<string, unknown>, fallback: unknown): string {
  const fullName = [obj.firstName || obj.given, obj.lastName || obj.family].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (obj.fullName) return String(obj.fullName);
  if (obj.name) return String(obj.name);
  if (obj.lastName) return `${obj.lastName}${obj.firstName ? `, ${obj.firstName}` : ''}`;
  if (obj.family) return `${obj.family}${obj.given ? `, ${obj.given}` : ''}`;
  return JSON.stringify(fallback);
}

const UNORDERED_SET_FIELD_KEYS = new Set<string>(['tags', 'collections', 'collectionIds', 'keywords']);

export function normalizeCompareValue(val: unknown, fieldKey?: string): string {
  if (isFieldEmpty(val)) return '';
  if (Array.isArray(val)) {
    const normalizedItems = val
      .filter((x) => isValidValue(x))
      .map((x) => (typeof x === 'object' && x !== null ? extractCreatorObjectName(x as Record<string, unknown>, x).trim().toLowerCase() : String(x).trim().toLowerCase()));
    if (fieldKey && UNORDERED_SET_FIELD_KEYS.has(fieldKey)) normalizedItems.sort();
    return normalizedItems.join(';');
  }
  return String(val).trim().toLowerCase();
}

export function formatFieldValueDisplay(_key: string, value: unknown): string {
  if (isFieldEmpty(value)) return '- (Empty)';
  if (Array.isArray(value)) {
    const validItems = value.filter((v) => isValidValue(v));
    if (validItems.length === 0) return '- (Empty)';
    return validItems
      .map((item) => (typeof item === 'string' ? item : typeof item === 'object' && item !== null ? extractCreatorObjectName(item as Record<string, unknown>, item) : String(item)))
      .join(', ');
  }
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

export type MasterSelectionStrategy = 'smart' | 'most-complete' | 'oldest' | 'newest';

function parseItemTimestamp(item: Record<string, unknown>): number | null {
  const raw = item.createdAt || item.dateAdded || item.updatedAt;
  if (typeof raw === 'string' && raw.trim()) {
    const ts = Date.parse(raw);
    if (!Number.isNaN(ts)) return ts;
  } else if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

const selectByTimestampOrder = (items: readonly Item[], mode: 'oldest' | 'newest'): string => {
  let chosen = items[0]!;
  let chosenTs = parseItemTimestamp(chosen as Record<string, unknown>);
  for (let i = 1; i < items.length; i++) {
    const candidate = items[i]!;
    const ts = parseItemTimestamp(candidate as Record<string, unknown>);
    if (ts !== null && (chosenTs === null || (mode === 'oldest' && ts < chosenTs) || (mode === 'newest' && ts > chosenTs))) {
      chosen = candidate;
      chosenTs = ts;
    }
  }
  return chosen.id;
};

const ITEM_TYPE_QUALITY_WEIGHT: Readonly<Record<string, number>> = {
  journalArticle: 40, conferencePaper: 40, book: 40, bookSection: 40, preprint: -15, document: -15,
};

const selectMostCompleteMasterItem = (items: readonly Item[]): string => {
  let bestId = items[0]!.id, bestScore = -Infinity, bestTs: number | null = null;
  const effectiveFields = getMergeableFieldsForTypes(items.map((i) => i.itemType));
  for (const item of items) {
    const rec = item as Record<string, unknown>, itemCtx = prepareInspectorFieldContext(item);
    const isRetracted = rec.isRetracted === true || rec.retractionStatus === 'retracted';
    const itemType = String(item.itemType || 'journalArticle').trim();
    const doi = String(resolveItemFieldValue(rec, 'doi', itemCtx) || '').trim();
    const populatedFieldsCount = effectiveFields.reduce((acc, field) => acc + (isFieldEmpty(resolveItemFieldValue(rec, field.key, itemCtx)) ? 0 : 1), 0);
    const score = (isRetracted ? -500 : 0) + (ITEM_TYPE_QUALITY_WEIGHT[itemType] ?? 0) + (doi ? (/10\.48550\/arxiv/i.test(doi) ? 10 : 35) : 0) +
      5 * populatedFieldsCount + 8 * (Array.isArray(item.attachments) ? item.attachments.length : 0) + 4 * (Array.isArray(item.notes) ? item.notes.length : 0);
    const ts = parseItemTimestamp(rec);
    if (score > bestScore || (score === bestScore && ts !== null && (bestTs === null || ts < bestTs))) {
      bestScore = score; bestId = item.id; bestTs = ts;
    }
  }
  return bestId;
};

export const MASTER_SELECTION_STRATEGIES: Readonly<Record<MasterSelectionStrategy, (items: readonly Item[]) => string>> = {
  oldest: (items) => selectByTimestampOrder(items, 'oldest'), newest: (items) => selectByTimestampOrder(items, 'newest'),
  'most-complete': selectMostCompleteMasterItem, smart: selectMostCompleteMasterItem,
};

export function selectBestMasterItemId(items: readonly Item[], strategy: MasterSelectionStrategy = 'smart'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!.id;
  return (MASTER_SELECTION_STRATEGIES[strategy] ?? MASTER_SELECTION_STRATEGIES['most-complete'])(items);
}

const PREPRINT_VENUE_RE = /^(arxiv|biorxiv|medrxiv|chemrxiv|ssrn|research square|preprints\.org|hal|osf preprints)\b/i;
const SUSPICIOUS_TITLE_RE = /\.(pdf|docx?|txt|pptx?|xlsx?)$|^(untitled|unknown|new item|document|uploaded document|microsoft word|pii:|doi:|arxiv:|https?:\/\/|10\.\d{4,9}\/)/i;

function scoreCreatorEntries(val: unknown): { count: number; rich: number } {
  const tokens: string[] = [];
  let rich = 0;
  if (Array.isArray(val)) {
    for (const c of val) {
      if (typeof c === 'string') tokens.push(c.trim());
      else if (c && typeof c === 'object') {
        const r = c as Record<string, unknown>;
        if (r.orcid || r.ORCID) rich += 2;
        tokens.push(extractCreatorObjectName(r, c).trim());
      }
    }
  } else if (typeof val === 'string') {
    tokens.push(...val.split(/[;\n]+|,\s*(?=[A-Z])/).map((s) => s.trim()));
  }
  const valid = tokens.filter(Boolean);
  for (const t of valid) {
    const parts = t.includes(',') ? t.split(',').map((p) => p.trim()).reverse().filter(Boolean) : t.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts.slice(0, -1).some((p) => p.replace(/[^A-Za-z\u00C0-\u024F]/g, '').length >= 2 && !/^[A-Z]\.?$/.test(p))) rich++;
  }
  return { count: valid.length, rich };
}

function isSuspiciousOrAbbreviatedTitle(s: string): boolean {
  const t = s.trim();
  return !t || SUSPICIOUS_TITLE_RE.test(t) || /\.\.\.$|…$/.test(t) || (t === t.toUpperCase() && /[A-Z]/.test(t)) || (!t.includes(' ') && ((t.match(/_/g) || []).length >= 3 || /\d{4}\.\d{4,5}(?:v\d+)?/i.test(t)));
}

export function selectRecommendedFieldValue(fieldKey: string, masterVal: unknown, allItems: readonly Item[]): unknown {
  const candidateVals = allItems.map((item) => resolveItemFieldValue(item as Record<string, unknown>, fieldKey)).filter((val) => !isFieldEmpty(val));
  let bestVal: unknown = !isFieldEmpty(masterVal) ? masterVal : candidateVals[0];
  if (candidateVals.length <= 1) return bestVal;

  for (const candVal of candidateVals) {
    if (candVal === bestVal) continue;
    const bestStr = String(bestVal ?? '').trim();
    const candStr = String(candVal ?? '').trim();
    if (fieldKey === 'doi') {
      if (/10\.48550\/arxiv/i.test(bestStr) && !/10\.48550\/arxiv/i.test(candStr)) bestVal = candVal;
    } else if (fieldKey === 'publicationTitle' || fieldKey === 'journalAbbreviation' || fieldKey === 'publisher') {
      const bestPre = PREPRINT_VENUE_RE.test(bestStr);
      const candPre = PREPRINT_VENUE_RE.test(candStr);
      if ((bestPre && !candPre) || (bestPre === candPre && candStr.length > bestStr.length)) bestVal = candVal;
    } else if (fieldKey === 'authors' || fieldKey === 'creators') {
      const b = scoreCreatorEntries(bestVal);
      const c = scoreCreatorEntries(candVal);
      if (c.count > b.count || (c.count === b.count && c.rich > b.rich)) bestVal = candVal;
    } else if (fieldKey === 'publicationDate' || fieldKey === 'date') {
      const rank = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? 3 : /^\d{4}-\d{2}$/.test(s) ? 2 : /\b(1\d{3}|20\d{2})\b/.test(s) ? 1 : 0);
      if (rank(candStr) > rank(bestStr) || (rank(candStr) === rank(bestStr) && candStr.length > bestStr.length)) bestVal = candVal;
    } else if (['abstract', 'abstractNote', 'title', 'shortTitle', 'bookTitle', 'proceedingsTitle', 'conferenceName'].includes(fieldKey)) {
      const isTitle = fieldKey !== 'abstract' && fieldKey !== 'abstractNote';
      const bestBad = isTitle && isSuspiciousOrAbbreviatedTitle(bestStr);
      const candBad = isTitle && isSuspiciousOrAbbreviatedTitle(candStr);
      if ((bestBad && !candBad) || (bestBad === candBad && candStr.length > bestStr.length)) bestVal = candVal;
    } else if (fieldKey === 'itemType') {
      if ((bestStr === 'preprint' || bestStr === 'document') && candStr !== 'preprint' && candStr !== 'document') bestVal = candVal;
    } else if (Array.isArray(candVal) && Array.isArray(bestVal)) {
      if (candVal.length > bestVal.length) bestVal = candVal;
    } else if (candStr.length > bestStr.length) {
      bestVal = candVal;
    }
  }
  return bestVal;
}

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
  const masterEf = masterRec.extraFields && typeof masterRec.extraFields === 'object' ? (masterRec.extraFields as Record<string, unknown>) : {};

  const resolveEffectiveTopLevelOrOverride = (key: string, fallbackVal: unknown): unknown => {
    if (customFieldTexts && key in customFieldTexts && customFieldTexts[key] !== undefined) return customFieldTexts[key];
    if (fieldOverrides && key in fieldOverrides && fieldOverrides[key] !== undefined) return fieldOverrides[key];
    return fallbackVal;
  };

  const rawMasterCiteKey = String(resolveItemFieldValue(masterRec, 'citationKey', masterCtx) || '').trim();
  const effectiveMasterCiteKey = String(resolveEffectiveTopLevelOrOverride('citationKey', rawMasterCiteKey) ?? '').trim();
  if (rawMasterCiteKey && rawMasterCiteKey !== effectiveMasterCiteKey) existingTexIds.add(rawMasterCiteKey);

  const hasMap: Record<string, boolean> = {
    pmid: isValidValue(resolveEffectiveTopLevelOrOverride('pmid', resolveItemFieldValue(masterRec, 'pmid', masterCtx))),
    pmcid: isValidValue(resolveEffectiveTopLevelOrOverride('pmcid', masterRec.pmcid ?? masterEf.pmcid ?? resolveItemFieldValue(masterRec, 'pmcid', masterCtx))),
    originaldate: isValidValue(resolveEffectiveTopLevelOrOverride('originalDate', masterRec.originalDate ?? masterEf.originalDate ?? resolveItemFieldValue(masterRec, 'originalDate', masterCtx))),
    doi: isValidValue(resolveEffectiveTopLevelOrOverride('doi', resolveItemFieldValue(masterRec, 'doi', masterCtx))),
    isbn: isValidValue(resolveEffectiveTopLevelOrOverride('isbn', resolveItemFieldValue(masterRec, 'isbn', masterCtx))),
    issn: isValidValue(resolveEffectiveTopLevelOrOverride('issn', resolveItemFieldValue(masterRec, 'issn', masterCtx))),
  };
  const effectiveArxivId = String(resolveEffectiveTopLevelOrOverride('arxivId', resolveItemFieldValue(masterRec, 'arxivId', masterCtx)) || '')
    .replace(/^arxiv:\s*/i, '').replace(/\s*\[.*?\]\s*$/, '').replace(/v\d+$/i, '').trim().toLowerCase();
  const seenKeys = new Set<string>();

  const addLine = (rawLine: string, isMasterItem = true) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const texIdsMatch = trimmed.match(/^tex\.ids\s*[:=]\s*(.+)$/i);
    if (texIdsMatch?.[1]) {
      for (const token of texIdsMatch[1].split(/[,;\s]+/)) {
        const cleanToken = token.trim();
        if (cleanToken && cleanToken !== effectiveMasterCiteKey) existingTexIds.add(cleanToken);
      }
      return;
    }
    const kvMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/);
    if (kvMatch) {
      const rawKey = kvMatch[1]!.trim().toLowerCase().replace(/[\s_-]+/g, '');
      const canonicalKey = rawKey === 'arxivid' || rawKey === 'archiveid' ? 'arxiv' : rawKey;
      const lineVal = kvMatch[2]!.trim();
      if (!isMasterItem) {
        if ((canonicalKey in hasMap || canonicalKey === 'arxiv') && (seenKeys.has(rawKey) || seenKeys.has(canonicalKey))) return;
        if (canonicalKey in hasMap) {
          if (hasMap[canonicalKey]) return;
          hasMap[canonicalKey] = true;
        } else if (canonicalKey === 'arxiv') {
          const cleanLineArxiv = lineVal.replace(/^arxiv:\s*/i, '').replace(/\s*\[.*?\]\s*$/, '').replace(/v\d+$/i, '').trim().toLowerCase();
          if (effectiveArxivId && cleanLineArxiv && cleanLineArxiv !== effectiveArxivId) return;
        }
      }
      seenKeys.add(rawKey);
      seenKeys.add(canonicalKey);
    }
    const norm = trimmed.toLowerCase().replace(/\s*:\s*/g, ': ').replace(/\s+/g, ' ');
    if (!seenNormalizedLines.has(norm)) { seenNormalizedLines.add(norm); lines.push(trimmed); }
  };

  for (const item of orderedItems) {
    const isMasterItem = item.id === master.id;
    const rec = item as Record<string, unknown>;
    const itemCtx = isMasterItem ? masterCtx : prepareInspectorFieldContext(item);
    const ef = rec.extraFields && typeof rec.extraFields === 'object' ? (rec.extraFields as Record<string, unknown>) : {};
    const rawExtra = typeof rec.extra === 'string' && rec.extra.trim() ? rec.extra : typeof ef.extra === 'string' && ef.extra.trim() ? ef.extra : '';
    if (rawExtra) for (const line of rawExtra.split(/\r?\n/)) addLine(line, isMasterItem);

    if (isMasterItem || !hasMap.pmid) {
      const pmid = isMasterItem ? resolveEffectiveTopLevelOrOverride('pmid', resolveItemFieldValue(rec, 'pmid', itemCtx)) : resolveItemFieldValue(rec, 'pmid', itemCtx);
      if (typeof pmid === 'string' && isValidValue(pmid)) { addLine(`PMID: ${pmid.trim()}`, true); hasMap.pmid = true; }
    }
    if (isMasterItem || !hasMap.pmcid) {
      const pmcid = isMasterItem ? resolveEffectiveTopLevelOrOverride('pmcid', rec.pmcid ?? ef.pmcid) : (rec.pmcid ?? ef.pmcid);
      if (typeof pmcid === 'string' && isValidValue(pmcid)) { addLine(`PMCID: ${pmcid.trim()}`, true); hasMap.pmcid = true; }
    }
    if (isMasterItem || !hasMap.originaldate) {
      const origDate = isMasterItem ? resolveEffectiveTopLevelOrOverride('originalDate', rec.originalDate ?? ef.originalDate) : (rec.originalDate ?? ef.originalDate);
      if (typeof origDate === 'string' && isValidValue(origDate)) { addLine(`Original Date: ${origDate.trim()}`, true); hasMap.originaldate = true; }
    }
    if (!isMasterItem) {
      const altCiteKey = String(resolveItemFieldValue(rec, 'citationKey', itemCtx) || '').trim();
      if (altCiteKey && altCiteKey !== effectiveMasterCiteKey) existingTexIds.add(altCiteKey);
    }
  }
  if (existingTexIds.size > 0) lines.push(`tex.ids: ${Array.from(existingTexIds).join(', ')}`);
  return lines.join('\n');
}

export interface AggregatedAssetsSummary {
  totalFiles: number; fileList: unknown[]; attachments: unknown[];
  uniqueAttachmentCount: number; duplicateAttachmentCount: number; totalAnnotationCount: number;
  totalNotes: number; noteCount: number; notes: unknown[];
  totalTags: number; tags: string[]; totalCollections: number; collectionCount: number; collections: string[];
  combinedTags: string[]; combinedCollectionIds: string[]; attachmentCount: number; notesCount: number;
}
export interface DuplicateGroupMergeDraft { selectedMasterId: string; fieldOverrides: Record<string, unknown>; showConflictsOnly: boolean; }

export function createInitialDuplicateGroupMergeDraft(recommendedMasterId: string): DuplicateGroupMergeDraft {
  return { selectedMasterId: recommendedMasterId, fieldOverrides: {}, showConflictsOnly: false };
}

export function computeDuplicateSetKey(items: readonly Item[]): string {
  if (!items || items.length === 0) return '__empty__';
  return items.map((i) => i.id).filter((id): id is string => Boolean(id)).sort().join('::') || '__empty__';
}

export function getDeterministicDuplicateGroupKey(group: { key?: string | null; items?: readonly Item[] | null }): string {
  if (group.items && group.items.length > 0) {
    const setKey = computeDuplicateSetKey(group.items);
    if (setKey !== '__empty__') return setKey;
  }
  return group.key || '__empty__';
}

export function aggregateItemAssets(items: readonly Item[]): AggregatedAssetsSummary {
  const rawTags: unknown[] = [];
  const colSet = new Set<string>();
  const uniqueAttachments: unknown[] = [];
  const seenAttachmentKeys = new Set<string>();
  const notesList: unknown[] = [];
  let duplicateAttachmentCount = 0;
  let totalAnnotationCount = 0;

  const registerAttachment = (att: unknown) => {
    if (!att) return;
    if (typeof att === 'string') {
      const cleanUrl = att.trim();
      if (!isValidValue(cleanUrl)) return;
      const key = `url:${cleanUrl.toLowerCase()}`;
      if (seenAttachmentKeys.has(key)) { duplicateAttachmentCount++; return; }
      seenAttachmentKeys.add(key);
      uniqueAttachments.push(cleanUrl);
      return;
    }
    if (typeof att === 'object') {
      const obj = att as Record<string, unknown>;
      if (typeof obj.annotationCount === 'number' && obj.annotationCount > 0) totalAnnotationCount += obj.annotationCount;
      else if (Array.isArray(obj.annotations)) totalAnnotationCount += obj.annotations.length;
      const fileHash = typeof obj.fileHash === 'string' && obj.fileHash.trim() ? obj.fileHash.trim().toLowerCase() : typeof obj.sha256 === 'string' && obj.sha256.trim() ? obj.sha256.trim().toLowerCase() : '';
      const fileUrl = typeof obj.url === 'string' && obj.url.trim() ? obj.url.trim().toLowerCase() : typeof obj.fileUrl === 'string' && obj.fileUrl.trim() ? obj.fileUrl.trim().toLowerCase() : '';
      const dedupKey = fileHash ? `hash:${fileHash}` : fileUrl ? `url:${fileUrl}` : '';
      if (dedupKey) {
        if (seenAttachmentKeys.has(dedupKey)) { duplicateAttachmentCount++; return; }
        seenAttachmentKeys.add(dedupKey);
      }
      uniqueAttachments.push(att);
    }
  };

  for (const it of items) {
    if (Array.isArray(it.tags)) rawTags.push(...it.tags);
    else if (typeof it.tags === 'string') rawTags.push(it.tags);
    const singleColId = (it as Record<string, unknown>).collectionId;
    if (typeof singleColId === 'string' && isValidValue(singleColId)) colSet.add(singleColId.trim());
    if (Array.isArray(it.collectionIds)) it.collectionIds.forEach((c: unknown) => { if (typeof c === 'string' && isValidValue(c)) colSet.add(c.trim()); });
    if (Array.isArray(it.collections)) {
      it.collections.forEach((c) => {
        if (c && typeof c === 'object' && typeof c.id === 'string' && isValidValue(c.id)) colSet.add(c.id.trim());
        else if (typeof c === 'string' && isValidValue(c)) colSet.add((c as string).trim());
      });
    }
    if (Array.isArray(it.attachments)) it.attachments.forEach((att) => registerAttachment(att));
    else {
      const pdfUrl = (it as Record<string, unknown>).pdfUrl || (it as Record<string, unknown>).fileUrl;
      if (pdfUrl && isValidValue(pdfUrl)) registerAttachment(pdfUrl);
    }
    if (Array.isArray(it.notes)) notesList.push(...it.notes);
  }

  const tags = normalizeTags(rawTags);
  const collections = Array.from(colSet);
  return {
    totalFiles: uniqueAttachments.length, fileList: uniqueAttachments, attachments: uniqueAttachments,
    uniqueAttachmentCount: uniqueAttachments.length, duplicateAttachmentCount, totalAnnotationCount,
    totalNotes: notesList.length, noteCount: notesList.length, notes: notesList,
    totalTags: tags.length, tags, totalCollections: collections.length, collectionCount: collections.length, collections,
    combinedTags: tags, combinedCollectionIds: collections, attachmentCount: uniqueAttachments.length, notesCount: notesList.length,
  };
}

export function inspectItemDifferences(items: Item[], masterId: string, customFields?: MergeFieldDefinition[]): MergeInspectionResult {
  const effectiveFields = customFields ?? getMergeableFieldsForTypes(items.map((i) => i.itemType));
  const masterItem = items.find((p) => p.id === masterId) || items[0];
  const itemContexts = new Map<string, PreparedInspectorFieldContext | null>();
  for (const it of items) if (it?.id) itemContexts.set(it.id, prepareInspectorFieldContext(it));
  const masterCtx = masterItem ? itemContexts.get(masterItem.id) ?? prepareInspectorFieldContext(masterItem) : null;

  let conflictCount = 0;
  let identicalCount = 0;
  let missingInMasterCount = 0;

  const fields: ItemFieldDiff[] = effectiveFields.map((field) => {
    const rawMaster = resolveItemFieldValue(masterItem as Record<string, unknown>, field.key, masterCtx);
    const normMaster = normalizeCompareValue(rawMaster, field.key);
    const uniqueNormalized = new Set<string>();
    let anyEmptyCandidate = false;

    const options: FieldOptionValue[] = items.map((item, idx) => {
      const rawVal = resolveItemFieldValue(item as Record<string, unknown>, field.key, itemContexts.get(item.id));
      const isEmpty = isFieldEmpty(rawVal);
      const effectiveRawVal = isEmpty ? (Array.isArray(rawVal) ? [] : undefined) : rawVal;
      const displayVal = formatFieldValueDisplay(field.key, effectiveRawVal);
      const isMaster = item.id === masterItem.id;
      const normVal = normalizeCompareValue(effectiveRawVal, field.key);
      if (normVal) uniqueNormalized.add(normVal);
      else if (!isMaster) anyEmptyCandidate = true;
      return {
        itemId: item.id, itemTitle: item.title || `Record ${idx + 1}`, isMaster,
        rawValue: effectiveRawVal, displayValue: displayVal, isEmpty, sourceItemIndex: idx,
        value: effectiveRawVal, formattedDisplay: displayVal,
      };
    });

    const masterOption = options.find((o) => o.itemId === masterItem.id) || options[0];
    const nonMasterOptions = options.filter((o) => o.itemId !== masterItem.id);
    const k = uniqueNormalized.size;
    const hasConflict = k > 0 && (!normMaster || k > 1);
    const status: DiffStatus = k === 0 ? 'IDENTICAL' : !normMaster ? 'MISSING_IN_MASTER' : k > 1 ? 'CONFLICT' : anyEmptyCandidate ? 'MISSING_IN_CANDIDATE' : 'IDENTICAL';
    if (hasConflict) conflictCount++;
    if (status === 'IDENTICAL') identicalCount++;
    if (status === 'MISSING_IN_MASTER') missingInMasterCount++;

    let recommendedItemId = masterItem.id;
    if (hasConflict || status === 'MISSING_IN_MASTER') {
      const recVal = selectRecommendedFieldValue(field.key, masterOption?.rawValue, items);
      const recNorm = normalizeCompareValue(recVal, field.key);
      const matchedOpt = options.find((opt) => !opt.isEmpty && (opt.rawValue === recVal || normalizeCompareValue(opt.rawValue, field.key) === recNorm));
      if (matchedOpt) recommendedItemId = matchedOpt.itemId;
    }
    const recommendedOption = options.find((o) => o.itemId === recommendedItemId);
    return {
      key: field.key, label: field.label, category: field.category, status, hasConflict, options,
      masterValue: masterOption, recommendedItemId, recommendedValue: recommendedOption?.rawValue, candidateValue: nonMasterOptions[0]?.rawValue,
    };
  });

  return { masterItemId: masterItem?.id || masterId, fields, hasConflicts: conflictCount > 0, conflictCount, identicalCount, missingInMasterCount };
}

const SKIP_SYNC_KEYS = new Set(['extraFields', 'extra', 'authors', 'creators', 'contributors', 'tags', 'collections', 'collectionIds']);

export function resolveDuplicateMergeFieldOverrides(
  items: readonly Item[],
  masterId: string,
  fieldOverrides: Record<string, unknown> = {},
  options?: { inspection?: MergeInspectionResult; includeUnchangedMasterFields?: boolean; customFieldTexts?: Record<string, string>; explicitUserSelectionsOnly?: boolean },
): Record<string, unknown> {
  const masterItem = items.find((i) => i.id === masterId) || items[0];
  const orderedItems = masterItem ? [masterItem, ...items.filter((i) => i.id !== masterItem.id)] : [...items];
  const inspection = options?.inspection ?? inspectItemDifferences([...items], masterId);
  const includeMasterDefaults = Boolean(options?.includeUnchangedMasterFields);
  const explicitOnly = Boolean(options?.explicitUserSelectionsOnly);
  const itemTypes = Array.from(new Set(items.map((i) => i.itemType).filter(Boolean)));
  const hasTypeMismatch = itemTypes.length > 1;
  const effectiveItemType = (fieldOverrides.itemType as string | undefined) || masterItem?.itemType || 'journalArticle';
  const out: Record<string, unknown> = {};

  if (!explicitOnly) {
    for (const field of inspection.fields) {
      if (field.status === 'MISSING_IN_MASTER' && field.recommendedValue !== undefined && !(field.key in fieldOverrides)) out[field.key] = field.recommendedValue;
      else if (includeMasterDefaults && !(field.key in fieldOverrides) && field.masterValue?.rawValue !== undefined) out[field.key] = field.masterValue.rawValue;
    }
    for (const candidateKey of ['pmcid', 'arxivId', 'university', 'institution'] as const) {
      if (candidateKey in out || candidateKey in fieldOverrides) continue;
      const masterVal = masterItem ? resolveItemFieldValue(masterItem as Record<string, unknown>, candidateKey) : undefined;
      if (!isFieldEmpty(masterVal)) { if (includeMasterDefaults) out[candidateKey] = masterVal; continue; }
      for (const it of orderedItems) {
        if (it.id === masterItem?.id) continue;
        const val = resolveItemFieldValue(it as Record<string, unknown>, candidateKey);
        if (!isFieldEmpty(val)) { out[candidateKey] = val; break; }
      }
    }
  }

  for (const [k, v] of Object.entries(fieldOverrides)) {
    if (v === null) {
      if (inspection.fields.find((f) => f.key === k)?.status === 'MISSING_IN_MASTER') delete out[k];
      else out[k] = k === 'year' ? null : '';
    } else if (v !== undefined) {
      out[k] = k === 'year' && typeof v === 'string' && v.trim() === '' ? null : v;
    }
  }
  if (options?.customFieldTexts) {
    for (const [k, v] of Object.entries(options.customFieldTexts)) {
      if (v !== undefined) out[k] = k === 'year' && typeof v === 'string' && v.trim() === '' ? null : v;
    }
  }

  const primaryRole = (getPrimaryCreatorType(effectiveItemType) || 'author').toLowerCase();
  const extractItemRawCreators = (it?: Item): Array<Record<string, unknown>> => {
    if (!it) return [];
    const itEf = it.extraFields && typeof it.extraFields === 'object' ? (it.extraFields as Record<string, unknown>) : undefined;
    const raw =
      Array.isArray(it.creators) && it.creators.length > 0 ? it.creators :
      Array.isArray(itEf?.creators) && (itEf.creators as unknown[]).length > 0 ? (itEf.creators as unknown[]) :
      Array.isArray(it.contributors) && it.contributors.length > 0 ? it.contributors : [];
    return raw.filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'));
  };
  const getCreatorDedupKey = (c: Record<string, unknown>): string => {
    const role = String(c.creatorType ?? c.role ?? 'author').trim().toLowerCase();
    const first = String(c.firstName ?? c.given ?? '').trim();
    const last = String(c.lastName ?? c.family ?? '').trim();
    const full = String(c.fullName ?? c.name ?? [first, last].filter(Boolean).join(' ')).trim().toLowerCase();
    return `${role}:${full}`;
  };
  const isSecondaryCreator = (c: Record<string, unknown>): boolean => {
    const role = String(c.creatorType ?? c.role ?? 'author').trim().toLowerCase();
    return Boolean(role && role !== 'author' && role !== primaryRole);
  };

  if ('authors' in out) {
    const rawAuthorsVal = out.authors;
    if (isFieldEmpty(rawAuthorsVal)) {
      out.authors = [];
      if (!('creators' in fieldOverrides)) out.creators = [];
      if (!('contributors' in fieldOverrides)) out.contributors = [];
    } else {
      const chosenAuthorsNorm = normalizeCompareValue(rawAuthorsVal, 'authors');
      const donorItem = orderedItems.find((it) => normalizeCompareValue(Array.isArray(it.authors) && it.authors.length > 0 ? it.authors : it.creators, 'authors') === chosenAuthorsNorm);
      const donorCreators = extractItemRawCreators(donorItem);
      const baseCreators = donorCreators.length > 0 ? donorCreators.map((c) => ({ ...c })) : buildStructuredCreatorsFromAuthors(rawAuthorsVal);
      const seenKeys = new Set<string>(baseCreators.map(getCreatorDedupKey));
      for (const it of orderedItems) {
        for (const cr of extractItemRawCreators(it)) {
          if (isSecondaryCreator(cr)) {
            const key = getCreatorDedupKey(cr);
            if (!seenKeys.has(key)) { seenKeys.add(key); baseCreators.push({ ...cr }); }
          }
        }
      }
      const structuredCreators = baseCreators.map((c, idx) => ({ ...c, orderIndex: idx }));
      if (!('creators' in fieldOverrides)) out.creators = structuredCreators;
      if (!('contributors' in fieldOverrides)) out.contributors = structuredCreators;
      if (typeof rawAuthorsVal === 'string') out.authors = splitAuthorString(rawAuthorsVal);
    }
  } else if (!explicitOnly && !('creators' in fieldOverrides)) {
    const masterBaseCreators = extractItemRawCreators(masterItem);
    const baseCreators = masterBaseCreators.length > 0 ? masterBaseCreators.map((c) => ({ ...c })) : buildStructuredCreatorsFromAuthors(masterItem?.authors);
    const seenKeys = new Set<string>(baseCreators.map(getCreatorDedupKey));
    let addedSecondary = false;
    for (const it of orderedItems) {
      if (it.id === masterItem?.id) continue;
      for (const cr of extractItemRawCreators(it)) {
        if (isSecondaryCreator(cr)) {
          const key = getCreatorDedupKey(cr);
          if (!seenKeys.has(key)) { seenKeys.add(key); baseCreators.push({ ...cr }); addedSecondary = true; }
        }
      }
    }
    if (addedSecondary) {
      const mergedCreators = baseCreators.map((c, idx) => ({ ...c, orderIndex: idx }));
      out.creators = mergedCreators;
      if (!('contributors' in fieldOverrides)) out.contributors = mergedCreators;
    }
  }

  const masterEf = !explicitOnly && masterItem?.extraFields && typeof masterItem.extraFields === 'object' ? (masterItem.extraFields as Record<string, unknown>) : {};
  const nextExtraFields: Record<string, unknown> = { ...masterEf, ...(out.extraFields && typeof out.extraFields === 'object' ? (out.extraFields as Record<string, unknown>) : {}) };
  let extraFieldsMutated = Boolean(out.extraFields);

  for (const [key, val] of Object.entries({ ...out })) {
    if (SKIP_SYNC_KEYS.has(key)) continue;
    const keyLower = key.toLowerCase();
    const isCleared = val === '' || val === null;
    if (key === 'year' && isCleared) out.year = null;
    const syncTargets = MULTI_KEY_SYNC_SETTERS[keyLower];
    if (syncTargets) {
      for (const targetKey of syncTargets) {
        if (keyLower === 'conferencename' && targetKey === 'publicationTitle' && effectiveItemType === 'conferencePaper') continue;
        if (!(targetKey in out)) out[targetKey] = isCleared ? (targetKey === 'year' ? null : '') : val;
        else if (targetKey === 'year' && out[targetKey] === '') out[targetKey] = null;
        nextExtraFields[targetKey] = isCleared ? null : val;
        extraFieldsMutated = true;
      }
    }
    nextExtraFields[key] = isCleared ? null : val;
    extraFieldsMutated = true;
  }

  if (out.extraFields && typeof out.extraFields === 'object') {
    for (const [efKey, efVal] of Object.entries(out.extraFields as Record<string, unknown>)) {
      if (SKIP_SYNC_KEYS.has(efKey) || efVal === undefined) continue;
      if (!(efKey in out)) out[efKey] = efVal === '' || efVal === null ? (efKey === 'year' ? null : '') : efVal;
    }
  }

  if ('abstract' in out && out.abstract !== undefined && !('abstractNote' in out)) out.abstractNote = out.abstract;
  if ('abstractNote' in out && out.abstractNote !== undefined && !('abstract' in out)) out.abstract = out.abstractNote;
  if (extraFieldsMutated) out.extraFields = nextExtraFields;
  if (((hasTypeMismatch && !explicitOnly) || includeMasterDefaults) && !out.itemType) out.itemType = effectiveItemType;

  if (!explicitOnly && !('extra' in fieldOverrides) && !(options?.customFieldTexts && 'extra' in options.customFieldTexts)) {
    const mergedExtra = mergeItemExtraFields(items, masterItem?.id || masterId, out, options?.customFieldTexts);
    const masterExtra = typeof masterItem?.extra === 'string' ? masterItem.extra.trim() : typeof masterEf.extra === 'string' ? String(masterEf.extra).trim() : '';
    if (mergedExtra && (includeMasterDefaults || mergedExtra !== masterExtra)) out.extra = mergedExtra;
  }
  return out;
}

export function extractExplicitUserMergeOverrides(
  items: readonly Item[],
  masterId: string,
  fieldOverrides: Record<string, unknown> = {},
  options?: { inspection?: MergeInspectionResult; customFieldTexts?: Record<string, string> },
): Record<string, unknown> {
  return resolveDuplicateMergeFieldOverrides(items, masterId, fieldOverrides, { ...options, includeUnchangedMasterFields: false, explicitUserSelectionsOnly: true });
}

export interface MergeFieldOptionState {
  isExplicitOverride: boolean; isMasterDefault: boolean; isSelected: boolean; isRecommended: boolean;
}

export function resolveMergeFieldOptionState(
  field: ItemFieldDiff,
  opt: FieldOptionValue,
  activeOverrideValue: unknown,
): MergeFieldOptionState {
  const masterValue = field.masterValue?.rawValue;
  const isExplicitOverride =
    activeOverrideValue !== undefined &&
    activeOverrideValue !== null &&
    (opt.rawValue === activeOverrideValue ||
      (opt.isEmpty && (activeOverrideValue === '' || (Array.isArray(activeOverrideValue) && activeOverrideValue.length === 0))) ||
      normalizeCompareValue(opt.rawValue, field.key) === normalizeCompareValue(activeOverrideValue, field.key));
  const isMasterDefault = (activeOverrideValue === undefined || activeOverrideValue === null) && opt.isMaster && opt.rawValue === masterValue;
  const isSelected = isExplicitOverride || isMasterDefault;
  const isRecommended = field.hasConflict && opt.itemId === field.recommendedItemId && !isSelected;
  return { isExplicitOverride, isMasterDefault, isSelected, isRecommended };
}
