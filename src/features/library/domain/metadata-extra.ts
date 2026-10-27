import type { Item } from './types/library.types';
import {
  getTitleFieldForType,
  getVenueFieldForType,
  getDateFieldForType,
} from './types/item-types.types';
import {
  isValidValue,
  stripLatexMarkup,
} from './metadata-sanitizers';
import {
  ALLOWED_ITEM_EXTRA_LINE_KEYS,
  SYSTEM_INTERNAL_METADATA_KEYS,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  DEDICATED_FIELDS_BY_TYPE_MAP,
  EMPTY_DEDICATED_FIELDS_SET,
  EXTRA_KEY_ALIASES,
  CROSS_FIELD_FALLBACK_NORMS,
  PROMOTED_TOP_LEVEL_EXTRA_KEYS,
  getMatchingExtraKeyNorms,
} from './metadata-extra.constants';

export {
  ALLOWED_ITEM_EXTRA_LINE_KEYS,
  SYSTEM_INTERNAL_METADATA_KEYS,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  DEDICATED_FIELDS_BY_TYPE_MAP,
  EMPTY_DEDICATED_FIELDS_SET,
  EXTRA_KEY_ALIASES,
};

/**
 * Extracts canonical display title from an Item across Zotero Schema v42 BASE_FIELD_MAPPINGS
 * (`title`, `caseName` for `case`, `nameOfAct` for `statute`, `subject` for `email`).
 */
export function getItemDisplayTitle(
  item?: Partial<Item> | Record<string, unknown> | null,
): string {
  if (!item || typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};

  const clean = (val: unknown): string => {
    if (!isValidValue(val)) return '';
    return stripLatexMarkup(String(val).trim());
  };

  const itemType = typeof rec.itemType === 'string' ? rec.itemType : undefined;
  const preferredTitleField = getTitleFieldForType(itemType);
  if (preferredTitleField && preferredTitleField !== 'title') {
    const val = clean(rec[preferredTitleField] ?? ef[preferredTitleField]);
    if (val) return val;
  }

  const fallbackFields = ['title', 'caseName', 'nameOfAct', 'subject'] as const;
  for (const field of fallbackFields) {
    const val = clean(rec[field] ?? ef[field]);
    if (val) return val;
  }

  return '';
}

/**
 * Extracts publication venue (journal, conference, court, issuingAuthority, repository, publisher)
 * for UI cards, tables, citations, and exports across all 37 Zotero Schema v42 item types.
 */
export function getPublicationVenue(
  item?: Partial<Item> | Record<string, unknown> | null,
): string {
  if (!item || typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  const extra = (rec.extraFields as Record<string, unknown> | undefined) || {};
  const meta = (rec.metadata as Record<string, unknown> | undefined) || {};

  const clean = (val: unknown): string => {
    if (!isValidValue(val)) return '';
    return stripLatexMarkup(String(val).trim());
  };

  const itemType = (item as Item).itemType;
  const preferredField = getVenueFieldForType(itemType);
  if (preferredField) {
    const val = clean(rec[preferredField] ?? extra[preferredField] ?? meta[preferredField]);
    if (val) return val;
  }

  const fallbackFields = [
    'publicationTitle',
    'journal',
    'proceedingsTitle',
    'bookTitle',
    ...(itemType === 'conferencePaper' ? [] : ['conferenceName', 'meetingName']),
    'repository',
    'publisher',
    'court',
    'issuingAuthority',
    'authority',
    'company',
    'organization',
    'institution',
    'university',
    'distributor',
    'studio',
    'network',
    'label',
    'programTitle',
    'websiteTitle',
    'blogTitle',
    'forumTitle',
    'dictionaryTitle',
    'encyclopediaTitle',
    'sessionTitle',
    'legislativeBody',
    'committee',
    'code',
    'reporter',
  ];

  for (const field of fallbackFields) {
    const val = clean(rec[field] ?? extra[field] ?? meta[field]);
    if (val) return val;
  }

  const arxivId = clean(
    rec.arxivId ??
      extra.arxivId ??
      meta.arxivId ??
      rec.archiveID ??
      extra.archiveID ??
      meta.archiveID,
  );
  if (arxivId) {
    return 'arXiv';
  }

  return '';
}

/**
 * Formats an academic itemType into a user-friendly label ("Journal Article", "Conference Paper").
 */
export function formatItemTypeLabel(rawType?: string | null): string {
  if (!rawType) return '—';
  const str = String(rawType).trim();
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ');
  return withSpaces.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isSystemInternalExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith('_')) return true;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  return SYSTEM_INTERNAL_METADATA_KEYS.has(normalized);
}

