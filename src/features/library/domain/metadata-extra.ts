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
  FALLBACK_VENUE_FIELDS_BASE,
  getCandidateNormsForUnmappedField,
  collectUnmappedFieldsSet,
  isDedicatedFieldForType,
} from './metadata-extra.constants';
import {
  isSystemInternalExtraKey,
  isAllowedItemExtraKey,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  stripOrUpdateExtraKeyLine,
  extractNormalizedExtraLines,
  parseItemExtraField,
} from './zotero-extra-parser';

export {
  ALLOWED_ITEM_EXTRA_LINE_KEYS,
  SYSTEM_INTERNAL_METADATA_KEYS,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  DEDICATED_FIELDS_BY_TYPE_MAP,
  EMPTY_DEDICATED_FIELDS_SET,
  EXTRA_KEY_ALIASES,
  isSystemInternalExtraKey,
  isAllowedItemExtraKey,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  stripOrUpdateExtraKeyLine,
  parseItemExtraField,
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

  const resolveField = (field: string): string => {
    const fromRecOrExtra = clean(rec[field] ?? extra[field]);
    if (fromRecOrExtra) return fromRecOrExtra;
    if (
      extra[field] === null ||
      (field in rec && (rec[field] === '' || rec[field] === null))
    ) {
      return '';
    }
    return clean(meta[field]);
  };

  const itemType = (item as Item).itemType;
  const preferredField = getVenueFieldForType(itemType);
  if (preferredField) {
    const val = resolveField(preferredField);
    if (val) return val;
  }

  const fallbackFields =
    itemType === 'conferencePaper'
      ? FALLBACK_VENUE_FIELDS_BASE
      : ['publicationTitle', 'journal', 'proceedingsTitle', 'bookTitle', 'conferenceName', 'meetingName', ...FALLBACK_VENUE_FIELDS_BASE.slice(4)];

  for (const field of fallbackFields) {
    const val = resolveField(field);
    if (val) return val;
  }

  const arxivId = resolveField('arxivId') || resolveField('archiveID');
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

/**
 * Builds an atomic update patch when the user edits and saves the Inspector's `Extra` field.
 */
export function buildExtraMetadataPatch(
  item: Partial<Item>,
  nextExtraText: string,
): Partial<Item> {
  const prevDisplayed = formatAndSanitizeExtraMetadata(
    item?.extra,
    item?.extraFields as Record<string, unknown> | undefined,
    item,
  );
  const prevKeysByNorm = extractNormalizedExtraLines(
    [item?.extra, prevDisplayed].filter(Boolean).join('\n'),
  );
  const prevParsed = parseItemExtraField(prevDisplayed);
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
    if (ALLOWED_ITEM_EXTRA_LINE_KEYS.has(norm)) {
      return false;
    }
    return isDedicatedFieldForType(
      rawKey,
      dedicatedFieldsForType,
      unmappedFields,
    );
  };

  const resolveCanonicalKey = (norm: string, fallbackKey: string): string => {
    const aliases = EXTRA_KEY_ALIASES[norm];
    return aliases && aliases.length > 0 ? aliases[0]! : fallbackKey;
  };

  const nextExtraFields: Record<string, unknown> = { ...currentEf };
  const topLevelPromotedPatch: Record<string, unknown> = {};
  let efChanged = false;

  for (const [k, v] of Object.entries(currentEf)) {
    const unmappedMatch = k.match(/^__unmapped_[^_]+_(.+)$/i);
    if (unmappedMatch && unmappedMatch[1]) {
      if (v === null) continue;
      const field = unmappedMatch[1].trim();
      const candidateNorms = getCandidateNormsForUnmappedField(field);
      let matchedValue: string | undefined;
      for (const candNorm of candidateNorms) {
        const entry = nextKeysByNorm.get(candNorm);
        if (entry) {
          matchedValue = entry.value;
          break;
        }
      }
      if (matchedValue === undefined && field in nextParsed) {
        matchedValue = nextParsed[field];
      }
      if (matchedValue === undefined) {
        nextExtraFields[k] = null;
        if (field in nextExtraFields && nextExtraFields[field] !== null) {
          nextExtraFields[field] = null;
        }
        efChanged = true;
      } else if (String(v ?? '').trim() !== matchedValue) {
        nextExtraFields[k] = matchedValue;
        if (field in nextExtraFields && !isDedicated(field)) {
          nextExtraFields[field] = matchedValue;
        }
        efChanged = true;
      }
      continue;
    }

    if (isSystemInternalExtraKey(k) || isDedicated(k)) continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const norm = k.toLowerCase().replace(/[\s_-]+/g, '');
    const nextEntry = nextKeysByNorm.get(norm);
    const canonicalKey = resolveCanonicalKey(norm, k);
    if (!nextEntry && !(canonicalKey in nextParsed)) {
      nextExtraFields[k] = null;
      if (canonicalKey in nextExtraFields || canonicalKey in prevParsed) {
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

  const currentMeta =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : undefined;
  const clearedMetaTombstones: Record<string, unknown> = {};
  let metaChanged = false;
  if (currentMeta) {
    for (const [k, v] of Object.entries(currentMeta)) {
      const unmappedMatch = k.match(/^__unmapped_[^_]+_(.+)$/i);
      if (unmappedMatch && unmappedMatch[1]) {
        if (v === null) continue;
        const field = unmappedMatch[1].trim();
        const candidateNorms = getCandidateNormsForUnmappedField(field);
        const stillPresent =
          candidateNorms.some((cn) => nextKeysByNorm.has(cn)) ||
          field in nextParsed;
        if (!stillPresent) {
          clearedMetaTombstones[k] = null;
          metaChanged = true;
          if (nextExtraFields[k] !== null) {
            nextExtraFields[k] = null;
            efChanged = true;
          }
        }
        continue;
      }
      if (isSystemInternalExtraKey(k) || isDedicated(k)) continue;
      if (typeof v !== 'string' && typeof v !== 'number') continue;
      const norm = k.toLowerCase().replace(/[\s_-]+/g, '');
      const canonicalKey = resolveCanonicalKey(norm, k);
      if (!nextKeysByNorm.has(norm) && !(canonicalKey in nextParsed) && currentMeta[k] !== null) {
        clearedMetaTombstones[k] = null;
        metaChanged = true;
      }
    }
  }
  for (const [k, v] of Object.entries(nextExtraFields)) {
    if (v === null && (!currentMeta || currentMeta[k] !== null)) {
      clearedMetaTombstones[k] = null;
      metaChanged = true;
    }
  }

  const patch: Partial<Item> = {
    ...topLevelPromotedPatch,
    extra: nextExtraText,
    ...(efChanged ? { extraFields: nextExtraFields } : {}),
    ...(item.itemType ? { itemType: item.itemType } : {}),
  };
  if (metaChanged && (currentMeta || efChanged)) {
    patch.metadata = clearedMetaTombstones;
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