export function isAllowedItemExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith('_')) return false;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  return !INTERNAL_AND_DEDICATED_METADATA_KEYS.has(normalized);
}

/**
 * Formats the extra metadata field for inspector display.
 */
export function formatExtraDisplay(item: Item): string {
  const sanitized = formatAndSanitizeExtraMetadata(
    item.extra,
    item.extraFields as Record<string, unknown> | undefined,
    item,
  );
  if (sanitized) {
    return sanitized.replace(/\r?\n+/g, ', ');
  }
  return '—';
}

function collectUnmappedFieldsSet(
  associatedPaperItem?: Partial<Item> | null,
  additionalExtraFields?: Record<string, unknown> | null,
): Set<string> {
  const unmapped = new Set<string>();
  const sources = [
    associatedPaperItem?.metadata as Record<string, unknown> | undefined,
    associatedPaperItem?.extraFields as Record<string, unknown> | undefined,
    additionalExtraFields ?? undefined,
  ];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of Object.keys(src)) {
      const m = k.match(/^__unmapped_[^_]+_(.+)$/i);
      if (m && m[1]) {
        unmapped.add(m[1].toLowerCase().replace(/[\s_-]+/g, ''));
      }
    }
  }
  return unmapped;
}

/**
 * Formats and cleans extra metadata text for the Inspector's Extra tab.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  const lines: string[] = [];
  const seenNormalizedLines = new Set<string>();

  const effectiveExtraFields =
    additionalExtraFields ||
    (associatedPaperItem?.extraFields as Record<string, unknown> | undefined);

  const resolvedItemType =
    (typeof associatedPaperItem?.itemType === 'string' &&
      associatedPaperItem.itemType) ||
    (typeof effectiveExtraFields?.itemType === 'string' &&
      effectiveExtraFields.itemType) ||
    undefined;

  const dedicatedFieldsForType: ReadonlySet<string> =
    (resolvedItemType && DEDICATED_FIELDS_BY_TYPE_MAP.get(resolvedItemType)) ||
    EMPTY_DEDICATED_FIELDS_SET;
  const unmappedFields = collectUnmappedFieldsSet(
    associatedPaperItem,
    additionalExtraFields,
  );

  const isDedicatedFieldOnCurrentType = (rawKey: string): boolean => {
    const normKey = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (normKey === 'extra') {
      return false;
    }
    if (unmappedFields.has(normKey)) return false;
    return dedicatedFieldsForType.has(normKey);
  };

  const canRenderExtraFieldKey = (
    rawKey: string,
    fromExplicitExtraText: boolean,
  ): boolean => {
    const trimmedKey = rawKey.trim();
    if (!trimmedKey || isSystemInternalExtraKey(trimmedKey)) return false;
    const normKey = trimmedKey.toLowerCase().replace(/[\s_-]+/g, '');
    if (unmappedFields.has(normKey)) {
      return true;
    }
    if (isDedicatedFieldOnCurrentType(trimmedKey)) {
      return false;
    }
    if (ALLOWED_ITEM_EXTRA_LINE_KEYS.has(normKey)) {
      return true;
    }
    if (resolvedItemType && fromExplicitExtraText) {
      return true;
    }
    return isAllowedItemExtraKey(trimmedKey);
  };

  const pushUniqueLine = (rawLine: string, fromExplicitExtraText = true) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const key = kvMatch[1]!.trim();
      const val = kvMatch[2]!.trim();
      if (
        !canRenderExtraFieldKey(key, fromExplicitExtraText) ||
        (!isValidValue(val) && val !== '0') ||
        val === '[object Object]'
      ) {
        return;
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

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith('{') && !trimmed.startsWith('{:')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const parsedObj = parsed as Record<string, unknown>;
          if (
            typeof parsedObj._rawExtra === 'string' &&
            parsedObj._rawExtra.trim()
          ) {
            for (const l of parsedObj._rawExtra.split(/\r?\n/)) {
              pushUniqueLine(l, true);
            }
          }
          for (const [k, v] of Object.entries(parsedObj)) {
            if (k === '_rawExtra' || !canRenderExtraFieldKey(k, false)) {
              continue;
            }
            if (
              (typeof v === 'string' || typeof v === 'number') &&
              (isValidValue(v) || v === 0 || v === '0')
            ) {
              pushUniqueLine(`${k}: ${String(v).trim()}`, false);
            }
          }
        }
      } catch {
        for (const l of trimmed.split(/\r?\n/)) {
          pushUniqueLine(l, true);
        }
      }
    } else {
      for (const l of trimmed.split(/\r?\n/)) {
        pushUniqueLine(l, true);
      }
    }
  }

  if (effectiveExtraFields && typeof effectiveExtraFields === 'object') {
    for (const [k, v] of Object.entries(effectiveExtraFields)) {
      if (!canRenderExtraFieldKey(k, false)) {
        continue;
      }
      if (
        (typeof v === 'string' || typeof v === 'number') &&
        (isValidValue(v) || v === 0 || v === '0')
      ) {
        pushUniqueLine(`${k}: ${String(v).trim()}`, false);
      }
    }
  }

  return lines.join('\n').trim();
}

/**
 * Strips or updates in-place any `Key: Value` line or `{:Key: Value}` block in `extraText`
 * matching `canonicalKey` (including its `EXTRA_KEY_ALIASES` such as `DOI`, `PMID`, `PMCID`,
 * `arXiv`, `Original Date`, `Citation Key`). Returns `undefined` if `extraText` did not
 * contain a matching entry so callers only patch `item.extra` when necessary.
 */
export function stripOrUpdateExtraKeyLine(
  extraText: string | null | undefined,
  canonicalKey: string,
  newValue: string,
): string | undefined {
  if (typeof extraText !== 'string' || !extraText.trim()) return undefined;
  const matchingNorms = getMatchingExtraKeyNorms(canonicalKey);
  if (matchingNorms.size === 0) return undefined;

  const cleanNewVal = newValue.trim();
  let mutated = false;
  const nextLines: string[] = [];

  for (const rawLine of extraText.split(/\r?\n/)) {
    let workingLine = rawLine;
    if (workingLine.includes('{:')) {
      workingLine = workingLine.replace(
        /\{:([^:}]+):\s*([^}]+)\}/g,
        (fullMatch, rawKey: string, rawVal: string) => {
          const norm = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (!matchingNorms.has(norm)) return fullMatch;
          if (!cleanNewVal) {
            mutated = true;
            return '';
          }
          if (rawVal.trim() !== cleanNewVal) {
            mutated = true;
          }
          return `{:${rawKey.trim()}: ${cleanNewVal}}`;
        },
      );
    }

    const trimmed = workingLine.trim();
    if (!trimmed) {
      if (rawLine.trim()) mutated = true;
      continue;
    }

    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const lineKey = kvMatch[1]!.trim();
      const lineVal = kvMatch[2]!.trim();
      const lineNorm = lineKey.toLowerCase().replace(/[\s_-]+/g, '');
      if (matchingNorms.has(lineNorm)) {
        if (!cleanNewVal) {
          mutated = true;
          continue;
        }
        if (lineVal !== cleanNewVal) {
          mutated = true;
        }
        nextLines.push(`${lineKey}: ${cleanNewVal}`);
        continue;
      }
    }

    nextLines.push(workingLine);
  }

  return mutated ? nextLines.join('\n').trim() : undefined;
}

function extractNormalizedExtraLines(
  text?: string | null,
): Map<string, { rawKey: string; value: string }> {
  const map = new Map<string, { rawKey: string; value: string }>();
  if (typeof text !== 'string' || !text.trim()) return map;
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const rawKey = kvMatch[1]!.trim();
      const value = kvMatch[2]!.trim();
      const norm = rawKey.toLowerCase().replace(/[\s_-]+/g, '');
      if (norm && !isSystemInternalExtraKey(rawKey)) {
        map.set(norm, { rawKey, value });
      }
    }
  }
  return map;
}

/**
 * Builds an atomic update patch when the user edits and saves the Inspector's `Extra` field.
 */
export function buildExtraMetadataPatch(
  item: Partial<Item>,
  nextExtraText: string,
): Partial<Item> {
  const prevKeysByNorm = extractNormalizedExtraLines(item.extra);
  const nextKeysByNorm = extractNormalizedExtraLines(nextExtraText);
  const nextParsed = parseItemExtraField(nextExtraText);

  const currentEf =
    (item.extraFields as Record<string, unknown> | undefined) || {};
  const resolvedItemType =
    (typeof item.itemType === 'string' && item.itemType) ||
    (typeof currentEf.itemType === 'string' && currentEf.itemType) ||
    undefined;
  const dedicatedFieldsForType: ReadonlySet<string> =
    (resolvedItemType && DEDICATED_FIELDS_BY_TYPE_MAP.get(resolvedItemType)) ||
    EMPTY_DEDICATED_FIELDS_SET;
  const unmappedFields = collectUnmappedFieldsSet(item, currentEf);

  const isDedicated = (rawKey: string): boolean => {
    const norm = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (norm === 'extra' || ALLOWED_ITEM_EXTRA_LINE_KEYS.has(norm) || unmappedFields.has(norm)) {
      return false;
    }
    return dedicatedFieldsForType.has(norm);
  };

  const resolveCanonicalKey = (norm: string, fallbackKey: string): string => {
    const aliases = EXTRA_KEY_ALIASES[norm];
    return aliases && aliases.length > 0 ? aliases[0]! : fallbackKey;
  };

  const nextExtraFields: Record<string, unknown> = { ...currentEf };
  const topLevelPromotedPatch: Record<string, unknown> = {};
  let efChanged = false;

  for (const [k, v] of Object.entries(currentEf)) {
    if (isSystemInternalExtraKey(k) || isDedicated(k)) continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const norm = k.toLowerCase().replace(/[\s_-]+/g, '');
    const nextEntry = nextKeysByNorm.get(norm);
    const canonicalKey = resolveCanonicalKey(norm, k);
    if (!nextEntry && !(canonicalKey in nextParsed)) {
      nextExtraFields[k] = null;
      if (canonicalKey in nextExtraFields) {
        nextExtraFields[canonicalKey] = null;
      }
      efChanged = true;
      if (
        PROMOTED_TOP_LEVEL_EXTRA_KEYS.has(canonicalKey) &&
        !isDedicated(canonicalKey)
      ) {
        topLevelPromotedPatch[canonicalKey] = '';
      }
    } else {
      const resolvedNextVal = nextEntry?.value ?? nextParsed[canonicalKey];
      if (resolvedNextVal !== undefined && String(v).trim() !== resolvedNextVal) {
        nextExtraFields[k] = resolvedNextVal;
        efChanged = true;
      }
    }
  }

  for (const [norm, prevEntry] of prevKeysByNorm.entries()) {
    const canonicalKey = resolveCanonicalKey(norm, prevEntry.rawKey);
    if (!nextKeysByNorm.has(norm) && !(canonicalKey in nextParsed)) {
      if (nextExtraFields[canonicalKey] !== null) {
        nextExtraFields[canonicalKey] = null;
        efChanged = true;
      }
      if (
        prevEntry.rawKey in nextExtraFields &&
        nextExtraFields[prevEntry.rawKey] !== null
      ) {
        nextExtraFields[prevEntry.rawKey] = null;
        efChanged = true;
      }
      const aliases = EXTRA_KEY_ALIASES[norm];
      if (aliases) {
        for (const alias of aliases) {
          const aliasNorm = alias.toLowerCase().replace(/[\s_-]+/g, '');
          if (
            (aliasNorm === norm || !CROSS_FIELD_FALLBACK_NORMS.has(aliasNorm)) &&
            alias in nextExtraFields &&
            nextExtraFields[alias] !== null
          ) {
            nextExtraFields[alias] = null;
            efChanged = true;
          }
        }
      }
      if (PROMOTED_TOP_LEVEL_EXTRA_KEYS.has(canonicalKey)) {
        topLevelPromotedPatch[canonicalKey] = '';
      }
    }
  }

  for (const [norm, { rawKey, value }] of nextKeysByNorm.entries()) {
    if (!isValidValue(value) && value !== '0') continue;
    const canonicalKey = resolveCanonicalKey(norm, rawKey);
    if (nextExtraFields[canonicalKey] !== value) {
      nextExtraFields[canonicalKey] = value;
      efChanged = true;
    }
    if (rawKey !== canonicalKey && !isDedicated(rawKey) && nextExtraFields[rawKey] !== value) {
      nextExtraFields[rawKey] = value;
      efChanged = true;
    }
    if (PROMOTED_TOP_LEVEL_EXTRA_KEYS.has(canonicalKey)) {
      topLevelPromotedPatch[canonicalKey] = value;
    }
  }

  for (const [parsedKey, parsedVal] of Object.entries(nextParsed)) {
    if (!isValidValue(parsedVal) && parsedVal !== '0') continue;
    if (isSystemInternalExtraKey(parsedKey)) continue;
    if (PROMOTED_TOP_LEVEL_EXTRA_KEYS.has(parsedKey)) {
      if (nextExtraFields[parsedKey] !== parsedVal) {
        nextExtraFields[parsedKey] = parsedVal;
        efChanged = true;
      }
      if (!(parsedKey in topLevelPromotedPatch)) {
        topLevelPromotedPatch[parsedKey] = parsedVal;
      }
    }
  }

  const patch: Partial<Item> = {
    ...topLevelPromotedPatch,
    extra: nextExtraText,
    ...(efChanged ? { extraFields: nextExtraFields } : {}),
    ...(item.itemType ? { itemType: item.itemType } : {}),
  };

  if (item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)) {
    const currentMeta = item.metadata as Record<string, unknown>;
    const nextMeta: Record<string, unknown> = { ...currentMeta };
    let metaChanged = false;
    for (const [k, v] of Object.entries(currentMeta)) {
      if (isSystemInternalExtraKey(k) || isDedicated(k)) continue;
      if (typeof v !== 'string' && typeof v !== 'number') continue;
      const norm = k.toLowerCase().replace(/[\s_-]+/g, '');
      if (!nextKeysByNorm.has(norm) && nextMeta[k] !== null) {
        nextMeta[k] = null;
        metaChanged = true;
      }
    }
    if (metaChanged) {
      patch.metadata = nextMeta;
    }
  }

  return patch;
}

/**
 * Extracts a canonical display year (number) or date string from an Item across Zotero Schema v42.
 */
export function getItemDisplayDate(
  item?: Partial<Item> | Record<string, unknown> | null,
): number | string | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};
  if (isValidValue(rec.year)) {
    const num = Number(rec.year);
    if (!isNaN(num) && num >= 1000 && num <= 2999) return num;
  }

  const itemType = typeof rec.itemType === 'string' ? rec.itemType : undefined;
  const preferredDateField = getDateFieldForType(itemType);
  const preferredVal =
    preferredDateField && preferredDateField !== 'date'
      ? (rec[preferredDateField] ?? ef[preferredDateField])
      : undefined;

  const dateSource =
    preferredVal ||
    rec.publicationDate ||
    rec.date ||
    rec.issueDate ||
    rec.dateDecided ||
    rec.dateEnacted ||
    rec.filingDate ||
    ef.publicationDate ||
    ef.date ||
    ef.issueDate ||
    ef.dateDecided ||
    ef.dateEnacted ||
    ef.filingDate;

  if (isValidValue(dateSource)) {
    const match = String(dateSource).match(/\b(1\d{3}|20\d{2})\b/);
    if (match) return parseInt(match[1], 10);
    return String(dateSource).trim();
  }
  return null;
}

const PARSED_EXTRA_STRING_CACHE = new Map<string, Readonly<Record<string, string>>>();
const PARSED_EXTRA_OBJECT_CACHE = new WeakMap<object, Readonly<Record<string, string>>>();
const MAX_EXTRA_CACHE_SIZE = 5000;

/**
 * Parses item "Extra" field extended syntax (both `Key: Value` lines and `{:Key: Value}` blocks)
 * into a dictionary supporting both exact, lowercase, and canonical field lookups.
 */
export function parseItemExtraField(extra?: unknown): Record<string, string> {
  if (!extra) return {};

  if (typeof extra === 'string') {
    const trimmed = extra.trim();
    if (!trimmed) return {};
    const cached = PARSED_EXTRA_STRING_CACHE.get(trimmed);
    if (cached) {
      PARSED_EXTRA_STRING_CACHE.delete(trimmed);
      PARSED_EXTRA_STRING_CACHE.set(trimmed, cached);
      return cached;
    }
  } else if (typeof extra === 'object' && !Array.isArray(extra)) {
    const cached = PARSED_EXTRA_OBJECT_CACHE.get(extra);
    if (cached) return cached;
  }

  const result: Record<string, string> = {};
  const setKey = (rawKey: string, rawVal: string) => {
    const k = rawKey.trim();
    const v = rawVal.trim();
    if (!k || !isValidValue(v)) return;
    result[k] = v;
    const lower = k.toLowerCase();
    result[lower] = v;
    const collapsed = lower.replace(/[\s_-]+/g, '');
    result[collapsed] = v;
    const aliases = EXTRA_KEY_ALIASES[collapsed];
    if (aliases) {
      for (const alias of aliases) {
        if (!result[alias]) result[alias] = v;
        if (!result[alias.toLowerCase()]) result[alias.toLowerCase()] = v;
      }
    }
  };

  if (typeof extra === 'object' && !Array.isArray(extra)) {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      if (v !== null && v !== undefined && isValidValue(v)) {
        setKey(k, String(v));
      }
    }
    const frozen = Object.freeze(result);
    PARSED_EXTRA_OBJECT_CACHE.set(extra, frozen);
    return frozen;
  }

  if (typeof extra !== 'string') return result;
  const trimmed = extra.trim();
  if (!trimmed) return result;

  const cacheAndReturn = (res: Record<string, string>): Readonly<Record<string, string>> => {
    const frozen = Object.freeze(res);
    if (PARSED_EXTRA_STRING_CACHE.size >= MAX_EXTRA_CACHE_SIZE) {
      const oldest = PARSED_EXTRA_STRING_CACHE.keys().next().value;
      if (oldest !== undefined) {
        PARSED_EXTRA_STRING_CACHE.delete(oldest);
      }
    }
    PARSED_EXTRA_STRING_CACHE.set(trimmed, frozen);
    return frozen;
  };

  if (trimmed.startsWith('{') && !trimmed.startsWith('{:')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (v !== null && v !== undefined && isValidValue(v)) {
            setKey(k, String(v));
          }
        }
        return cacheAndReturn(result);
      }
    } catch {
      // Fall through to line-by-line Extra field parsing
    }
  }

  const inlineRegex = /\{:([^:}]+):\s*([^}]+)\}/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(trimmed)) !== null) {
    setKey(inlineMatch[1], inlineMatch[2]);
  }

  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/\{:[^:}]+:[^}]+\}/g, '').trim();
    if (!cleanLine) continue;
    const match = cleanLine.match(
      /^([A-Za-z][A-Za-z0-9\s_-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (match) {
      setKey(match[1], match[2]);
    }
  }

  return cacheAndReturn(result);
}
